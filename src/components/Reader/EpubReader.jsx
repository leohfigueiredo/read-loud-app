import { useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import { updateProgress } from '../../services/storage';

export default function EpubReader({ 
  file, 
  metadata, 
  onTextExtract, 
  bookId, 
  theme, 
  onSelection,
  fontSize,
  fontFamily,
  lineHeight,
  paragraphSpacing,
  letterSpacing,
  goToLocation,
  onTocExtract,
  onProgressUpdate,
  onPageClick,
  customSelection
}) {
  const viewerRef = useRef(null);
  const wrapperRef = useRef(null);
  const touchStartRef = useRef(null);
  const activeHighlightRangeRef = useRef(null);
  const justSelectedRef = useRef(false);
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

  const onTextExtractRef = useRef(onTextExtract);
  const onSelectionRef = useRef(onSelection);
  const onTocExtractRef = useRef(onTocExtract);
  const onProgressUpdateRef = useRef(onProgressUpdate);
  const onPageClickRef = useRef(onPageClick);
  const metadataRef = useRef(metadata);

  useEffect(() => {
    onTextExtractRef.current = onTextExtract;
    onSelectionRef.current = onSelection;
    onTocExtractRef.current = onTocExtract;
    onProgressUpdateRef.current = onProgressUpdate;
    onPageClickRef.current = onPageClick;
    metadataRef.current = metadata;
  }, [onTextExtract, onSelection, onTocExtract, onProgressUpdate, onPageClick, metadata]);

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
        
        // Extract and report Table of Contents (TOC)
        const rawToc = newBook.navigation.toc || [];
        if (onTocExtractRef.current) {
          onTocExtractRef.current(rawToc.map(item => ({
            label: item.label.trim(),
            location: item.href
          })));
        }

        // Get starting location from the initial metadata
        const initialLoc = metadataRef.current?.progressLocation;
        if (initialLoc) {
          newRendition.display(initialLoc);
        } else {
          newRendition.display();
        }

        // Generate locations in the background for detailed percentage estimation
        newBook.ready.then(() => {
          return newBook.locations.generate(1024);
        }).then(() => {
          const currentLoc = newRendition.currentLocation();
          if (currentLoc && newBook.locations.length() > 0) {
            const percent = Math.round(newBook.locations.percentageFromCfi(currentLoc.start.cfi) * 100);
            setProgress(percent);
            
            // Trigger a progress update to parent now that locations are available
            if (onProgressUpdateRef.current) {
              onProgressUpdateRef.current({
                currentPage: Math.round(newBook.locations.percentageFromCfi(currentLoc.start.cfi) * newBook.locations.length()) || 1,
                totalPages: newBook.locations.length() || 100,
                pageInChapter: currentLoc.start.displayed?.page || 1,
                totalInChapter: currentLoc.start.displayed?.total || 1,
                chapterTitle: currentLoc.start.label || 'Sem Título',
                currentLocationCfi: currentLoc.start.cfi,
                progressPercent: percent
              });
            }
          }
        }).catch(err => {
          console.warn("Background locations generation failed/cancelled:", err);
        });

        // Extract text + inject OpenDyslexic stylesheet into iframe
        newRendition.on('rendered', (section, view) => {
          const iframeDoc = view?.document;
          if (iframeDoc && !iframeDoc.getElementById('opendyslexic-iframe-css')) {
            const link = iframeDoc.createElement('link');
            link.id = 'opendyslexic-iframe-css';
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic.css';
            iframeDoc.head.appendChild(link);
          }

          if (iframeDoc) {
            iframeDoc.addEventListener('click', (e) => {
              const sel = iframeDoc.getSelection()?.toString();
              if (sel && sel.trim().length > 0) return;
              
              const target = e.target.closest('p, li, h1, h2, h3, h4, h5');
              if (target) {
                const text = target.innerText || target.textContent;
                if (text && text.trim().length > 0) {
                  window.dispatchEvent(new CustomEvent('tts-paragraph-clicked', { detail: { text: text.trim() } }));
                }
              }
            });

            // Robust text selection handling for mobile WebView and browsers
            const handleSelectionChange = () => {
              try {
                const sel = iframeDoc.getSelection();
                const text = sel?.toString().trim() || '';
                
                if (text && text.length > 0) {
                  if (sel.rangeCount === 0) return;
                  const range = sel.getRangeAt(0);
                  const rect = range.getBoundingClientRect();
                  const iframe = viewerRef.current?.querySelector('iframe');
                  const iframeRect = iframe ? iframe.getBoundingClientRect() : { left: 0, top: 0 };
                  
                  // Convert DOM range to EpubJS CFI range
                  let cfiRange = null;
                  try {
                    cfiRange = section.cfiFromRange(range);
                  } catch (err) {
                    console.warn("Failed to get cfiRange from range:", err);
                  }

                  // Remove previous highlight if any
                  if (activeHighlightRangeRef.current) {
                    try {
                      newRendition.annotations.remove(activeHighlightRangeRef.current, "highlight");
                    } catch (err) {}
                  }

                  // Add highlight if cfiRange is available
                  if (cfiRange) {
                    try {
                      newRendition.annotations.add("highlight", cfiRange, {}, null, "custom-highlight");
                      activeHighlightRangeRef.current = cfiRange;
                    } catch (err) {
                      console.warn("Failed to add highlight annotation:", err);
                    }
                  }

                  // Send selection info to parent
                  if (onSelectionRef.current) {
                    onSelectionRef.current({
                      text,
                      cfiRange,
                      x: iframeRect.left + rect.left + (rect.width / 2),
                      y: iframeRect.top + rect.top + window.scrollY - 10
                    });
                  }
                } else {
                  // If selection is empty, check if we just selected (prevent race condition on clearing)
                  if (justSelectedRef.current) return;

                  // If selection is empty, make sure custom selection and highlights are cleared
                  if (onSelectionRef.current) {
                    onSelectionRef.current(null);
                  }
                  if (activeHighlightRangeRef.current) {
                    try {
                      newRendition.annotations.remove(activeHighlightRangeRef.current, "highlight");
                    } catch (err) {}
                    activeHighlightRangeRef.current = null;
                  }
                }
              } catch (e) {
                console.error("Manual selection processing failed:", e);
              }
            };

            // Touch or Mouse release: clear native selection handles and native popup menu
            const handleTouchOrMouseEnd = () => {
              setTimeout(() => {
                try {
                  const sel = iframeDoc.getSelection();
                  const text = sel?.toString().trim() || '';
                  if (text && text.length > 0) {
                    // Set flag to prevent click/tap event from toggling the HUD
                    justSelectedRef.current = true;
                    setTimeout(() => {
                      justSelectedRef.current = false;
                    }, 350);

                    // Clear native selection so native copy/paste bubble disappears
                    sel.removeAllRanges();
                  }
                } catch (e) {}
              }, 80);
            };

            iframeDoc.addEventListener('selectionchange', handleSelectionChange);
            iframeDoc.addEventListener('mouseup', handleTouchOrMouseEnd);
            iframeDoc.addEventListener('touchend', handleTouchOrMouseEnd);
          }

          if (onTextExtractRef.current) {
            try {
              const text = view?.document?.body?.innerText
                || view?.document?.body?.textContent
                || '';
              if (text.trim()) onTextExtractRef.current(text.trim());
            } catch {
              // fallback: try via iframe
              try {
                const iframe = viewerRef.current?.querySelector('iframe');
                const t = iframe?.contentDocument?.body?.innerText || '';
                if (t.trim()) onTextExtractRef.current(t.trim());
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
          const cfi = location.start.cfi;
          const displayedPage = location.start.displayed?.page || 1;
          const displayedTotal = location.start.displayed?.total || 1;
          const chapterTitle = location.start.label || 'Sem Título';

          let percent = undefined;
          if (newBook.locations.length() > 0) {
            percent = Math.round(newBook.locations.percentageFromCfi(cfi) * 100);
            setProgress(percent);
          }
          
          if (bookId && cfi) {
            updateProgress(bookId, cfi, percent);
          }

          const curPage = newBook.locations.length() > 0 
            ? Math.round(newBook.locations.percentageFromCfi(cfi) * newBook.locations.length()) || 1
            : displayedPage;
          
          const totPages = newBook.locations.length() > 0
            ? newBook.locations.length() || 100
            : displayedTotal;

          if (onProgressUpdateRef.current) {
            onProgressUpdateRef.current({
              currentPage: curPage,
              totalPages: totPages,
              pageInChapter: displayedPage,
              totalInChapter: displayedTotal,
              chapterTitle,
              currentLocationCfi: cfi,
              progressPercent: percent
            });
          }

          if (bookId) {
            setTimeout(() => {
              updateProgress(bookId, cfi, percent);
            }, 500);
          }
        });

        newRendition.on('click', () => {
          setTimeout(() => {
            try {
              if (justSelectedRef.current) return;
              const iframe = viewerRef.current?.querySelector('iframe');
              const sel = iframe?.contentWindow?.getSelection();
              const text = sel?.toString().trim() || '';
              if (!text) {
                if (onSelectionRef.current) onSelectionRef.current(null);
                if (onPageClickRef.current) onPageClickRef.current();

                if (activeHighlightRangeRef.current) {
                  try {
                    newRendition.annotations.remove(activeHighlightRangeRef.current, "highlight");
                  } catch (err) {}
                  activeHighlightRangeRef.current = null;
                }
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
  }, [file, bookId]);

  // Inject styles to style EPUB text inside iframe dynamically
  useEffect(() => {
    if (!rendition) return;

    const fontVal = fontFamily === 'OpenDyslexic' ? 'OpenDyslexic, sans-serif' : fontFamily;

    const themeStyles = {
      light: {
        body: {
          background: '#ffffff !important',
          color: '#0f172a !important',
          'font-family': `${fontVal} !important`,
          'font-size': `${fontSize}px !important`,
          'line-height': `${lineHeight} !important`,
          'letter-spacing': `${letterSpacing} !important`
        },
        'p, span, li, h1, h2, h3, h4, h5, h6, a': {
          color: '#0f172a !important'
        },
        'p': {
          'margin-bottom': `${paragraphSpacing}rem !important`
        }
      },
      dark: {
        body: {
          background: '#0f172a !important',
          color: '#f8fafc !important',
          'font-family': `${fontVal} !important`,
          'font-size': `${fontSize}px !important`,
          'line-height': `${lineHeight} !important`,
          'letter-spacing': `${letterSpacing} !important`
        },
        'p, span, li, h1, h2, h3, h4, h5, h6, a': {
          color: '#f8fafc !important'
        },
        'p': {
          'margin-bottom': `${paragraphSpacing}rem !important`
        }
      },
      night: {
        body: {
          background: '#fffbeb !important',
          color: '#451a03 !important',
          'font-family': `${fontVal} !important`,
          'font-size': `${fontSize}px !important`,
          'line-height': `${lineHeight} !important`,
          'letter-spacing': `${letterSpacing} !important`
        },
        'p, span, li, h1, h2, h3, h4, h5, h6, a': {
          color: '#451a03 !important'
        },
        'p': {
          'margin-bottom': `${paragraphSpacing}rem !important`
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
      },
      '.custom-highlight': {
        'background-color': 'rgba(99, 102, 241, 0.3) !important',
        'border-radius': '4px',
        'padding': '1px 3px',
        'box-shadow': '0 0 3px rgba(99, 102, 241, 0.3)'
      }
    });

    // Select the current theme
    rendition.themes.select(theme || 'light');
  }, [theme, rendition, fontSize, fontFamily, lineHeight, paragraphSpacing, letterSpacing]);

  // Handle external navigation (TOC/Bookmarks)
  useEffect(() => {
    if (goToLocation && rendition) {
      if (typeof goToLocation === 'string' && (goToLocation.startsWith('epubcfi') || goToLocation.includes('#') || goToLocation.includes('.'))) {
        rendition.display(goToLocation);
      } else if (typeof goToLocation === 'string') {
        rendition.display(goToLocation);
      } else if (book && book.locations && typeof goToLocation === 'number') {
        const cfi = book.locations.cfiFromPercentage(goToLocation / book.locations.length());
        rendition.display(cfi);
      }
    }
  }, [goToLocation, rendition, book]);

  // Clear selection highlight if customSelection is cleared externally
  useEffect(() => {
    if (!customSelection && activeHighlightRangeRef.current && rendition) {
      try {
        rendition.annotations.remove(activeHighlightRangeRef.current, "highlight");
      } catch (err) {}
      activeHighlightRangeRef.current = null;
    }
  }, [customSelection, rendition]);

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
      {/* HUD Mode hides this local progress bar since the main footer takes over */}
      <div style={{ display: 'none', width: '100%', padding: '0.5rem 1rem', background: 'var(--bg-secondary)', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
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

      {/* Left/Right click hotspots or manual footer buttons when HUD is inactive */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}>
        <button className="btn-secondary" onClick={prev}>← Anterior</button>
        <button className="btn-secondary" onClick={next}>Próxima →</button>
      </div>
    </div>
  );
}
