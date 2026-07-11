import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import { saveBook } from '../../services/storage';

export default function EpubReader({ file, metadata, onTextExtract, bookId }) {
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

        // Animate AFTER the page is rendered
        newRendition.on('rendered', () => {
          if (viewerRef.current && onTextExtract) {
            try {
              const text = viewerRef.current.querySelector('iframe')?.contentDocument?.body?.innerText || '';
              onTextExtract(text);
            } catch (error) {
              console.debug('Cross-origin iframe text extraction fallback:', error);
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

        setRendition(newRendition);
      } catch (err) {
        console.error('Error loading EPUB:', err);
      }
    }

    if (file) loadEpub();
    return () => { if (newBook) newBook.destroy(); };
  }, [file, metadata, bookId, onTextExtract]);

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
