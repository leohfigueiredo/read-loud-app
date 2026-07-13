import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, Type, Maximize, Minimize2, Sparkles } from 'lucide-react';
import { getBook } from '../../services/storage';
import PdfReader from './PdfReader';
import FlowingPdfReader from './FlowingPdfReader';
import EpubReader from './EpubReader';
import TextToSpeech from '../Features/TextToSpeech';
import SelectionMenu from '../Features/SelectionMenu';
import SettingsModal from '../Features/SettingsModal';
import AIControlPanel from '../Features/AIControlPanel';
import './Reader.css';

export default function Reader({ theme, bionic, setTheme, setBionic }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bookData, setBookData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ttsText, setTtsText] = useState("");
  const [currentPageText, setCurrentPageText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [pdfMode, setPdfMode] = useState('canvas');
  const [cleanMode, setCleanMode] = useState(false);
  const [showAIControl, setShowAIControl] = useState(false);
  const [customSelection, setCustomSelection] = useState(null);

  const toggleCleanMode = () => {
    if (!cleanMode) {
      setCleanMode(true);
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(error => console.debug('Fullscreen request failed:', error));
        }
      } catch(error) {
        console.debug('Fullscreen toggle error:', error);
      }
    } else {
      setCleanMode(false);
      try {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(error => console.debug('Exit fullscreen failed:', error));
        }
      } catch(error) {
        console.debug('Exit fullscreen error:', error);
      }
    }
  };

  const handleReadAloud = (text) => {
    setTtsText(text);
  };

  useEffect(() => {
    async function load() {
      try {
        const data = await getBook(id);
        if (!data || !data.file) {
          alert('Livro não encontrado!');
          navigate('/');
          return;
        }
        setBookData(data);
      } catch (err) {
        console.error("Error loading book:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="library-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem' }}>
        <div className="loading-spinner" style={{ width: '50px', height: '50px', borderWidth: '4px', borderColor: 'var(--accent-color)', borderTopColor: 'transparent' }}></div>
        <h2>Abrindo livro...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Extraindo páginas e formatando para leitura.</p>
      </div>
    );
  }
  
  if (!bookData) return null;

  return (
    <div className={`reader-wrapper ${cleanMode ? 'clean-mode' : ''}`}>
      {!cleanMode && (
        <>
          <nav className="reader-header glass-panel">
            <button className="icon-btn" onClick={() => navigate('/')} title="Voltar à Estante">
              <ArrowLeft size={24} />
            </button>
            <span className="reader-title">{bookData.metadata.title}</span>
            <div className="nav-actions">
              {bookData.metadata.type === 'pdf' && (
                <button 
                  className="icon-btn" 
                  onClick={() => setPdfMode(pdfMode === 'canvas' ? 'flowing' : 'canvas')}
                  title={pdfMode === 'canvas' ? 'Ativar Modo Texto Fluido' : 'Voltar para Páginas Originais'}
                  style={{ marginRight: '0.5rem', background: pdfMode === 'flowing' ? 'var(--accent-color)' : 'transparent', color: pdfMode === 'flowing' ? 'white' : 'var(--text-color)' }}
                >
                  <Type size={20} />
                </button>
              )}
              <button className="icon-btn" title="Tela Cheia (Leitura Limpa)" onClick={toggleCleanMode} style={{ marginRight: '0.5rem' }}>
                <Maximize size={24} />
              </button>
              <button className="icon-btn" title="Opções de Leitura" onClick={() => setShowSettings(true)}>
                <Menu size={24} />
              </button>

              {/* AI Floating Action Button */}
              <button 
                className="ai-fab" 
                onClick={() => setShowAIControl(!showAIControl)}
                title="Assistente de IA"
              >
                <Sparkles size={28} />
              </button>

              {showAIControl && (
                <AIControlPanel 
                  bookData={bookData}
                  currentPageText={currentPageText}
                  onClose={() => setShowAIControl(false)}
                />
              )}
            </div>
          </nav>
        </>
      )}
      
      <main className="reader-content">
        {bookData.metadata.type === 'pdf' ? (
          pdfMode === 'canvas' ? (
            <PdfReader file={bookData.file} metadata={bookData.metadata} bookId={id} onTextExtract={setCurrentPageText} onToggleUI={toggleCleanMode} theme={theme} />
          ) : (
            <FlowingPdfReader file={bookData.file} metadata={bookData.metadata} bookId={id} onTextExtract={setCurrentPageText} onToggleUI={toggleCleanMode} />
          )
        ) : (
          <EpubReader file={bookData.file} metadata={bookData.metadata} bookId={id} onTextExtract={setCurrentPageText} onToggleUI={toggleCleanMode} theme={theme} onSelection={setCustomSelection} />
        )}
      </main>
      
      {!cleanMode && (
         <>
            <SelectionMenu 
              onReadAloud={handleReadAloud} 
              customSelection={customSelection} 
              onClearSelection={() => setCustomSelection(null)} 
            />
           <TextToSpeech textToRead={ttsText || currentPageText} />
         </>
      )}

      {cleanMode && (
        <button 
          className="exit-clean-btn" 
          onClick={toggleCleanMode}
          title="Sair da Leitura Limpa (Minimizar)"
        >
          <Minimize2 size={20} />
        </button>
      )}

      {showSettings && (
        <SettingsModal 
          onClose={() => setShowSettings(false)}
          theme={theme} setTheme={setTheme}
          bionic={bionic} setBionic={setBionic}
        />
      )}
    </div>
  );
}