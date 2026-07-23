import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PenTool, Eraser, Highlighter, Type, Trash2, Save } from 'lucide-react';
import { saveNotebookData, getNotebookData } from '../../services/storage';
import './Notebook.css';

export default function Notebook() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen'); // pen, highlighter, eraser, text
  const [color, setColor] = useState('#000000');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textSnippet, setTextSnippet] = useState("");

  const colors = ['#000000', '#dc2626', '#2563eb', '#16a34a', '#eab308'];

  useEffect(() => {
    // Initialize canvas size and load saved data
    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    // Set internal resolution to match display size exactly to prevent blur
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Load saved drawing
    getNotebookData().then(dataUrl => {
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = dataUrl;
      }
    });

    const handleResize = () => {
      // In a real robust app, we'd redraw the saved image here.
      // For simplicity, we just keep the canvas static or save before resize.
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    saveNotebookData(dataUrl);
  };

  const getPointerPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    if (tool === 'text') return;
    
    setIsDrawing(true);
    const { x, y } = getPointerPos(e);
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Apply pressure if available (default to 0.5 if not supported)
    const pressure = e.pressure !== undefined && e.pressure !== 0 ? e.pressure : 0.5;
    applyToolSettings(ctx, pressure);
  };

  const draw = (e) => {
    if (!isDrawing || tool === 'text') return;
    
    const { x, y } = getPointerPos(e);
    const ctx = canvasRef.current.getContext('2d');
    
    const pressure = e.pressure !== undefined && e.pressure !== 0 ? e.pressure : 0.5;
    applyToolSettings(ctx, pressure);
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const ctx = canvasRef.current.getContext('2d');
      ctx.closePath();
      saveCanvas(); // Auto-save after stroke
    }
  };

  const applyToolSettings = (ctx, pressure) => {
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20 + (pressure * 20); // Big eraser
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color + '80'; // Add 50% opacity hex
      ctx.lineWidth = 15 + (pressure * 10);
    } else {
      // Pen
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1 + (pressure * 4); // Stylus pressure variation
    }
  };

  const clearCanvas = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o caderno?')) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveCanvas();
    }
  };

  const handleStampText = () => {
    if (!textSnippet.trim()) {
      setShowTextInput(false);
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.font = '18px "Inter", sans-serif';
    
    // Simple text wrapping stamp at the center
    const lines = textSnippet.split('\\n');
    let y = canvas.height / 3;
    const x = 50;
    
    lines.forEach(line => {
      // Very basic wrapping
      const words = line.split(' ');
      let currentLine = '';
      
      words.forEach(word => {
        const testLine = currentLine + word + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > canvas.width - 100 && currentLine !== '') {
          ctx.fillText(currentLine, x, y);
          currentLine = word + ' ';
          y += 24;
        } else {
          currentLine = testLine;
        }
      });
      ctx.fillText(currentLine, x, y);
      y += 24;
    });
    
    setShowTextInput(false);
    setTextSnippet("");
    saveCanvas();
  };

  return (
    <div className="notebook-container">
      <header className="notebook-header">
        <div className="notebook-header-left">
          <button className="icon-btn" style={{ background: 'var(--panel-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem', cursor: 'pointer' }} onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </button>
          <h2>Caderno de Anotações (Stylus)</h2>
        </div>
        
        <div className="notebook-tools">
          <button className={`tool-btn ${tool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="Caneta">
            <PenTool size={20} />
          </button>
          <button className={`tool-btn ${tool === 'highlighter' ? 'active' : ''}`} onClick={() => setTool('highlighter')} title="Marca Texto">
            <Highlighter size={20} />
          </button>
          <button className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`} onClick={() => setTool('eraser')} title="Borracha">
            <Eraser size={20} />
          </button>
          
          <div className="color-picker">
            {colors.map(c => (
              <button 
                key={c}
                className={`color-btn ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          
          <div style={{ width: '1px', height: '24px', background: '#ccc', margin: '0 0.5rem' }}></div>
          
          <button className="tool-btn" onClick={() => { setTool('text'); setShowTextInput(true); }} title="Colar Trecho (Texto)">
            <Type size={20} />
          </button>
          
          <button className="tool-btn text-danger" onClick={clearCanvas} title="Limpar Tela" style={{ color: '#ef4444' }}>
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      <div className="notebook-canvas-area" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerOut={stopDrawing}
          onPointerCancel={stopDrawing}
        />
        
        {showTextInput && (
          <div className="text-input-overlay">
            <h3>Colar Trecho de Livro</h3>
            <textarea 
              autoFocus
              placeholder="Cole aqui um trecho interessante que você copiou do livro..."
              value={textSnippet}
              onChange={(e) => setTextSnippet(e.target.value)}
            />
            <div className="text-input-actions">
              <button className="btn-cancel" onClick={() => setShowTextInput(false)}>Cancelar</button>
              <button className="btn-stamp" onClick={handleStampText}>Estampar no Caderno</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
