import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Settings2, Sparkles } from 'lucide-react';
import { generateGeminiAudio } from '../../services/gemini';
import { detectLanguage, pickBestVoice } from '../../services/languageDetector';
import { settingsDB } from '../../services/storage';
import './TextToSpeech.css';

export default function TextToSpeech({ textToRead }) {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [detectedLang, setDetectedLang] = useState('en');
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useGeminiTTS, setUseGeminiTTS] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [geminiVoice, setGeminiVoice] = useState('Aoede');
  const [geminiAudioUrl, setGeminiAudioUrl] = useState(null);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const audioRef = useRef(null);

  const geminiVoices = [
    { id: 'Aoede', name: 'Aoede (Feminina)' },
    { id: 'Kore', name: 'Kore (Feminina)' },
    { id: 'Puck', name: 'Puck (Masculina)' },
    { id: 'Charon', name: 'Charon (Masculina)' },
    { id: 'Fenrir', name: 'Fenrir (Masculina)' }
  ];

  // Load browser voices
  useEffect(() => {
    const load = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    const id = setInterval(() => {
      if (window.speechSynthesis.getVoices().length > 0) {
        load();
        clearInterval(id);
      }
    }, 500);
    return () => {
      clearInterval(id);
      window.speechSynthesis.cancel();
    };
  }, []);

  // Load user preference for Gemini TTS toggle & check API Key
  useEffect(() => {
    settingsDB.getItem('use_gemini_tts').then(val => {
      if (val !== null) setUseGeminiTTS(val);
    });
    settingsDB.getItem('gemini_api_key').then(key => {
      setHasApiKey(!!key);
    });
  }, [showSettings]);

  // Auto-detect language and pick best voice when text or voices change
  useEffect(() => {
    if (!textToRead || voices.length === 0) return;
    const lang = detectLanguage(textToRead);
    setDetectedLang(lang);
    const best = pickBestVoice(voices, lang);
    if (best) setSelectedVoice(best);
  }, [textToRead, voices]);

  // Stop speech when page changes
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setGeminiAudioUrl(null);
  }, [textToRead]);

  // Play Gemini audio when URL is ready
  useEffect(() => {
    if (geminiAudioUrl && audioRef.current) {
      audioRef.current.play().catch(e => console.error('Audio play failed:', e));
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
    }
  }, [geminiAudioUrl]);

  const playBrowserTTS = (text) => {
    window.speechSynthesis.cancel();

    // 100ms timeout prevents Chrome from immediately canceling the new utterance
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = rate;
      utterance.lang = selectedVoice?.lang || 'pt-BR';

      utterance.onend = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
      utterance.onerror = (e) => {
        console.error('Speech synthesis error:', e);
        setIsPlaying(false);
        setIsPaused(false);
      };

      // Prevent garbage collection of utterance in Chrome/Safari
      window._currentUtterance = utterance;

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
      setIsPaused(false);
    }, 100);
  };

  const handlePlay = async () => {
    const text = textToRead && textToRead.trim().length > 0
      ? textToRead
      : 'Texto ainda a carregar. Aguarde um momento e tente novamente.';

    // --- Gemini TTS (AI voices) ---
    if (useGeminiTTS) {
      window.speechSynthesis.cancel();
      if (isPaused && audioRef.current) {
        audioRef.current.play();
        setIsPaused(false);
        setIsPlaying(true);
        return;
      }
      setIsGeminiLoading(true);
      try {
        const audioData = await generateGeminiAudio(text.substring(0, 1500), geminiVoice);
        setGeminiAudioUrl(audioData);
        setIsPlaying(true);
        setIsPaused(false);
        setIsGeminiLoading(false);
        return;
      } catch (err) {
        console.warn('Gemini TTS falhou, usando voz do browser:', err.message);
        setIsGeminiLoading(false);
        playBrowserTTS(text);
        return;
      }
    }

    // --- Browser TTS (sempre funciona) ---
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    playBrowserTTS(text);
  };

  const handlePause = () => {
    if (useGeminiTTS && audioRef.current) {
      audioRef.current.pause();
    } else {
      window.speechSynthesis.pause();
    }
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (useGeminiTTS && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setGeminiAudioUrl(null);
    } else {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
  };

  const handleGeminiToggle = (checked) => {
    setUseGeminiTTS(checked);
    settingsDB.setItem('use_gemini_tts', checked);
  };

  const hasText = Boolean(textToRead && textToRead.trim().length > 0);

  return (
    <div className="tts-container">
      {/* Audio element is permanently rendered to avoid ref binding race conditions */}
      <audio ref={audioRef} src={geminiAudioUrl || undefined} />

      <div className="tts-controls">
        {/* PLAY */}
        <button
          className="tts-btn"
          onClick={handlePlay}
          disabled={isGeminiLoading || isPlaying}
          title="Ler em voz alta"
        >
          {isGeminiLoading ? <span className="tts-spinner" /> : <Play size={22} />}
        </button>

        {/* PAUSE */}
        <button
          className="tts-btn"
          onClick={handlePause}
          disabled={!isPlaying}
          title="Pausar"
        >
          <Pause size={22} />
        </button>

        {/* STOP */}
        <button
          className="tts-btn"
          onClick={handleStop}
          disabled={!isPlaying && !isPaused}
          title="Parar"
        >
          <Square size={22} />
        </button>

        {/* SETTINGS */}
        <button
          className={`tts-btn ${showSettings ? 'tts-btn--active' : ''}`}
          onClick={() => setShowSettings(s => !s)}
          title="Configurações de voz"
        >
          <Settings2 size={22} />
        </button>
      </div>

      {showSettings && (
        <div className="tts-settings animate-fade-in">
          {/* Gemini toggle */}
          <div className="tts-setting-row tts-setting-row--border">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                <Sparkles size={14} /> Vozes IA (Gemini)
              </span>
              <label className="switch">
                <input type="checkbox" checked={useGeminiTTS} onChange={e => handleGeminiToggle(e.target.checked)} />
                <span className="slider round"></span>
              </label>
            </div>
            {useGeminiTTS && (
              <p style={{ fontSize: '0.78rem', color: hasApiKey ? '#34d399' : '#f87171', fontWeight: 'bold', margin: 0 }}>
                {hasApiKey ? 'Chave API ativa ✅' : 'Chave API não configurada ❌ (Defina no menu do leitor)'}
              </p>
            )}
          </div>

          {useGeminiTTS ? (
            <div className="tts-setting-row">
              <label>Voz Gemini:</label>
              <select value={geminiVoice} onChange={e => setGeminiVoice(e.target.value)} className="select-input">
                {geminiVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div className="tts-setting-row">
                <label>Idioma detetado: <strong style={{ color: 'var(--accent-color)' }}>{detectedLang.toUpperCase()}</strong></label>
                <label>Voz ({voices.length} disponíveis):</label>
                <select
                  value={selectedVoice?.name || ''}
                  onChange={e => setSelectedVoice(voices.find(v => v.name === e.target.value))}
                  className="select-input"
                >
                  {voices.map(v => (
                    <option key={v.name} value={v.name}>
                      {v.name.includes('Google') ? '🎙 ' : ''}{v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                {selectedVoice && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Ativa: <strong>{selectedVoice.name}</strong>
                  </p>
                )}
              </div>
              <div className="tts-setting-row">
                <label>Velocidade: {rate}x</label>
                <input type="range" min="0.5" max="2.5" step="0.1" value={rate}
                  onChange={e => setRate(parseFloat(e.target.value))} className="range-input" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
