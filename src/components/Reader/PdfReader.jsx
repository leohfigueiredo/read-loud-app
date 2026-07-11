import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { saveBook } from '../../services/storage';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function PdfReader({ file, metadata, onTextExtract, bookId, theme }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(parseInt(metadata.progressLocation) || 1);
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const pendingDir = useRef(null);
  const touchStartRef = useRef(null);
  // Keep a ref that's always current for use in touch handlers
  const pageRef = useRef(pageNumber);
  const numPagesRef = useRef(numPages);
  useEffect(() => { pageRef.current = pageNumber; }, [pageNumber]);
  useEffect(() => { numPagesRef.current = numPages; }, [numPages]);

  const progressPercent = numPages ? Math.round((pageNumber / numPages) * 100) : 0;

  // Real page-flip animation using CSS 3D transforms
  const animatePageFlip = (dir) => {
    if (!wrapperRef.current) return;
    const el = wrapperRef.current;
    const origin = dir === 'next' ? 'left center' : 'right center';
    const rotateStart = dir === 'next' ? 'rotateY(-25deg)' : 'rotateY(25deg)';
    el.style.transformOrigin = origin;
    el.animate(
      [
        { transform: rotateStart, opacity: 0.4, filter: 'brightness(0.7)' },
        { transform: 'rotateY(0deg)', opacity: 1, filter: 'brightness(1)' }
      ],
      { duration: 350, easing: 'ease-out', fill: 'forwards' }
    );
  };

  const goTo = (newPage, dir) => {
    const pages = numPagesRef.current;
    if (!pages) return;
    const clamped = Math.max(1, Math.min(newPage, pages));
    if (clamped === pageRef.current) return;
    pendingDir.current = dir;
    setPageNumber(clamped);
  };

  // Save progress
  useEffect(() => {
    if (numPages && bookId) {
      const timer = setTimeout(() => {
        saveBook(file, bookId, {
          ...metadata,
          progressLocation: pageNumber,
          progressPercent
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pageNumber, numPages, progressPercent, bookId, file, metadata]);

  // Load PDF
  useEffect(() => {
    async function loadPdf() {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err) {
        console.error('Error loading PDF', err);
      }
    }
    if (file) loadPdf();
  }, [file]);

  // Render page + trigger animation AFTER render
  useEffect(() => {
    async function renderPage() {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;

        // Page flip animation AFTER render
        if (pendingDir.current) {
          animatePageFlip(pendingDir.current);
          pendingDir.current = null;
        }

        if (onTextExtract) {
          const textContent = await page.getTextContent();
          onTextExtract(textContent.items.map(i => i.str).join(' '));
        }
      } catch (err) {
        console.error('Error rendering page', err);
      }
    }
    renderPage();
  }, [pdfDoc, pageNumber, onTextExtract]);

  // Touch swipe
  const onTouchStart = (e) => { touchStartRef.current = e.targetTouches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartRef.current == null) return;
    const dist = touchStartRef.current - e.changedTouches[0].clientX;
    if (dist > 50) goTo(pageRef.current + 1, 'next');
    else if (dist < -50) goTo(pageRef.current - 1, 'prev');
    touchStartRef.current = null;
  };

  return (
    <div
      className="pdf-reader-container animate-fade-in"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', perspective: '1200px' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress bar */}
      <div style={{ width: '100%', padding: '0.5rem 1rem', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <input
          type="range"
          min="1"
          max={numPages || 1}
          value={pageNumber}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            goTo(val, val > pageRef.current ? 'next' : 'prev');
          }}
          style={{ flex: 1, accentColor: 'var(--accent-color)', cursor: 'pointer' }}
          disabled={!numPages}
        />
        <span style={{ fontSize: '0.85rem', fontWeight: 'bold', minWidth: '80px', textAlign: 'right' }}>
          {pageNumber}/{numPages || '?'} · {progressPercent}%
        </span>
      </div>

      {/* Canvas with 3D perspective wrapper */}
      <div ref={wrapperRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', transformStyle: 'preserve-3d' }}>
        <canvas 
          ref={canvasRef} 
          style={{ 
            maxWidth: '100%', 
            height: 'auto', 
            marginTop: '1rem', 
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            filter: theme === 'dark' ? 'invert(0.9) hue-rotate(180deg)' : theme === 'night' ? 'sepia(0.6) contrast(0.9) brightness(0.95)' : 'none'
          }} 
        />
      </div>

      {/* Navigation buttons */}
      <div style={{ marginTop: '1rem', marginBottom: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <button
          className="btn-secondary"
          disabled={pageNumber <= 1}
          onClick={() => goTo(pageNumber - 1, 'prev')}
          style={{ padding: '0.6rem 1.5rem', fontSize: '1rem' }}
        >
          ← Anterior
        </button>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Página {pageNumber} de {numPages || '...'}
        </span>
        <button
          className="btn-secondary"
          disabled={!numPages || pageNumber >= numPages}
          onClick={() => goTo(pageNumber + 1, 'next')}
          style={{ padding: '0.6rem 1.5rem', fontSize: '1rem' }}
        >
          Próxima →
        </button>
      </div>
    </div>
  );
}
