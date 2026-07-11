import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { saveBook } from '../../services/storage';

export default function FlowingPdfReader({ file, metadata, onTextExtract, bookId }) {
  const [textParagraphs, setTextParagraphs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(metadata.progressPercent || 0);
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

  const handleProgressChange = (e) => {
    const percent = parseInt(e.target.value);
    setProgress(percent);
    if (contentRef.current) {
      const { scrollHeight, clientHeight } = contentRef.current;
      contentRef.current.scrollTop = (percent / 100) * (scrollHeight - clientHeight);
    }
  };

  const handleScroll = (_e) => {
     if (!contentRef.current) return;
     const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
     const percent = (scrollTop / (scrollHeight - clientHeight)) * 100;
     const percentRounded = Math.round(percent) || 0;
     setProgress(percentRounded);
     
     if (bookId) {
        setTimeout(() => {
           saveBook(file, bookId, {
              ...metadata,
              progressPercent: percentRounded,
              progressLocation: scrollTop
           });
        }, 500);
     }
  };

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

  return (
    <div className="flowing-pdf-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      <div className="reader-progress-bar" style={{ width: '100%', padding: '0.5rem 1rem', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
         <input 
           type="range" 
           min="0" 
           max="100" 
           value={progress} 
           onChange={handleProgressChange}
           style={{ flex: 1, accentColor: 'var(--accent-color)', cursor: 'pointer' }}
           disabled={loading}
           title="Arraste para rolar a página"
         />
         <span style={{ fontSize: '0.85rem', fontWeight: 'bold', minWidth: '60px', textAlign: 'right' }}>{progress}%</span>
      </div>
      
      <div 
        ref={contentRef}
        onScroll={handleScroll}
        style={{ flex: 1, padding: '2rem 10%', overflowY: 'auto', lineHeight: '1.8', fontSize: '1.2rem', textAlign: 'justify', WebkitOverflowScrolling: 'touch' }}
      >
         {textParagraphs.map((p, i) => (
            <p key={i} style={{ marginBottom: '1.5rem' }}>{p}</p>
         ))}
      </div>
    </div>
  );
}
