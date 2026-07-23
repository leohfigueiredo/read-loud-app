import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { updateProgress } from '../../services/storage';

export default function FlowingPdfReader({ 
  file, 
  metadata, 
  onTextExtract, 
  bookId,
  fontSize,
  fontFamily,
  lineHeight,
  paragraphSpacing,
  letterSpacing,
  goToLocation,
  onProgressUpdate
}) {
  const [textParagraphs, setTextParagraphs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setProgress] = useState(metadata.progressPercent || 0);
  const contentRef = useRef(null);

  useEffect(() => {
    async function extractText() {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const paragraphs = [];
        
        let fullText = "";

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          
          let lastY = -1;
          let currentParagraph = "";

          textContent.items.forEach((item) => {
             if (lastY !== item.transform[5] && currentParagraph.length > 0) {
                 const distance = Math.abs(lastY - item.transform[5]);
                 if (distance > 20) { 
                    paragraphs.push(currentParagraph.trim());
                    fullText += currentParagraph.trim() + "\n\n";
                    currentParagraph = "";
                 } else {
                    currentParagraph += " ";
                 }
             }
             currentParagraph += item.str;
             lastY = item.transform[5];
          });
          
          if (currentParagraph.trim().length > 0) {
             paragraphs.push(currentParagraph.trim());
             fullText += currentParagraph.trim() + "\n\n";
          }
        }
        
        setTextParagraphs(paragraphs);
        setLoading(false);
        if (onTextExtract) {
           onTextExtract(fullText);
        }
      } catch (err) {
        console.error("Failed to extract flowing text", err);
        setLoading(false);
      }
    }

    if (file) extractText();
  }, [file, onTextExtract]);

  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const percent = (scrollTop / (scrollHeight - clientHeight)) * 100;
    const percentRounded = Math.round(percent) || 0;
    setProgress(percentRounded);

    // Calculate estimated pages based on clientHeight (1 viewport = 1 page)
    const totalEstPages = Math.ceil(scrollHeight / clientHeight) || 1;
    const currentEstPage = Math.floor(scrollTop / clientHeight) + 1;

    if (onProgressUpdate) {
      onProgressUpdate({
        currentPage: currentEstPage,
        totalPages: totalEstPages,
        pageInChapter: currentEstPage,
        totalInChapter: totalEstPages,
        chapterTitle: 'Texto Fluido',
        currentLocationCfi: scrollTop,
        progressPercent: percentRounded
      });
    }
     
    if (bookId) {
      setTimeout(() => {
         updateProgress(bookId, scrollTop, percentRounded);
      }, 500);
    }
  };

  // Handle external navigation (like bookmarks)
  useEffect(() => {
    if (goToLocation !== null && goToLocation !== undefined && contentRef.current) {
      const scrollPos = parseInt(goToLocation);
      if (!isNaN(scrollPos)) {
        contentRef.current.scrollTop = scrollPos;
      }
    }
  }, [goToLocation]);

  useEffect(() => {
     if (!loading && contentRef.current && metadata.progressLocation) {
        contentRef.current.scrollTop = metadata.progressLocation;
     }
  }, [loading, metadata.progressLocation]);

  if (loading) {
     return (
       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '1rem' }}>
          <div className="loading-spinner" style={{ width: '40px', height: '40px', borderWidth: '3px', borderColor: 'var(--accent-color)', borderTopColor: 'transparent' }}></div>
          <p>Transformando PDF em Texto Fluido...</p>
       </div>
     );
  }

  const fontVal = fontFamily === 'OpenDyslexic' ? 'OpenDyslexic, sans-serif' : fontFamily;

  const handleContainerClick = (e) => {
    const sel = window.getSelection()?.toString();
    if (sel && sel.trim().length > 0) return;

    const target = e.target.closest('p');
    if (target) {
      const text = target.innerText || target.textContent;
      if (text && text.trim().length > 0) {
        window.dispatchEvent(new CustomEvent('tts-paragraph-clicked', { detail: { text: text.trim() } }));
      }
    }
  };

  return (
    <div className="flowing-pdf-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div 
        ref={contentRef}
        onScroll={handleScroll}
        onClick={handleContainerClick}
        style={{ 
          flex: 1, 
          padding: '2rem 10%', 
          overflowY: 'auto', 
          lineHeight: lineHeight, 
          fontSize: `${fontSize}px`, 
          fontFamily: fontVal,
          letterSpacing: letterSpacing,
          textAlign: 'justify', 
          WebkitOverflowScrolling: 'touch' 
        }}
      >
         {textParagraphs.map((p, i) => (
            <p key={i} style={{ marginBottom: `${paragraphSpacing}rem` }}>{p}</p>
         ))}
      </div>
    </div>
  );
}
