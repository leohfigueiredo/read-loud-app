import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, BookOpen, Settings, Moon, Sun, Monitor, Trash2 } from 'lucide-react';
import { getAllBooksMetadata, saveBook, deleteBook } from '../../services/storage';
import SettingsModal from '../Features/SettingsModal';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import ePub from 'epubjs';
import './Library.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function Library({ theme, setTheme, bionic, setBionic }) {
  const [books, setBooks] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const storedBooks = await getAllBooksMetadata();
      setBooks(storedBooks);
    } catch (err) {
      console.error("Failed to load books from library", err);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevent opening the book
    if (window.confirm("Tem certeza que deseja apagar este livro da sua estante?")) {
      try {
        await deleteBook(id);
        await loadBooks();
      } catch (err) {
        console.error("Erro ao deletar", err);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isEpub = file.type === 'application/epub+zip' || file.name.toLowerCase().endsWith('.epub');

      if (!isPdf && !isEpub) {
        alert('Apenas arquivos PDF ou EPUB são suportados.');
        setIsUploading(false);
        return;
      }

      let coverDataUrl = null;
      const arrayBuffer = await file.arrayBuffer();

      if (isPdf) {
        try {
          const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          const page = await pdfDoc.getPage(1);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport }).promise;
          coverDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        } catch (err) { console.warn("Erro ao extrair capa do PDF", err); }
      } else if (isEpub) {
        try {
          const book = ePub(arrayBuffer);
          const coverUrl = await book.coverUrl();
          if (coverUrl) {
             const response = await fetch(coverUrl);
             const blob = await response.blob();
             coverDataUrl = await new Promise((resolve) => {
               const reader = new FileReader();
               reader.onloadend = () => resolve(reader.result);
               reader.readAsDataURL(blob);
             });
          }
        } catch (err) { console.warn("Erro ao extrair capa do EPUB", err); }
      }

      const id = Date.now().toString();
      const metadata = {
        title: file.name.replace(/\.[^/.]+$/, ""), // Strip extension
        type: isPdf ? 'pdf' : 'epub',
        size: file.size,
        cover: coverDataUrl
      };

      await saveBook(file, id, metadata);
      await loadBooks();
    } catch (err) {
      console.error("Upload error:", err);
      alert('Erro ao salvar o livro.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'night'];
    const nextTheme = themes[(themes.indexOf(theme) + 1) % themes.length];
    setTheme(nextTheme);
  };

  return (
    <div className="library-container animate-fade-in">
      <header className="library-header glass-panel">
        <div className="logo">
          <BookOpen size={28} className="text-accent" />
          <h1>Read Loud!</h1>
        </div>
        
        <div className="header-actions">
          <button className="icon-btn" onClick={cycleTheme} title="Alternar Tema">
            {theme === 'light' ? <Sun size={24} /> : theme === 'dark' ? <Moon size={24} /> : <Monitor size={24} />}
          </button>
          <button className="icon-btn" title="Configurações" onClick={() => setShowSettings(true)}>
            <Settings size={24} />
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="application/pdf,application/epub+zip"
            style={{ display: 'none' }}
          />
          <button 
            className="btn-primary" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload size={20} />
            {isUploading ? 'Adicionando...' : 'Adicionar Livro'}
          </button>
        </div>
      </header>

      <main className="library-main">
        <h2>Sua Estante</h2>
        
        {books.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <BookOpen size={64} />
            </div>
            <h3>Sua estante está vazia</h3>
            <p>Adicione arquivos PDF ou EPUB para começar a ler.</p>
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Escolher Arquivo
            </button>
          </div>
        ) : (
          <div className="books-grid">
            {books.map(book => (
              <div 
                key={book.id} 
                className="book-card glass-panel"
                onClick={() => navigate(`/read/${book.id}`)}
              >
                {book.cover ? (
                  <div className="book-cover-image" style={{ backgroundImage: `url(${book.cover})` }}></div>
                ) : (
                  <div className="book-cover-placeholder">
                    <span className="book-extension">{book.type.toUpperCase()}</span>
                  </div>
                )}
                <div className="book-info">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <h3 className="book-title" title={book.title} style={{ flex: 1 }}>{book.title}</h3>
                    <button 
                      className="icon-btn" 
                      style={{ padding: '0.2rem', color: 'var(--text-secondary)' }} 
                      onClick={(e) => handleDelete(e, book.id)}
                      title="Apagar Livro"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${book.progressPercent || 0}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">
                    {book.progressPercent ? `${Math.round(book.progressPercent)}% concluído` : 'Não iniciado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

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
