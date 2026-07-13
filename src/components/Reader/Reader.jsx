import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Menu, Type, Maximize, Minimize2, Sparkles, Bookmark, Sliders, Sun, BookOpen, Trash2 } from 'lucide-react';
import { getBook, settingsDB } from '../../services/storage';
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

  // HUD & UI states
  const [hudActive, setHudActive] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('toc'); // toc | bookmarks | notes
  const [layoutSettingsOpen, setLayoutSettingsOpen] = useState(false);

  // Typography & Brightness states
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [lineHeight, setLineHeight] = useState(1.6);
  const [paragraphSpacing, setParagraphSpacing] = useState(1.5);
  const [letterSpacing, setLetterSpacing] = useState('normal');
  const [brightness, setBrightness] = useState(100); // 20 to 100

  // Bookmarks, Notes, and TOC states
  const [bookmarks, setBookmarks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [toc, setToc] = useState([]);
  const [goToLocation, setGoToLocation] = useState(null);

  const [progressInfo, setProgressInfo] = useState({
    currentPage: 1,
    totalPages: 1,
    pageInChapter: 1,
    totalInChapter: 1,
    chapterTitle: '',
    currentLocationCfi: null,
    progressPercent: 0
  });

  // Load preferences, bookmarks, and notes on startup
  useEffect(() => {
    settingsDB.getItem('reader_font_size').then(v => v && setFontSize(v));
    settingsDB.getItem('reader_font_family').then(v => v && setFontFamily(v));
    settingsDB.getItem('reader_line_height').then(v => v && setLineHeight(v));
    settingsDB.getItem('reader_paragraph_spacing').then(v => v && setParagraphSpacing(v));
    settingsDB.getItem('reader_letter_spacing').then(v => v && setLetterSpacing(v));
    settingsDB.getItem('reader_brightness').then(v => v !== null && setBrightness(v));

    if (id) {
      settingsDB.getItem(`bookmarks_${id}`).then(b => b && setBookmarks(b));
      settingsDB.getItem(`notes_${id}`).then(n => n && setNotes(n));
    }

    // Load OpenDyslexic stylesheet dynamically
    if (!document.getElementById('opendyslexic-cdn')) {
      const link = document.createElement('link');
      link.id = 'opendyslexic-cdn';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic.css';
      document.head.appendChild(link);
    }
  }, [id]);

  // Apply layout changes helpers
  const handleFontSizeChange = (val) => { setFontSize(val); settingsDB.setItem('reader_font_size', val); };
  const handleFontFamilyChange = (val) => { setFontFamily(val); settingsDB.setItem('reader_font_family', val); };
  const handleLineHeightChange = (val) => { setLineHeight(val); settingsDB.setItem('reader_line_height', val); };
  const handleParagraphSpacingChange = (val) => { setParagraphSpacing(val); settingsDB.setItem('reader_paragraph_spacing', val); };
  const handleLetterSpacingChange = (val) => { setLetterSpacing(val); settingsDB.setItem('reader_letter_spacing', val); };
  const handleBrightnessChange = (val) => { setBrightness(val); settingsDB.setItem('reader_brightness', val); };

  const handleToggleBookmark = () => {
    const location = progressInfo.currentLocationCfi || progressInfo.currentPage;
    const isBookmarked = bookmarks.some(b => b.location === location);
    let newBookmarks = [];
    if (isBookmarked) {
      newBookmarks = bookmarks.filter(b => b.location !== location);
    } else {
      const label = bookData.metadata.type === 'epub'
        ? `${progressInfo.chapterTitle || 'Capítulo'} (Local ${typeof location === 'string' ? location.substring(0, 10) : location})`
        : `Página ${location}`;
      newBookmarks = [...bookmarks, { location, label, timestamp: Date.now() }];
    }
    setBookmarks(newBookmarks);
    settingsDB.setItem(`bookmarks_${id}`, newBookmarks);
  };

  const handleAddNote = (selectedText) => {
    const location = progressInfo.currentLocationCfi || progressInfo.currentPage;
    const textPrompt = prompt("Adicione um comentário ou nota para este trecho destacado:");
    if (textPrompt !== null) {
      const newNotes = [...notes, {
        id: Date.now().toString(),
        location,
        selectedText,
        noteText: textPrompt,
        timestamp: Date.now()
      }];
      setNotes(newNotes);
      settingsDB.setItem(`notes_${id}`, newNotes);
    }
  };

  const handleDeleteNote = (noteId) => {
    const newNotes = notes.filter(n => n.id !== noteId);
    setNotes(newNotes);
    settingsDB.setItem(`notes_${id}`, newNotes);
  };

  const toggleCleanMode = () => {
    if (!cleanMode) {
      setCleanMode(true);
      setHudActive(false);
      try {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(error => console.debug('Fullscreen request failed:', error));
        }
      } catch(error) {
        console.debug('Fullscreen toggle error:', error);
      }
    } else {
      setCleanMode(false);
      setHudActive(true);
      try {
        if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(error => console.debug('Exit fullscreen failed:', error));
        }
      } catch(error) {
        console.debug('Exit fullscreen error:', error);
      }
    }
  };

  const handlePageClick = (e) => {
    // Prevent toggling HUD if user clicks inside UI panels, buttons or overlays
    if (
      e.target.closest('.reader-hud-header') ||
      e.target.closest('.reader-hud-footer') ||
      e.target.closest('.layout-settings-panel') ||
      e.target.closest('.reader-sidebar') ||
      e.target.closest('.selection-menu-wrapper') ||
      e.target.closest('.ai-control-panel') ||
      e.target.closest('.exit-clean-btn') ||
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('select')
    ) {
      return;
    }

    // Ignore if there is selected text
    const selected = window.getSelection()?.toString();
    if (selected && selected.trim().length > 0) {
      return;
    }

    setHudActive(prev => !prev);
    setLayoutSettingsOpen(false);
  };

  const handleReadAloud = (text) => {
    setTtsText(text);
  };

  const handleProgressUpdate = (info) => {
    setProgressInfo(prev => ({ ...prev, ...info }));
  };

  const handleTocExtract = (tocList) => {
    setToc(tocList);
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

  const currentCfi = progressInfo.currentLocationCfi || progressInfo.currentPage;
  const isCurrentBookmarked = bookmarks.some(b => b.location === currentCfi);

  return (
    <div className={`reader-wrapper ${hudActive ? 'hud-mode-active' : ''} ${cleanMode ? 'clean-mode' : ''}`}>
      {/* Screen Brightness Dimming Overlay */}
      <div className="brightness-overlay" style={{ opacity: (100 - brightness) / 100 }} />

      {/* Heads-Up Display: Header Bar */}
      {hudActive && !cleanMode && (
        <nav className="reader-hud-header glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button className="icon-btn" onClick={() => navigate('/')} title="Voltar à Estante">
              <ArrowLeft size={22} />
            </button>
            <button className="icon-btn" onClick={() => setSidebarOpen(true)} title="Índice, Marcadores e Notas">
              <BookOpen size={20} />
            </button>
          </div>

          <span className="reader-title">{bookData.metadata.title}</span>

          <div className="nav-actions">
            {bookData.metadata.type === 'pdf' && (
              <button 
                className="icon-btn" 
                onClick={() => setPdfMode(pdfMode === 'canvas' ? 'flowing' : 'canvas')}
                title={pdfMode === 'canvas' ? 'Ativar Modo Texto Fluido' : 'Voltar para Páginas Originais'}
                style={{ background: pdfMode === 'flowing' ? 'var(--accent-color)' : 'transparent', color: pdfMode === 'flowing' ? 'white' : 'var(--text-color)' }}
              >
                <Type size={18} />
              </button>
            )}
            <button className={`icon-btn ${isCurrentBookmarked ? 'bookmark-active' : ''}`} onClick={handleToggleBookmark} title="Marcar esta Página">
              <Bookmark size={20} fill={isCurrentBookmarked ? 'var(--accent-color)' : 'none'} style={{ color: isCurrentBookmarked ? 'var(--accent-color)' : 'inherit' }} />
            </button>
            <button className="icon-btn" onClick={() => setLayoutSettingsOpen(!layoutSettingsOpen)} title="Configurações de Layout/Fonte">
              <Sliders size={20} />
            </button>
            <button className="icon-btn" title="Tela Cheia" onClick={toggleCleanMode}>
              <Maximize size={22} />
            </button>
            <button className="icon-btn" title="Opções Gerais" onClick={() => setShowSettings(true)}>
              <Menu size={22} />
            </button>

            {/* AI Floating Action Button */}
            <button 
              className="ai-fab" 
              onClick={() => setShowAIControl(!showAIControl)}
              title="Assistente de IA"
            >
              <Sparkles size={24} />
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
      )}

      {/* Sliding Sidebar for Toc, Bookmarks, and Notes */}
      {sidebarOpen && (
        <div className="sidebar-overlay animate-fade-in" onClick={() => setSidebarOpen(false)}>
          <div className="reader-sidebar glass-panel animate-slide-right" onClick={e => e.stopPropagation()}>
            <div className="sidebar-tabs">
              <button className={`tab-btn ${sidebarTab === 'toc' ? 'active' : ''}`} onClick={() => setSidebarTab('toc')}>Índice</button>
              <button className={`tab-btn ${sidebarTab === 'bookmarks' ? 'active' : ''}`} onClick={() => setSidebarTab('bookmarks')}>Marcadores</button>
              <button className={`tab-btn ${sidebarTab === 'notes' ? 'active' : ''}`} onClick={() => setSidebarTab('notes')}>Notas</button>
            </div>
            
            <div className="sidebar-content">
              {sidebarTab === 'toc' && (
                <div className="toc-list">
                  <h3>Conteúdo</h3>
                  {toc.length === 0 ? (
                    <p className="empty-msg">Nenhum índice disponível.</p>
                  ) : toc.map((item, i) => (
                    <button key={i} className="sidebar-item" onClick={() => { setGoToLocation(item.location); setSidebarOpen(false); setHudActive(false); }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {sidebarTab === 'bookmarks' && (
                <div className="bookmarks-list">
                  <h3>Marcadores Salvos</h3>
                  {bookmarks.length === 0 ? (
                    <p className="empty-msg">Nenhum marcador criado nesta leitura.</p>
                  ) : bookmarks.map((item, i) => (
                    <button key={i} className="sidebar-item" onClick={() => { setGoToLocation(item.location); setSidebarOpen(false); setHudActive(false); }}>
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {sidebarTab === 'notes' && (
                <div className="notes-list">
                  <h3>Notas e Destaques</h3>
                  {notes.length === 0 ? (
                    <p className="empty-msg">Nenhuma nota criada. Selecione um trecho de texto no livro para destacar.</p>
                  ) : notes.map((item) => (
                    <div key={item.id} className="note-card">
                      <p className="note-quote">“{item.selectedText}”</p>
                      <p className="note-body">{item.noteText}</p>
                      <div className="note-footer">
                        <span>Local: {typeof item.location === 'string' ? item.location.substring(0, 10) : item.location}</span>
                        <button className="note-delete" onClick={() => handleDeleteNote(item.id)} title="Excluir Nota">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Typography and Layout Setting panel */}
      {layoutSettingsOpen && hudActive && (
        <div className="layout-settings-panel glass-panel animate-fade-in">
          <div className="settings-row">
            <label>Tipo de Letra:</label>
            <select value={fontFamily} onChange={e => handleFontFamilyChange(e.target.value)}>
              <option value="sans-serif">Sans-Serif (Moderna)</option>
              <option value="serif">Serif (Clássica)</option>
              <option value="OpenDyslexic">OpenDyslexic (Acessível)</option>
              <option value="monospace">Monoespaçada</option>
            </select>
          </div>

          <div className="settings-row">
            <label>Tamanho da Fonte: {fontSize}px</label>
            <div style={{ display: 'flex', gap: '0.5rem', width: '60%' }}>
              <button className="btn-secondary" style={{ flex: 1, padding: '0.2rem' }} onClick={() => handleFontSizeChange(Math.max(12, fontSize - 2))}>A-</button>
              <button className="btn-secondary" style={{ flex: 1, padding: '0.2rem' }} onClick={() => handleFontSizeChange(Math.min(32, fontSize + 2))}>A+</button>
            </div>
          </div>

          <div className="settings-row">
            <label>Espaçamento de Linha:</label>
            <select value={lineHeight} onChange={e => handleLineHeightChange(parseFloat(e.target.value))}>
              <option value="1.2">Compacto (1.2)</option>
              <option value="1.5">Padrão (1.5)</option>
              <option value="1.8">Largo (1.8)</option>
              <option value="2.1">Extra Largo (2.1)</option>
            </select>
          </div>

          <div className="settings-row">
            <label>Ajuste de Parágrafo:</label>
            <select value={paragraphSpacing} onChange={e => handleParagraphSpacingChange(parseFloat(e.target.value))}>
              <option value="0.8">Junto (0.8rem)</option>
              <option value="1.5">Normal (1.5rem)</option>
              <option value="2.2">Afastado (2.2rem)</option>
              <option value="3.0">Espaçoso (3.0rem)</option>
            </select>
          </div>

          <div className="settings-row">
            <label>Ajuste de Letra:</label>
            <select value={letterSpacing} onChange={e => handleLetterSpacingChange(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="0.05em">Afastado (0.05em)</option>
              <option value="0.1em">Largo (0.1em)</option>
            </select>
          </div>

          <div className="settings-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Sun size={16} /> Brilho de Leitura:</label>
            <input 
              type="range" 
              min="20" 
              max="100" 
              value={brightness} 
              onChange={e => handleBrightnessChange(parseInt(e.target.value))}
              style={{ width: '60%', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}
      
      {/* Click area to toggle HUD */}
      <main className="reader-content" onClick={handlePageClick}>
        {bookData.metadata.type === 'pdf' ? (
          pdfMode === 'canvas' ? (
            <PdfReader 
              file={bookData.file} 
              metadata={bookData.metadata} 
              bookId={id} 
              onTextExtract={setCurrentPageText} 
              onToggleUI={toggleCleanMode} 
              theme={theme}
              goToLocation={goToLocation}
              onTocExtract={handleTocExtract}
              onProgressUpdate={handleProgressUpdate}
            />
          ) : (
            <FlowingPdfReader 
              file={bookData.file} 
              metadata={bookData.metadata} 
              bookId={id} 
              onTextExtract={setCurrentPageText} 
              fontSize={fontSize}
              fontFamily={fontFamily}
              lineHeight={lineHeight}
              paragraphSpacing={paragraphSpacing}
              letterSpacing={letterSpacing}
              goToLocation={goToLocation}
              onProgressUpdate={handleProgressUpdate}
            />
          )
        ) : (
          <EpubReader 
            file={bookData.file} 
            metadata={bookData.metadata} 
            bookId={id} 
            onTextExtract={setCurrentPageText} 
            onToggleUI={toggleCleanMode} 
            theme={theme} 
            onSelection={setCustomSelection}
            fontSize={fontSize}
            fontFamily={fontFamily}
            lineHeight={lineHeight}
            paragraphSpacing={paragraphSpacing}
            letterSpacing={letterSpacing}
            goToLocation={goToLocation}
            onTocExtract={handleTocExtract}
            onProgressUpdate={handleProgressUpdate}
            onPageClick={() => setHudActive(prev => !prev)}
          />
        )}
      </main>
      
      {/* Heads-Up Display: Footer Bar */}
      {hudActive && !cleanMode && (
        <footer className="reader-hud-footer glass-panel">
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '1rem' }}>
              <input
                type="range"
                min="1"
                max={progressInfo.totalPages || 100}
                value={progressInfo.currentPage || 1}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  setGoToLocation(val);
                }}
                style={{ flex: 1, accentColor: 'var(--accent-color)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', minWidth: '40px', textAlign: 'right' }}>{progressInfo.progressPercent}%</span>
            </div>
            
            <div className="footer-details" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', alignItems: 'center' }}>
              <span className="chapter-title" style={{ fontWeight: '500' }}>{progressInfo.chapterTitle || 'Início'}</span>
              <span className="page-stats">
                Página {progressInfo.currentPage} de {progressInfo.totalPages}
                {bookData.metadata.type === 'epub' && progressInfo.totalInChapter > 1 && (
                  ` • ${progressInfo.totalInChapter - progressInfo.pageInChapter} pág. restantes no capítulo`
                )}
              </span>
            </div>
          </div>
        </footer>
      )}
      
      {!cleanMode && (
         <>
            <SelectionMenu 
              onReadAloud={handleReadAloud} 
              customSelection={customSelection} 
              onClearSelection={() => setCustomSelection(null)}
              onSaveNote={handleAddNote}
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