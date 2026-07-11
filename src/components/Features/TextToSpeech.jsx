import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Settings2, Sparkles } from 'lucide-react';
import { generateGeminiAudio } from '../../services/gemini';
import './TextToSpeech.css';

export default function TextToSpeech({ textToRead }) {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useGeminiTTS, setUseGeminiTTS] = useState(false);
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

  useEffect(() => {
    let intervalId;
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        if (!selectedVoice) {
          // Default to Portuguese
          const ptVoice = availableVoices.find(v => v.lang.toLowerCase().includes('pt')) || availableVoices[0];
          setSelectedVoice(ptVoice);
        }
        clearInterval(intervalId);
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    
    // Fallback for Android Chrome which sometimes doesn't fire onvoiceschanged
    intervalId = setInterval(() => {
      if (voices.length === 0) loadVoices();
    }, 1000);
    
    return () => {
      clearInterval(intervalId);
      window.speechSynthesis.cancel();
    }
  }, [selectedVoice, voices.length]);

  useEffect(() => {
    if (geminiAudioUrl && audioRef.current) {
      audioRef.current.play().catch(e => console.error("Audio play failed:", e));
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
    }
  }, [geminiAudioUrl]);

  const handlePlay = async () => {
    if (!textToRead) return;

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
          // Send only the first 1000 characters to prevent API limits during testing
          const textChunk = textToRead.substring(0, 1000); 
          const audioData = await generateGeminiAudio(textChunk, geminiVoice);
          setGeminiAudioUrl(audioData);
          setIsPlaying(true);
          setIsPaused(false);
       } catch (err) {
          alert("Erro no Gemini TTS: " + err.message);
          setIsPlaying(false);
       } finally {
          setIsGeminiLoading(false);
       }
       return;
    }
    
    if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
        setIsPlaying(true);
        return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = rate;
    
    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };
    
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    if (useGeminiTTS && audioRef.current) {
       audioRef.current.pause();
       setIsPaused(true);
       setIsPlaying(false);
       return;
    }

    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (useGeminiTTS) {
       if(audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
       }
       setIsPlaying(false);
       setIsPaused(false);
       setGeminiAudioUrl(null);
       return;
    }

    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  };

  if (!textToRead) return null;

  return (
    <div className="tts-container glass-panel">
      {/* Hidden audio element for Gemini TTS */}
      {geminiAudioUrl && <audio ref={audioRef} src={geminiAudioUrl} />}

      <div className="tts-controls">
        {isPlaying ? (
           <button className="icon-btn" onClick={handlePause} title="Pausar"><Pause size={20} /></button>
        ) : (
           <button className="icon-btn" onClick={handlePlay} title="Tocar" disabled={isGeminiLoading}>
             {isGeminiLoading ? <div className="loading-spinner"></div> : <Play size={20} />}
           </button>
        )}
        <button className="icon-btn" onClick={handleStop} title="Parar"><Square size={20} /></button>
        <button className={`icon-btn ${showSettings ? 'active' : ''}`} onClick={() => setShowSettings(!showSettings)} title="Configurações de Voz">
          <Settings2 size={20} />
        </button>
      </div>

      {showSettings && (
        <div className="tts-settings animate-fade-in">
          
          <div className="setting-row" style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <label className="switch-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                <Sparkles size={16} /> Vozes de IA (Gemini)
              </span>
              <label className="switch">
                <input type="checkbox" checked={useGeminiTTS} onChange={(e) => setUseGeminiTTS(e.target.checked)} />
                <span className="slider round"></span>
              </label>
            </label>
            {useGeminiTTS && (
              <p className="setting-desc" style={{ marginTop: '0.5rem' }}>Gera áudio de estúdio de até 1000 letras usando sua API Key do Gemini.</p>
            )}
          </div>

          {useGeminiTTS ? (
            <div className="setting-row">
              <label>Voz (Gemini):</label>
              <select 
                value={geminiVoice} 
                onChange={(e) => setGeminiVoice(e.target.value)}
                className="select-input"
              >
                {geminiVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div className="setting-row">
                <label>Voz Padrão:</label>
                <select 
                  value={selectedVoice?.name || ''} 
                  onChange={(e) => setSelectedVoice(voices.find(v => v.name === e.target.value))}
                  className="select-input"
                >
                  {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
                </select>
              </div>
              <div className="setting-row">
                <label>Velocidade ({rate}x):</label>
                <input 
                  type="range" 
                  min="0.5" max="2.5" step="0.1" 
                  value={rate} 
                  onChange={(e) => setRate(parseFloat(e.target.value))} 
                  className="range-input"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
