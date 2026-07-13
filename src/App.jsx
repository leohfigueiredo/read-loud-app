import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LibraryModern from './components/Library/LibraryModern';
import Reader from './components/Reader/Reader';
import { settingsDB } from './services/storage';
import { initGemini as initGeminiCore } from './services/gemini';
import { initGemini as initGeminiAdvanced } from './services/tts-advanced';

function App() {
  const [theme, setTheme] = useState('light');
  const [bionic, setBionic] = useState(false);

  // Load preferences on startup
  useEffect(() => {
    settingsDB.getItem('theme').then(t => {
      if (t) setTheme(t);
    });
    settingsDB.getItem('bionic').then(b => {
      if (b !== null) setBionic(b);
    });
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
    if (bionic) {
      document.body.classList.add('bionic-mode-enabled');
    } else {
      document.body.classList.remove('bionic-mode-enabled');
    }
  }, [theme, bionic]);

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<LibraryModern theme={theme} setTheme={setTheme} bionic={bionic} setBionic={setBionic} />} />
          <Route path="/read/:id" element={<Reader theme={theme} bionic={bionic} setTheme={setTheme} setBionic={setBionic} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
