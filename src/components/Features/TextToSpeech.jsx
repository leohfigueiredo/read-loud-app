import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Settings2, Sparkles, Mic, Cpu, Volume2, ChevronRight } from 'lucide-react';
import { generateGeminiAudio } from '../../services/gemini';
import { generateElevenLabsAudio, ELEVENLABS_VOICES } from '../../services/elevenlabs';
import { generateKokoroAudio, playKokoroAudio, initKokoro, getKokoroStatus, KOKORO_VOICES } from '../../services/kokoro';
import { detectLanguage, pickBestVoice } from '../../services/languageDetector';
import { settingsDB } from '../../services/storage';
import './TextToSpeech.css';

export default function TextToSpeech({ textToRead, hudActive }) {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [detectedLang, setDetectedLang] = useState('en');
  const [rate, setRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [useGeminiTTS, setUseGeminiTTS] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [chunkSize, setChunkSize] = useState(800);
  const [geminiVoice, setGeminiVoice] = useState('Aoede');
  const [geminiAudioUrl, setGeminiAudioUrl] = useState(null);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  // ElevenLabs
  const [useElevenLabs, setUseElevenLabs] = useState(false);
  const [elVoice, setElVoice] = useState('EXAVITQu4vr4xnSDxMaL');
  const [hasElKey, setHasElKey] = useState(false);
  // Kokoro (local neural TTS)
  const [useKokoro, setUseKokoro] = useState(false);
  const [kokoroVoice, setKokoroVoice] = useState('bf_emma');
  const [kokoroStatus, setKokoroStatus] = useState('idle'); // idle|loading|ready|error
  const [kokoroProgress, setKokoroProgress] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  
  // Paragraph Queue States
  const [paragraphs, setParagraphs] = useState([]);
  const [currentParaIndex, setCurrentParaIndex] = useState(0);

  const audioRef = useRef(null);
  const currentParaIndexRef = useRef(0);
  const paragraphsRef = useRef([]);
  const kokoroControllerRef = useRef(null); // Web Audio API controller for Kokoro playback
  const playParagraphRef = useRef(null);

  // Sync refs with state to prevent React closure stale references
  useEffect(() => {
    currentParaIndexRef.current = currentParaIndex;
  }, [currentParaIndex]);

  useEffect(() => {
    paragraphsRef.current = paragraphs;
  }, [paragraphs]);

  const geminiVoices = [
    { id: 'Aoede', name: 'Aoede (Feminina)' },
    { id: 'Kore', name: 'Kore (Feminina)' },
    { id: 'Puck', name: 'Puck (Masculina)' },
    { id: 'Charon', name: 'Charon (Masculina)' },
    { id: 'Fenrir', name: 'Fenrir (Masculina)' }
  ];

  // Helper for highlights
  const clearHighlights = () => {
    document.querySelectorAll('.tts-highlight').forEach(el => {
      el.classList.remove('tts-highlight');
    });
    const iframe = document.querySelector('iframe');
    if (iframe) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          iframeDoc.querySelectorAll('.tts-highlight').forEach(el => {
            el.classList.remove('tts-highlight');
          });
        }
      } catch {}
    }
  };

  const highlightInDocument = (doc, text) => {
    const elements = doc.querySelectorAll('p, li, h1, h2, h3, h4, h5, span');
    const cleanText = text.trim().replace(/\s+/g, ' ');
    if (cleanText.length < 5) return; // avoid highlighting single letters/short words
    
    let bestMatch = null;
    let minLength = Infinity;
    
    for (const el of elements) {
      const elText = el.textContent.replace(/\s+/g, ' ');
      if (elText.includes(cleanText)) {
        if (elText.length < minLength) {
          minLength = elText.length;
          bestMatch = el;
        }
      }
    }
    
    if (bestMatch) {
      bestMatch.classList.add('tts-highlight');
      bestMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const highlightText = (text) => {
    clearHighlights();
    if (!text || text.trim().length === 0) return;

    // Highlight in main document
    highlightInDocument(document, text);

    // Highlight in iframe if present
    const iframe = document.querySelector('iframe');
    if (iframe) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          highlightInDocument(iframeDoc, text);
        }
      } catch (e) {
        console.warn("Could not access iframe document for highlighting:", e);
      }
    }
  };

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
    settingsDB.getItem('tts_chunk_size').then(size => {
      if (size) setChunkSize(size);
    });
    settingsDB.getItem('elevenlabs_api_key').then(key => {
      setHasElKey(!!key);
    });
    settingsDB.getItem('use_elevenlabs').then(val => {
      if (val !== null) setUseElevenLabs(val);
    });
    settingsDB.getItem('use_kokoro').then(val => {
      if (val !== null) setUseKokoro(!!val);
    });
    settingsDB.getItem('kokoro_voice').then(v => {
      if (v) setKokoroVoice(v);
    });
    // Reflect current Kokoro loading state
    setKokoroStatus(getKokoroStatus());
  }, [showSettings]);

  // Auto-detect language and pick best voice when text or voices change
  useEffect(() => {
    if (!textToRead || voices.length === 0) return;
    const lang = detectLanguage(textToRead);
    setDetectedLang(lang);
    const best = pickBestVoice(voices, lang);
    if (best) setSelectedVoice(best);
  }, [textToRead, voices]);

  // Build paragraphs list on text change, splitting long paragraphs into sub-chunks
  useEffect(() => {
    if (textToRead) {
      const validChunkSize = (Number.isInteger(chunkSize) && chunkSize > 0) ? chunkSize : 800;
      const rawParagraphs = textToRead
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

      // Split paragraphs longer than chunkSize at sentence boundaries
      const list = [];
      for (const para of rawParagraphs) {
        if (para.length <= validChunkSize) {
          list.push(para);
        } else {
          let remaining = para;
          while (remaining.length > 0) {
            const chunk = remaining.substring(0, validChunkSize);
            // Try to break at a sentence end so audio sounds natural
            const lastBreak = Math.max(
              chunk.lastIndexOf('. '),
              chunk.lastIndexOf('! '),
              chunk.lastIndexOf('? '),
              chunk.lastIndexOf(', ')
            );
            const splitAt = lastBreak > validChunkSize * 0.4 ? lastBreak + 1 : validChunkSize;
            list.push(remaining.substring(0, splitAt).trim());
            remaining = remaining.substring(splitAt).trim();
          }
        }
      }

      setParagraphs(list);
      setCurrentParaIndex(0);
      clearHighlights();
    }
  }, [textToRead, chunkSize]);

  // Stop speech when page changes
  useEffect(() => {
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    kokoroControllerRef.current?.stop();
    kokoroControllerRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
    setGeminiAudioUrl(null);
  }, [textToRead]);

  // Play Gemini audio when URL is ready
  useEffect(() => {
    if (geminiAudioUrl && audioRef.current) {
      audioRef.current.play().catch(e => console.error('Audio play failed:', e));
      audioRef.current.onended = () => {
        const nextIndex = currentParaIndexRef.current + 1;
        if (nextIndex < paragraphsRef.current.length) {
          playParagraphRef.current?.(nextIndex);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
          clearHighlights();
        }
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
        const nextIndex = currentParaIndexRef.current + 1;
        if (nextIndex < paragraphsRef.current.length) {
          playParagraph(nextIndex);
        } else {
          setIsPlaying(false);
          setIsPaused(false);
          clearHighlights();
        }
      };
      
      utterance.onerror = (e) => {
        console.error('Speech synthesis error:', e);
        setIsPlaying(false);
        setIsPaused(false);
        clearHighlights();
      };

      // Prevent garbage collection of utterance in Chrome/Safari
      window._currentUtterance = utterance;

      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
      setIsPaused(false);
    }, 100);
  };

  const playParagraph = async (index) => {
    if (index >= paragraphs.length) {
      handleStop();
      return;
    }

    // Stop any previous audio playback from any engine to prevent overlaps/screeches
    window.speechSynthesis.cancel();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    kokoroControllerRef.current?.stop();
    kokoroControllerRef.current = null;

    setCurrentParaIndex(index);
    const rawText = paragraphs[index];
    
    // Highlight active paragraph
    highlightText(rawText);

    // Paragraphs are already pre-split to chunkSize during list building — read in full
    const text = rawText;

    if (useGeminiTTS) {
      setIsGeminiLoading(true);
      try {
        const audioData = await generateGeminiAudio(text, geminiVoice);
        setGeminiAudioUrl(audioData);
        setIsPlaying(true);
        setIsPaused(false);
        setIsGeminiLoading(false);

        // Prefetch next paragraph silently in the background while current plays.
        const nextIndex = index + 1;
        if (nextIndex < paragraphsRef.current.length) {
          generateGeminiAudio(paragraphsRef.current[nextIndex], geminiVoice).catch(() => {});
        }
      } catch (err) {
        console.warn('Gemini TTS falhou, usando voz do browser:', err.message);
        setIsGeminiLoading(false);
        playBrowserTTS(text);
      }
    } else if (useElevenLabs) {
      setIsGeminiLoading(true);
      try {
        const audioData = await generateElevenLabsAudio(text, elVoice);
        setGeminiAudioUrl(audioData);
        setIsPlaying(true);
        setIsPaused(false);
        setIsGeminiLoading(false);

        // Prefetch next paragraph silently in the background
        const nextIndex = index + 1;
        if (nextIndex < paragraphsRef.current.length) {
          generateElevenLabsAudio(paragraphsRef.current[nextIndex], elVoice).catch(() => {});
        }
      } catch (err) {
        console.warn('ElevenLabs falhou, usando voz do browser:', err.message);
        setIsGeminiLoading(false);
        playBrowserTTS(text);
      }
    } else if (useKokoro) {
      setIsGeminiLoading(true);
      setKokoroStatus('loading');
      try {
        const audioData = await generateKokoroAudio(text, kokoroVoice, (msg) => {
          if (msg === 'ready') { setKokoroStatus('ready'); }
          else { setKokoroProgress(msg); }
        });
        setKokoroStatus('ready');
        setIsPlaying(true);
        setIsPaused(false);
        setIsGeminiLoading(false);

        // Stop any previous Kokoro playback
        kokoroControllerRef.current?.stop();

        // Play directly via Web Audio API (no <audio> element, no blob URL)
        kokoroControllerRef.current = playKokoroAudio(audioData, () => {
          const nextIndex = currentParaIndexRef.current + 1;
          if (nextIndex < paragraphsRef.current.length) {
            playParagraph(nextIndex);
          } else {
            setIsPlaying(false);
            setIsPaused(false);
            clearHighlights();
          }
        });

        // Prefetch next paragraph
        const nextIndex = index + 1;
        if (nextIndex < paragraphsRef.current.length) {
          generateKokoroAudio(paragraphsRef.current[nextIndex], kokoroVoice).catch(() => {});
        }
      } catch (err) {
        console.warn('Kokoro TTS falhou, usando voz do browser:', err.message);
        setKokoroStatus('error');
        setIsGeminiLoading(false);
        playBrowserTTS(text);
      }
    } else {
      playBrowserTTS(text);
    }
  };

  playParagraphRef.current = playParagraph;

  const handlePlay = async () => {
    if (paragraphs.length === 0) return;

    if (isPaused) {
      if (useKokoro && kokoroControllerRef.current) {
        kokoroControllerRef.current.resume();
      } else if ((useGeminiTTS || useElevenLabs) && audioRef.current) {
        audioRef.current.play().catch(e => console.error(e));
      } else {
        window.speechSynthesis.resume();
      }
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // Start playing current paragraph
    playParagraph(currentParaIndex);
  };

  const handlePause = () => {
    window.speechSynthesis.pause();
    if (useKokoro && kokoroControllerRef.current) {
      kokoroControllerRef.current.pause();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPaused(true);
    setIsPlaying(false);
  };

  const handleStop = () => {
    window.speechSynthesis.cancel();
    if (useKokoro && kokoroControllerRef.current) {
      kokoroControllerRef.current.stop();
      kokoroControllerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setGeminiAudioUrl(null);
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentParaIndex(0);
    clearHighlights();
  };

  const handleGeminiToggle = (checked) => {
    handleStop();
    setUseGeminiTTS(checked);
    settingsDB.setItem('use_gemini_tts', checked);
    if (checked) {
      setUseElevenLabs(false);
      setUseKokoro(false);
      settingsDB.setItem('use_elevenlabs', false);
      settingsDB.setItem('use_kokoro', false);
    }
  };

  const handleElevenLabsToggle = (checked) => {
    handleStop();
    setUseElevenLabs(checked);
    settingsDB.setItem('use_elevenlabs', checked);
    if (checked) {
      setUseGeminiTTS(false);
      setUseKokoro(false);
      settingsDB.setItem('use_gemini_tts', false);
      settingsDB.setItem('use_kokoro', false);
    }
  };

  const handleKokoroToggle = (checked) => {
    handleStop();
    setUseKokoro(checked);
    settingsDB.setItem('use_kokoro', checked);
    if (checked) {
      setUseGeminiTTS(false);
      setUseElevenLabs(false);
      settingsDB.setItem('use_gemini_tts', false);
      settingsDB.setItem('use_elevenlabs', false);

      setKokoroStatus('loading');
      initKokoro(msg => {
        if (msg === 'ready') setKokoroStatus('ready');
        else setKokoroProgress(msg);
      }).then(() => setKokoroStatus('ready')).catch(() => setKokoroStatus('error'));
    }
  };

  const handleChunkSizeChange = (val) => {
    setChunkSize(val);
    settingsDB.setItem('tts_chunk_size', val);
  };


  if (isCollapsed) {
    return (
      <div className={`tts-container tts-container--collapsed animate-fade-in ${hudActive ? 'tts-hud-active' : ''}`}>
        {/* Audio element is permanently rendered to avoid ref binding race conditions */}
        <audio ref={audioRef} src={geminiAudioUrl || undefined} />

        <button 
          className="tts-collapsed-bubble" 
          onClick={() => setIsCollapsed(false)}
          title="Abrir Controles de Voz"
        >
          {isGeminiLoading ? (
            <span className="tts-spinner" style={{ borderTopColor: 'white' }} />
          ) : isPlaying ? (
            <span className="tts-wave-animation">
              <span className="bar"></span>
              <span className="bar"></span>
              <span className="bar"></span>
            </span>
          ) : (
            <Volume2 size={20} style={{ color: 'white' }} />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`tts-container animate-fade-in ${hudActive ? 'tts-hud-active' : ''}`}>
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

        {/* COLLAPSE BUTTON */}
        <button
          className="tts-btn"
          onClick={() => { setIsCollapsed(true); setShowSettings(false); }}
          title="Minimizar Leitor"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {showSettings && (
        <div className="tts-settings animate-fade-in">
          {/* Engine toggle row */}
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

          {/* ElevenLabs toggle (only shown when Gemini is off) */}
          {!useGeminiTTS && (
            <div className="tts-setting-row tts-setting-row--border">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#a78bfa' }}>
                  <Mic size={14} /> Voz Natural (ElevenLabs)
                </span>
                <label className="switch">
                  <input type="checkbox" checked={useElevenLabs} onChange={e => handleElevenLabsToggle(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
              {useElevenLabs && (
                <p style={{ fontSize: '0.78rem', color: hasElKey ? '#34d399' : '#f87171', fontWeight: 'bold', margin: 0 }}>
                  {hasElKey ? 'Chave ElevenLabs ativa ✅' : 'Chave não configurada ❌ (Defina nas Configurações)'}
                </p>
              )}
            </div>
          )}

          {/* Kokoro toggle (local neural, only shown when others are off) */}
          {!useGeminiTTS && !useElevenLabs && (
            <div className="tts-setting-row tts-setting-row--border">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: '#34d399' }}>
                  <Cpu size={14} /> Voz Neural Local (Kokoro)
                </span>
                <label className="switch">
                  <input type="checkbox" checked={useKokoro} onChange={e => handleKokoroToggle(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
              {useKokoro && (
                <p style={{ fontSize: '0.78rem', margin: 0, color:
                    kokoroStatus === 'ready'   ? '#34d399' :
                    kokoroStatus === 'error'   ? '#f87171' : '#fbbf24' }}>
                  {kokoroStatus === 'ready'   ? '✅ Modelo carregado e pronto!' :
                   kokoroStatus === 'error'   ? '❌ Erro ao carregar o modelo' :
                   kokoroStatus === 'loading' ? `⏳ ${kokoroProgress || 'A carregar modelo...'} (pode demorar ~1 min)` :
                   '💡 Será descarregado ao iniciar (≈1 min, depois fica em cache)'}
                </p>
              )}
            </div>
          )}

          {useGeminiTTS ? (
            <>
              <div className="tts-setting-row" style={{ marginBottom: '0.5rem' }}>
                <label>Voz Gemini:</label>
                <select value={geminiVoice} onChange={e => setGeminiVoice(e.target.value)} className="select-input">
                  {geminiVoices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="tts-setting-row">
                <label>Tamanho do Trecho (Controle de Custo):</label>
                <select value={chunkSize} onChange={e => handleChunkSizeChange(parseInt(e.target.value))} className="select-input">
                  <option value={400}>400 letras (Ultra Económico ~40s áudio 💰)</option>
                  <option value={800}>800 letras (Padrão Recomendado ~1.5m ⚖️)</option>
                  <option value={1500}>1500 letras (Completo ~3m áudio 🎬)</option>
                </select>
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                  Trechos menores consomem menos créditos da sua chave API.
                </p>
                <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.4rem' }}>
                  💡 **Dica de Economia:** Desative as "Vozes IA" acima para usar a voz do Google do seu tablet. É **100% grátis** e não consome sua chave API!
                </p>
              </div>
            </>
          ) : useElevenLabs ? (
            <>
              <div className="tts-setting-row" style={{ marginBottom: '0.5rem' }}>
                <label>Voz ElevenLabs:</label>
                <select value={elVoice} onChange={e => setElVoice(e.target.value)} className="select-input">
                  {ELEVENLABS_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="tts-setting-row">
                <label>Tamanho do Trecho:</label>
                <select value={chunkSize} onChange={e => handleChunkSizeChange(parseInt(e.target.value))} className="select-input">
                  <option value={400}>400 letras 💰</option>
                  <option value={800}>800 letras ⚖️ (Recomendado)</option>
                  <option value={1500}>1500 letras 🎬</option>
                </select>
              </div>
            </>
          ) : useKokoro ? (
            <>
              <div className="tts-setting-row" style={{ marginBottom: '0.5rem' }}>
                <label>Voz Neural (Kokoro):</label>
                <select value={kokoroVoice} onChange={e => { setKokoroVoice(e.target.value); settingsDB.setItem('kokoro_voice', e.target.value); }} className="select-input">
                  {KOKORO_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>
                💾 Modelo descarregado uma vez e guardado em cache. 100% gratuito, sem API key!
              </p>
            </>
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
