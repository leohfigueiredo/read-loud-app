import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Library from './components/Library/Library';
import Reader from './components/Reader/Reader';
import { settingsDB } from './services/storage';

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
    
    // We would load API keys here as well
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
          {/* We will pass theme togglers to Library/Settings later if needed */}
          <Route path="/" element={<Library theme={theme} setTheme={setTheme} bionic={bionic} setBionic={setBionic} />} />
          <Route path="/read/:id" element={<Reader theme={theme} bionic={bionic} setTheme={setTheme} setBionic={setBionic} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
