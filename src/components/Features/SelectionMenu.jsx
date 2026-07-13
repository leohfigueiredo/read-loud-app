import { useState, useEffect } from 'react';
import { Languages, Book, Volume2, X } from 'lucide-react';
import { translateText, explainWord } from '../../services/gemini';
import './SelectionMenu.css';

export default function SelectionMenu({ onReadAloud, customSelection, onClearSelection }) {
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
  }, [onClearSelection]);

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

  if (!selection.text) return null;

  return (
    <div 
      className="selection-menu-wrapper animate-fade-in"
      style={{ left: selection.x, top: selection.y }}
    >
      {!activePanel ? (
        <div className="selection-toolbar glass-panel">
          <button className="icon-btn tooltip" onClick={handleTranslate} title="Traduzir via IA">
            <Languages size={18} />
          </button>
          <button className="icon-btn tooltip" onClick={handleExplain} title="Dicionário IA">
            <Book size={18} />
          </button>
          <button className="icon-btn tooltip" onClick={() => onReadAloud(selection.text)} title="Ler em Voz Alta">
            <Volume2 size={18} />
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
