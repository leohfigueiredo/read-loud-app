import { useState, useEffect } from 'react';
import { X, Key, Zap, Type, BookOpen, BarChart2, Trash2, Mic } from 'lucide-react';
import { settingsDB, getAllUsage, clearUsage, PRICING } from '../../services/storage';
import { initGemini as initGeminiCore, testGeminiConnection } from '../../services/gemini';
import { initGemini as initGeminiAdvanced } from '../../services/tts-advanced';
import { initElevenLabs, testElevenLabsConnection } from '../../services/elevenlabs';
import './SettingsModal.css';

export default function SettingsModal({ onClose, theme, setTheme, bionic, setBionic }) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [testStatus, setTestStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const [usageData, setUsageData] = useState([]);
  const [elKey, setElKey] = useState('');
  const [elTestStatus, setElTestStatus] = useState('');
  const [elTesting, setElTesting] = useState(false);

  const loadUsage = () => getAllUsage().then(setUsageData);

  useEffect(() => {
    settingsDB.getItem('gemini_api_key').then(key => {
      if (key) setApiKey(key);
    });
    settingsDB.getItem('gemini_model').then(model => {
      if (model) setSelectedModel(model);
    });
    settingsDB.getItem('elevenlabs_api_key').then(key => {
      if (key) setElKey(key);
    });
    loadUsage();
  }, []);

  const handleSave = () => {
    settingsDB.setItem('gemini_api_key', apiKey);
    settingsDB.setItem('gemini_model', selectedModel);
    initGeminiCore(apiKey, selectedModel);
    initGeminiAdvanced(apiKey);
    if (elKey) {
      settingsDB.setItem('elevenlabs_api_key', elKey);
      initElevenLabs(elKey);
    }
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
       initGeminiCore(apiKey, selectedModel);
       initGeminiAdvanced(apiKey);
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
                <p className="setting-desc" style={{ marginBottom: '1rem' }}>Necessário para os recursos de Tradução, Dicionário e "Catch Me Up" (Companheiro de Leitura).</p>
                
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Modelo do Gemini para Textos:</label>
                  <select 
                    value={selectedModel} 
                    onChange={e => setSelectedModel(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
                  >
                    <option value="gemini-2.5-flash-lite">⚡ Gemini 2.5 Flash Lite (Metade do preço - Recomendado para Economia!)</option>
                    <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (Equilibrado / Padrão)</option>
                    <option value="gemini-3.5-flash">⚡ Gemini 3.5 Flash (Melhor Inteligência)</option>
                  </select>
                  <p className="setting-desc" style={{ marginTop: '0.5rem' }}>
                    O modelo **Lite** custa **50% menos** e é ideal para traduções e definições rápidas sem perder qualidade.
                  </p>
                 </div>
              </div>
          </div>

          {/* ElevenLabs section */}
          <div className="settings-section">
            <h3><Mic size={18} /> Voz Natural (ElevenLabs)</h3>
            <div className="settings-row">
              <label><Key size={16} style={{display:'inline', marginRight:'5px'}} /> Chave de API do ElevenLabs:</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="password"
                  placeholder="Cole sua ElevenLabs API Key aqui..."
                  value={elKey}
                  onChange={e => setElKey(e.target.value)}
                  className="api-input"
                  style={{ flex: 1 }}
                />
                <button className="btn-secondary" disabled={elTesting} style={{ padding: '0.5rem 1rem' }}
                  onClick={async () => {
                    if (!elKey) { setElTestStatus('Digite a chave primeiro.'); return; }
                    setElTesting(true); setElTestStatus('Testando...');
                    try {
                      const msg = await testElevenLabsConnection(elKey);
                      settingsDB.setItem('elevenlabs_api_key', elKey);
                      initElevenLabs(elKey);
                      setElTestStatus(msg + ' (chave salva!)');
                    } catch(e) { setElTestStatus('Erro: ' + e.message); }
                    finally { setElTesting(false); }
                  }}>
                  {elTesting ? '...' : 'Testar'}
                </button>
              </div>
              {elTestStatus && <p style={{ fontSize: '0.85rem', color: elTestStatus.includes('Erro') ? 'var(--accent-color)' : 'green', marginTop: '0.5rem' }}>{elTestStatus}</p>}
              <p className="setting-desc">
                Crie uma conta gratuita em <strong>elevenlabs.io</strong> (10.000 chars/mês grátis).
                Ative nas configurações de voz do leitor com o toggle <strong>&ldquo;Vozes IA&rdquo;</strong> desligado — o ElevenLabs fica disponível como 3ª opção.
              </p>
            </div>
          </div>

          {/* Usage & Cost panel */}
          <div className="settings-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={18} /> Uso da API &amp; Custo Estimado
            </h3>
            {usageData.length === 0 ? (
              <p className="setting-desc">Nenhum uso registado ainda. Os dados aparecem aqui após usar a IA.</p>
            ) : (() => {
              const today = new Date().toISOString().split('T')[0];
              const todayData = usageData.find(d => d.date === today) || { ttsChars: 0, textChars: 0 };
              const totalTts  = usageData.reduce((s, d) => s + (d.ttsChars  || 0), 0);
              const totalText = usageData.reduce((s, d) => s + (d.textChars || 0), 0);
              const totalCost  = (totalTts * PRICING.ttsPerChar + totalText * PRICING.textPerChar);
              const fmt = (n) => n < 0.001 ? '< $0.001' : `$${n.toFixed(4)}`;
              const fmtK = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : `${n}`;
              return (
                <>
                  {/* Summary cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    {[{label: 'Hoje — Voz IA', chars: todayData.ttsChars, cost: todayData.ttsChars * PRICING.ttsPerChar},
                      {label: 'Hoje — Textos', chars: todayData.textChars, cost: todayData.textChars * PRICING.textPerChar},
                      {label: 'Total — Voz IA', chars: totalTts,  cost: totalTts  * PRICING.ttsPerChar},
                      {label: 'Total — Textos', chars: totalText, cost: totalText * PRICING.textPerChar},
                    ].map(({label, chars, cost}) => (
                      <div key={label} style={{ background: 'var(--bg-secondary)', borderRadius: '10px', padding: '0.75rem', border: '1px solid var(--border-color)' }}>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{label}</p>
                        <p style={{ margin: '0.2rem 0 0', fontWeight: 700, fontSize: '1.05rem', color: 'var(--accent-color)' }}>{fmt(cost)}</p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{fmtK(chars)} chars</p>
                      </div>
                    ))}
                  </div>

                  {/* Daily history table (last 7 days) */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem' }}>Dia</th>
                        <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem' }}>Voz IA</th>
                        <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem' }}>Textos</th>
                        <th style={{ textAlign: 'right', padding: '0.3rem 0.5rem' }}>Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageData.slice(0, 7).map(d => {
                        const cost = (d.ttsChars||0)*PRICING.ttsPerChar + (d.textChars||0)*PRICING.textPerChar;
                        return (
                          <tr key={d.date} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.35rem 0.5rem' }}>{d.date === today ? '📅 Hoje' : d.date.slice(5)}</td>
                            <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem' }}>{fmtK(d.ttsChars||0)}</td>
                            <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem' }}>{fmtK(d.textChars||0)}</td>
                            <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: 'var(--accent-color)', fontWeight: 600 }}>{fmt(cost)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>
                        <td style={{ padding: '0.35rem 0.5rem' }}>Total</td>
                        <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem' }}>{fmtK(totalTts)}</td>
                        <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem' }}>{fmtK(totalText)}</td>
                        <td style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: 'var(--accent-color)' }}>{fmt(totalCost)}</td>
                      </tr>
                    </tfoot>
                  </table>

                  <p className="setting-desc" style={{ marginBottom: '0.75rem' }}>⚠️ Estimativa baseada nos preços oficiais do Gemini 2.5 Flash. O custo real pode variar ligeiramente.</p>

                  <button
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}
                    onClick={() => clearUsage().then(loadUsage)}
                  >
                    <Trash2 size={14} /> Apagar Histórico de Uso
                  </button>
                </>
              );
            })()}
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
