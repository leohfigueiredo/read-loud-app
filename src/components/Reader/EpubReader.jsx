import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import { saveBook } from '../../services/storage';

export default function EpubReader({ file, metadata, onTextExtract, bookId, theme, onSelection }) {
  const viewerRef = useRef(null);
  const wrapperRef = useRef(null);
  const touchStartRef = useRef(null);
  const [rendition, setRendition] = useState(null);
  const [book, setBook] = useState(null);
  const [progress, setProgress] = useState(metadata.progressPercent || 0);

  // Animate the viewer wrapper after navigation
  const animateIn = (dir) => {
    if (!wrapperRef.current) return;
    const from = dir === 'next' ? 60 : -60;
    wrapperRef.current.animate(
      [
        { transform: `translateX(${from}px)`, opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 }
      ],
      { duration: 280, easing: 'ease-out', fill: 'forwards' }
    );
  };

  useEffect(() => {
    let newBook;
    async function loadEpub() {
      try {
        const arrayBuffer = await file.arrayBuffer();
        newBook = ePub(arrayBuffer);
        setBook(newBook);

        const newRendition = newBook.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'none'
        });

        await newBook.ready;
        try {
          await newBook.locations.generate(1600);
        } catch (e) {
          console.warn('Locations could not be generated', e);
        }

        if (metadata.progressLocation) {
          newRendition.display(metadata.progressLocation);
        } else {
          newRendition.display();
        }

        // Extract text using the view object provided by epubjs
        newRendition.on('rendered', (section, view) => {
          if (onTextExtract) {
            try {
              const text = view?.document?.body?.innerText
                || view?.document?.body?.textContent
                || '';
              if (text.trim()) onTextExtract(text.trim());
            } catch {
              // fallback: try via iframe
              try {
                const iframe = viewerRef.current?.querySelector('iframe');
                const t = iframe?.contentDocument?.body?.innerText || '';
                if (t.trim()) onTextExtract(t.trim());
              } catch {}
            }
          }
        });

        // Touch events inside the epub iframe
        newRendition.on('touchstart', (event) => {
          if (event.changedTouches?.length > 0) {
            touchStartRef.current = event.changedTouches[0].screenX;
          }
        });

        newRendition.on('touchend', (event) => {
          if (event.changedTouches?.length > 0 && touchStartRef.current != null) {
            const dist = touchStartRef.current - event.changedTouches[0].screenX;
            if (dist > 50) newRendition.next().then(() => animateIn('next'));
            else if (dist < -50) newRendition.prev().then(() => animateIn('prev'));
            touchStartRef.current = null;
          }
        });

        newRendition.on('relocated', (location) => {
          if (newBook.locations.length() > 0) {
            const percent = Math.round(newBook.locations.percentageFromCfi(location.start.cfi) * 100);
            setProgress(percent);
            if (bookId) {
              setTimeout(() => {
                saveBook(file, bookId, {
                  ...metadata,
                  progressLocation: location.start.cfi,
                  progressPercent: percent
                });
              }, 500);
            }
          }
        });

        newRendition.on('selected', (cfiRange, contents) => {
          const sel = contents.window.getSelection();
          const text = sel.toString().trim();
          if (text && onSelection) {
            try {
              const range = sel.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              const iframe = viewerRef.current?.querySelector('iframe');
              const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
              
              onSelection({
                text,
                x: iframeRect.left + rect.left + (rect.width / 2),
                y: iframeRect.top + rect.top + window.scrollY - 10
              });
            } catch (e) {
              console.error("Selection calculation failed:", e);
            }
          }
        });

        newRendition.on('click', () => {
          setTimeout(() => {
            try {
              const iframe = viewerRef.current?.querySelector('iframe');
              const sel = iframe?.contentWindow?.getSelection();
              const text = sel?.toString().trim() || '';
              if (!text && onSelection) {
                onSelection(null);
              }
            } catch {}
          }, 100);
        });

        setRendition(newRendition);
      } catch (err) {
        console.error('Error loading EPUB:', err);
      }
    }

    if (file) loadEpub();
    return () => { if (newBook) newBook.destroy(); };
  }, [file, metadata, bookId, onTextExtract, onSelection]);

  // Inject styles to style EPUB text inside iframe dynamically
  useEffect(() => {
    if (!rendition) return;

    const themeStyles = {
      light: {
        body: {
          background: '#ffffff !important',
          color: '#0f172a !important'
        },
        'p, span, li, h1, h2, h3, h4, h5, h6, a': {
          color: '#0f172a !important'
        }
      },
      dark: {
        body: {
          background: '#0f172a !important',
          color: '#f8fafc !important'
        },
        'p, span, li, h1, h2, h3, h4, h5, h6, a': {
          color: '#f8fafc !important'
        }
      },
      night: {
        body: {
          background: '#fffbeb !important',
          color: '#451a03 !important'
        },
        'p, span, li, h1, h2, h3, h4, h5, h6, a': {
          color: '#451a03 !important'
        }
      }
    };

    // Register themes in epubjs
    Object.entries(themeStyles).forEach(([name, rules]) => {
      rendition.themes.register(name, rules);
    });

    rendition.themes.default({
      '.tts-highlight': {
        'background-color': 'rgba(245, 158, 11, 0.25) !important',
        'border-radius': '4px',
        'padding': '1px 3px',
        'box-shadow': '0 0 3px rgba(245, 158, 11, 0.3)',
        'transition': 'background-color 0.2s ease'
      }
    });

    // Select the current theme
    rendition.themes.select(theme || 'light');
  }, [theme, rendition]);

  const next = () => {
    if (rendition) rendition.next().then(() => animateIn('next'));
  };

  const prev = () => {
    if (rendition) rendition.prev().then(() => animateIn('prev'));
  };

  const handleProgressChange = (e) => {
    const percent = parseInt(e.target.value);
    if (book && book.locations.length() > 0 && rendition) {
      const cfi = book.locations.cfiFromPercentage(percent / 100);
      const dir = percent > progress ? 'next' : 'prev';
      rendition.display(cfi).then(() => animateIn(dir));
      setProgress(percent);
    }
  };

  return (
    <div className="epub-reader-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Progress bar */}
      <div style={{ width: '100%', padding: '0.5rem 1rem', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={handleProgressChange}
          style={{ flex: 1, accentColor: 'var(--accent-color)', cursor: 'pointer' }}
          disabled={!book}
          title="Arraste para navegar"
        />
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', minWidth: '50px', textAlign: 'right' }}>{progress}%</span>
      </div>

      {/* Viewer */}
      <div ref={wrapperRef} style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
        <div ref={viewerRef} style={{ width: '100%', height: '100%' }}></div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)' }}>
        <button className="btn-secondary" onClick={prev}>← Anterior</button>
        <button className="btn-secondary" onClick={next}>Próxima →</button>
      </div>
    </div>
  );
}
