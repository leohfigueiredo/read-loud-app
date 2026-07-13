import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Trash2, Settings, Moon, Sun, Monitor, Search, Grid, List } from 'lucide-react';
import { getAllBooksMetadata, saveBook, deleteBook } from '../../services/storage';
import SettingsModal from '../Features/SettingsModal';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import ePub from 'epubjs';
import './LibraryModern.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function LibraryModern({ theme, setTheme, bionic, setBionic }) {
  const [books, setBooks] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchQuery, setSearchQuery] = useState('');
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
      console.error('Error loading books:', err);
    }
  };

  const filteredBooks = books.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja apagar este livro?')) {
      try {
        await deleteBook(id);
        await loadBooks();
      } catch (err) {
        console.error('Delete error:', err);
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
        alert('Apenas PDF ou EPUB são suportados.');
        setIsUploading(false);
        return;
      }

      let coverDataUrl = null;
      let bookTitle = file.name.replace(/\.[^/.]+$/, ''); // fallback title
      let bookAuthor = 'Autor Desconhecido';
      const arrayBuffer = await file.arrayBuffer();

      if (isPdf) {
        try {
          const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
          
          try {
            const metaInfo = await pdfDoc.getMetadata();
            if (metaInfo?.info?.Title) {
              bookTitle = metaInfo.info.Title.trim();
            }
            if (metaInfo?.info?.Author) {
              bookAuthor = metaInfo.info.Author.trim();
            }
          } catch (metaErr) {
            console.warn('Failed to extract PDF metadata:', metaErr);
          }

          const page = await pdfDoc.getPage(1);
          const viewport = page.getViewport({ scale: 0.5 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport }).promise;
          coverDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        } catch (err) {
          console.warn('PDF cover extraction failed:', err);
        }
      } else if (isEpub) {
        try {
          const book = ePub(arrayBuffer);
          
          try {
            await book.ready;
            if (book.package?.metadata?.title) {
              bookTitle = book.package.metadata.title.trim();
            }
            if (book.package?.metadata?.creator) {
              bookAuthor = book.package.metadata.creator.trim();
            }
          } catch (metaErr) {
            console.warn('Failed to extract EPUB metadata:', metaErr);
          }

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
        } catch (err) {
          console.warn('EPUB cover extraction failed:', err);
        }
      }

      // Clean filename fallback or meta Title if it contains file-system patterns
      if (bookTitle) {
        bookTitle = bookTitle
          .replace(/_Worldfreebooks\.com/gi, '')
          .replace(/_Worldfreebook/gi, '')
          .replace(/_/g, ' ')
          .replace(/-/g, ' - ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      const id = Date.now().toString();
      const metadata = {
        title: bookTitle || file.name.replace(/\.[^/.]+$/, ''),
        author: bookAuthor,
        type: isPdf ? 'pdf' : 'epub',
        size: file.size,
        cover: coverDataUrl
      };

      await saveBook(file, id, metadata);
      await loadBooks();
    } catch (err) {
      console.error('Upload error:', err);
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
    <div className="library-modern">
      {/* Header */}
      <header className="library-header">
        <div className="header-content">
          <div className="logo">
            <h1>📚 Read Loud!</h1>
            <p>Premium E-book Reader</p>
          </div>

          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Procure um livro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="header-actions">
            <button className="icon-btn" onClick={cycleTheme} title="Alternar tema">
              {theme === 'light' ? <Sun size={20} /> : theme === 'dark' ? <Moon size={20} /> : <Monitor size={20} />}
            </button>
            <button className="icon-btn" onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')} title="Mudar visualização">
              {viewMode === 'grid' ? <List size={20} /> : <Grid size={20} />}
            </button>
            <button className="icon-btn" onClick={() => setShowSettings(true)} title="Configurações">
              <Settings size={20} />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.epub,application/pdf,application/epub+zip"
              style={{ display: 'none' }}
            />
            <button
              className="btn-upload"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload size={18} />
              {isUploading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="library-content">
        {filteredBooks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <h2>Sua estante está vazia</h2>
            <p>Adicione seus primeiros livros para começar a ler</p>
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Escolher Arquivo
            </button>
          </div>
        ) : (
          <div className={`books-container ${viewMode}`}>
            {filteredBooks.map(book => (
              <div
                key={book.id}
                className="book-card"
                onClick={() => navigate(`/read/${book.id}`)}
              >
                <div className="book-cover">
                  {book.cover ? (
                    <img src={book.cover} alt={book.title} />
                  ) : (
                    <div className="cover-placeholder">
                      <span>{book.type.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="cover-overlay">
                    <button
                      className="delete-btn"
                      onClick={(e) => handleDelete(e, book.id)}
                      title="Deletar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="book-info">
                  <h3 className="book-title">{book.title}</h3>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${book.progressPercent || 0}%` }} />
                  </div>
                  <p className="progress-text">
                    {book.progressPercent ? `${Math.round(book.progressPercent)}%` : 'Não iniciado'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          theme={theme}
          setTheme={setTheme}
          bionic={bionic}
          setBionic={setBionic}
        />
      )}
    </div>
  );
}
