import { useState, useEffect } from 'react';
import { Languages, Book, Volume2, X, Bookmark, Play } from 'lucide-react';
import { translateText, explainWord } from '../../services/gemini';
import './SelectionMenu.css';

export default function SelectionMenu({ onReadAloud, customSelection, onClearSelection, onSaveNote }) {
  const [selection, setSelection] = useState({ text: '', x: 0, y: 0 });
  const [activePanel, setActivePanel] = useState(null);
  const [panelResult, setPanelResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (customSelection) {
      setSelection(customSelection);
      setActivePanel(null);
    } else {
      setSelection({ text: '', x: 0, y: 0 });
    }
  }, [customSelection]);

  useEffect(() => {
    const handleSelection = (e) => {
      if (e.target.closest('.selection-menu-wrapper')) return;
      setTimeout(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text && text.length > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelection({
            text,
            x: rect.left + (rect.width / 2),
            y: rect.top + window.scrollY - 10
          });
          setActivePanel(null);
        } else {
          // If we have customSelection (from iframe), do NOT clear it from here
          // unless the user clicks outside the reader content.
          if (customSelection) {
            if (!e.target.closest('.reader-content') && !e.target.closest('.selection-menu-wrapper')) {
              setSelection({ text: '', x: 0, y: 0 });
              setActivePanel(null);
              if (onClearSelection) onClearSelection();
            }
            return;
          }

          if (!e.target.closest('.selection-menu-wrapper')) {
            setSelection({ text: '', x: 0, y: 0 });
            setActivePanel(null);
            if (onClearSelection) onClearSelection();
          }
        }
      }, 100);
    };

    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('touchend', handleSelection);
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
    };
  }, [onClearSelection, customSelection]);

  const handleTranslate = async () => {
    setActivePanel('translate');
    setIsLoading(true);
    setPanelResult('');
    try {
      const result = await translateText(selection.text);
      setPanelResult(result);
    } catch (err) {
      setPanelResult('Erro: ' + err.message + ' (Verifique sua API Key nas configurações)');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplain = async () => {
    setActivePanel('explain');
    setIsLoading(true);
    setPanelResult('');
    try {
      const isSentence = selection.text.trim().split(/\s+/).length > 2;
      const result = isSentence 
        ? await explainWord(selection.text, "A user selected this paragraph or sentence to be explained/simplified.")
        : await explainWord(selection.text, "A user selected this word.");
      setPanelResult(result);
    } catch (err) {
      setPanelResult('Erro: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReadFromHere = () => {
    // 1. Clear any active selected-text-only playback
    onReadAloud('');
    // 2. Dispatch custom event to seek and start playback at selected text
    window.dispatchEvent(new CustomEvent('tts-paragraph-clicked', { 
      detail: { text: selection.text, play: true } 
    }));
    // 3. Clear selection menu
    if (onClearSelection) onClearSelection();
  };

  if (!selection.text) return null;

  return (
    <div 
      className="selection-menu-wrapper animate-fade-in"
      style={{ left: `${selection.x}px`, top: `${selection.y}px` }}
    >
      {!activePanel ? (
        <div className="selection-toolbar glass-panel">
          <button className="icon-btn tooltip" onClick={handleTranslate} title="Traduzir via IA">
            <Languages size={18} />
          </button>
          <button className="icon-btn tooltip" onClick={handleExplain} title="Dicionário IA">
            <Book size={18} />
          </button>
          <button className="icon-btn tooltip" onClick={() => onReadAloud(selection.text)} title="Ler Seleção">
            <Volume2 size={18} />
          </button>
          <button className="icon-btn tooltip" onClick={handleReadFromHere} title="Ler a partir daqui">
            <Play size={18} />
          </button>
          <button className="icon-btn tooltip" onClick={() => { if (onSaveNote) onSaveNote(selection.text); }} title="Destacar e Criar Nota">
            <Bookmark size={18} />
          </button>
        </div>
      ) : (
        <div className="selection-panel glass-panel">
          <div className="panel-header">
            <h4>{activePanel === 'translate' ? 'Tradução Gemini' : 'Dicionário Gemini'}</h4>
            <button className="icon-btn" onClick={() => setActivePanel(null)}>
              <X size={16} />
            </button>
          </div>
          <div className="panel-content">
            {isLoading ? (
               <div className="loading-dots">Consultando IA...</div>
            ) : (
               <p>{panelResult}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
