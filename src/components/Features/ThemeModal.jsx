import { X, Check } from 'lucide-react';
import './ThemeModal.css';

export default function ThemeModal({ onClose, currentUiTheme, setUiTheme, currentRadius, setRadius, currentUiFont, setUiFont, currentUiColor, setUiColor }) {
  
  const themes = [
    { id: 'windows-mica', label: 'Windows Fluent (Mica)', icon: '🪟' },
    { id: 'light', label: 'Clássico Claro', icon: '☀️' },
    { id: 'dark', label: 'Clássico Escuro', icon: '🌙' }
  ];

  const borderRadii = [
    { id: '0px', label: 'Quadrado', val: '0px' },
    { id: '8px', label: 'Curvado (Smooth)', val: '8px' },
    { id: '20px', label: 'Redondo', val: '20px' }
  ];

  const fonts = [
    { id: 'Inter', label: 'Inter (Moderna)' },
    { id: 'Roboto', label: 'Roboto (Clássica)' },
    { id: 'Segoe UI', label: 'Segoe UI (Windows)' }
  ];

  const colors = [
    { id: '#1e3a8a', label: 'Azul Escuro' },
    { id: '#3b82f6', label: 'Azul (Padrão)' },
    { id: '#10b981', label: 'Verde' },
    { id: '#f97316', label: 'Laranja' },
    { id: '#f43f5e', label: 'Rosa' }
  ];

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="theme-modal glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Personalizar Interface</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {/* Theme Section */}
          <div className="theme-section">
            <h3>Cor do Painel (Tema)</h3>
            <div className="theme-options">
              {themes.map(t => (
                <button 
                  key={t.id} 
                  className={`theme-option ${currentUiTheme === t.id ? 'active' : ''}`}
                  onClick={() => setUiTheme(t.id)}
                >
                  <span className="theme-icon">{t.icon}</span>
                  <span>{t.label}</span>
                  {currentUiTheme === t.id && <Check size={16} className="check-icon" />}
                </button>
              ))}
            </div>
          </div>

          {/* Accent Color Section */}
          <div className="theme-section">
            <h3>Cor de Destaque</h3>
            <div className="theme-options color-options">
              {colors.map(c => (
                <button 
                  key={c.id} 
                  className={`theme-option ${currentUiColor === c.id ? 'active' : ''}`}
                  onClick={() => setUiColor(c.id)}
                >
                  <div className="color-circle" style={{ backgroundColor: c.id }}></div>
                  <span>{c.label}</span>
                  {currentUiColor === c.id && <Check size={16} className="check-icon" />}
                </button>
              ))}
            </div>
          </div>

          {/* Border Radius Section */}
          <div className="theme-section">
            <h3>Formato dos Botões e Cartões</h3>
            <div className="theme-options border-options">
              {borderRadii.map(r => (
                <button 
                  key={r.id} 
                  className={`theme-option ${currentRadius === r.id ? 'active' : ''}`}
                  onClick={() => setRadius(r.id)}
                  style={{ borderRadius: r.val }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fonts Section */}
          <div className="theme-section">
            <h3>Fonte da Interface</h3>
            <div className="theme-options font-options">
              {fonts.map(f => (
                <button 
                  key={f.id} 
                  className={`theme-option ${currentUiFont === f.id ? 'active' : ''}`}
                  onClick={() => setUiFont(f.id)}
                  style={{ fontFamily: `${f.id}, sans-serif` }}
                >
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Aa</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
