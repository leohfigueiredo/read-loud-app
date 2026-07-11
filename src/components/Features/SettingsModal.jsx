import { useState, useEffect } from 'react';
import { X, Key, Zap, Type, BookOpen } from 'lucide-react';
import { settingsDB } from '../../services/storage';
import { initGemini as initGeminiService, testGeminiConnection } from '../../services/gemini';
import './SettingsModal.css';

export default function SettingsModal({ onClose, theme, setTheme, bionic, setBionic }) {
  const [apiKey, setApiKey] = useState('');
  const [testStatus, setTestStatus] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    settingsDB.getItem('gemini_api_key').then(key => {
      if (key) setApiKey(key);
    });
  }, []);

  const handleSave = () => {
    settingsDB.setItem('gemini_api_key', apiKey);
    initGeminiService(apiKey);
    
    settingsDB.setItem('theme', theme);
    settingsDB.setItem('bionic', bionic);
    
    onClose();
  };

  const handleTestApi = async () => {
    if (!apiKey) {
       setTestStatus("Digite a chave primeiro.");
       return;
    }
    setTesting(true);
    setTestStatus("Testando...");
    try {
       initGeminiService(apiKey);
       const result = await testGeminiConnection();
       // Auto-salva a chave se o teste passou
       settingsDB.setItem('gemini_api_key', apiKey);
       setTestStatus(result + ' (chave salva automaticamente!)');
    } catch (err) {
       setTestStatus("Erro: " + err.message);
    } finally {
       setTesting(false);
    }
  };

  return (
    <div className="settings-overlay animate-fade-in">
      <div className="settings-modal glass-panel">
        <div className="settings-header">
          <h2>Configurações do Leitor</h2>
          <button className="icon-btn" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
             <h3><BookOpen size={18} /> Aparência</h3>
             <div className="settings-row">
               <label>Tema da Interface:</label>
               <select value={theme} onChange={e => setTheme(e.target.value)}>
                 <option value="light">Claro</option>
                 <option value="dark">Escuro</option>
                 <option value="night">Filtro de Luz Noturna (Sépia)</option>
               </select>
             </div>
          </div>

          <div className="settings-section">
             <h3><Type size={18} /> Leitura Acessível</h3>
             <div className="settings-row toggle-row">
               <div>
                 <label>Modo de Leitura Biônica</label>
                 <p className="setting-desc">Destaca o início das palavras para guiar os olhos e aumentar o foco e a velocidade de leitura.</p>
               </div>
               <label className="switch">
                 <input type="checkbox" checked={bionic} onChange={e => setBionic(e.target.checked)} />
                 <span className="slider round"></span>
               </label>
             </div>
          </div>

          <div className="settings-section">
             <h3><Zap size={18} /> Inteligência Artificial (Gemini)</h3>
             <div className="settings-row">
               <label><Key size={16} style={{display:'inline', marginRight:'5px'}} /> Chave de API do Google Gemini:</label>
               <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                 <input 
                   type="password" 
                   placeholder="Cole sua API Key aqui..." 
                   value={apiKey}
                   onChange={e => setApiKey(e.target.value)}
                   className="api-input"
                   style={{ flex: 1 }}
                 />
                 <button className="btn-secondary" onClick={handleTestApi} disabled={testing} style={{ padding: '0.5rem 1rem' }}>
                   {testing ? "..." : "Testar"}
                 </button>
               </div>
               {testStatus && <p style={{ fontSize: '0.85rem', color: testStatus.includes('Erro') ? 'var(--accent-color)' : 'green', marginTop: '0.5rem' }}>{testStatus}</p>}
               <p className="setting-desc">Necessário para os recursos de Tradução, Dicionário e "Catch Me Up" (Companheiro de Leitura).</p>
             </div>
          </div>
        </div>

        <div className="settings-footer">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave}>Salvar Configurações</button>
        </div>
      </div>
    </div>
  );
}
