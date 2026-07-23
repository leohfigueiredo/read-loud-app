import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LibraryModern from './components/Library/LibraryModern';
import Reader from './components/Reader/Reader';
import { settingsDB } from './services/storage';
import { initGemini as initGeminiCore } from './services/gemini';
import { initGemini as initGeminiAdvanced } from './services/tts-advanced';
import Notebook from './components/Features/Notebook';

function App() {
  const [theme, setTheme] = useState('light');
  const [bionic, setBionic] = useState(false);
  const [uiTheme, setUiTheme] = useState('windows-mica');
  const [uiFont, setUiFont] = useState('Inter');
  const [radius, setRadius] = useState('8px');
  const [uiColor, setUiColor] = useState('#3b82f6');

  // Load preferences on startup
  useEffect(() => {
    settingsDB.getItem('theme').then(t => {
      if (t) setTheme(t);
    });
    settingsDB.getItem('bionic').then(b => {
      if (b !== null) setBionic(b);
    });
    settingsDB.getItem('uiTheme').then(t => { if (t) setUiTheme(t); });
    settingsDB.getItem('uiFont').then(f => { if (f) setUiFont(f); });
    settingsDB.getItem('radius').then(r => { if (r) setRadius(r); });
    settingsDB.getItem('uiColor').then(c => { if (c) setUiColor(c); });
    // Load and initialize API key on startup
    settingsDB.getItem('gemini_api_key').then(key => {
      if (key) {
        initGeminiCore(key);
        initGeminiAdvanced(key);
      }
    });
  }, []);

  // Apply preferences
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-ui-theme', uiTheme);
    document.documentElement.style.setProperty('--main-font', `"${uiFont}", sans-serif`);
    document.documentElement.style.setProperty('--radius-shape', radius);
    document.documentElement.style.setProperty('--accent-color', uiColor);
    
    settingsDB.setItem('theme', theme);
    settingsDB.setItem('uiTheme', uiTheme);
    settingsDB.setItem('uiFont', uiFont);
    settingsDB.setItem('radius', radius);
    settingsDB.setItem('uiColor', uiColor);
    
    if (bionic) {
      document.body.classList.add('bionic-mode-enabled');
    } else {
      document.body.classList.remove('bionic-mode-enabled');
    }
  }, [theme, bionic, uiTheme, uiFont, radius, uiColor]);

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<LibraryModern theme={theme} setTheme={setTheme} bionic={bionic} setBionic={setBionic} uiTheme={uiTheme} setUiTheme={setUiTheme} uiFont={uiFont} setUiFont={setUiFont} radius={radius} setRadius={setRadius} uiColor={uiColor} setUiColor={setUiColor} />} />
          <Route path="/read/:id" element={<Reader theme={theme} bionic={bionic} setTheme={setTheme} setBionic={setBionic} />} />
          <Route path="/notebook" element={<Notebook />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
