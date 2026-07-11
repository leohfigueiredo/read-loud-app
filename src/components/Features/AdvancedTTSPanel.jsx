import { useState } from 'react';
import { ChevronDown, Volume2 } from 'lucide-react';
import { useTTS } from '../../hooks/useTTS';
import './AdvancedTTSPanel.css';

export default function AdvancedTTSPanel({ currentText, onClose }) {
  const tts = useTTS();
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  const handleStartReading = () => {
    if (currentText) {
      tts.startReading(currentText);
    }
  };

  return (
    <div className="advanced-tts-panel glass-panel">
      <div className="tts-header">
        <div className="tts-title">
          <Volume2 size={20} className="text-accent" />
          <span>Leitura em Voz Alta</span>
        </div>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>

      <div className="tts-content">
        {/* Voice Selector */}
        <div className="tts-control">
          <label>Voz</label>
          <div className="voice-selector">
            <button 
              className="voice-btn"
              onClick={() => setShowVoiceMenu(!showVoiceMenu)}
            >
              {tts.availableVoices.find(v => v.id === tts.voiceName)?.label}
              <ChevronDown size={16} />
            </button>
            {showVoiceMenu && (
              <div className="voice-menu">
                {tts.availableVoices.map(voice => (
                  <button
                    key={voice.id}
                    className={`voice-option ${voice.id === tts.voiceName ? 'active' : ''}`}
                    onClick={() => {
                      tts.setVoiceName(voice.id);
                      setShowVoiceMenu(false);
                    }}
                  >
                    {voice.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Speed Control */}
        <div className="tts-control">
          <label>Velocidade: {tts.speed.toFixed(1)}x</label>
          <div className="speed-control">
            <button 
              className="speed-btn"
              onClick={() => tts.setSpeed(tts.speed - 0.1)}
              disabled={tts.speed <= 0.5}
            >
              −
            </button>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={tts.speed}
              onChange={(e) => tts.setSpeed(parseFloat(e.target.value))}
              className="speed-slider"
            />
            <button 
              className="speed-btn"
              onClick={() => tts.setSpeed(tts.speed + 0.1)}
              disabled={tts.speed >= 2}
            >
              +
            </button>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="tts-controls">
          {!tts.isPlaying ? (
            <button 
              className="btn-primary"
              onClick={handleStartReading}
            >
              <Volume2 size={16} />
              Iniciar Leitura
            </button>
          ) : (
            <>
              {!tts.isPaused ? (
                <button 
                  className="btn-secondary"
                  onClick={tts.pause}
                >
                  Pausar
                </button>
              ) : (
                <button 
                  className="btn-secondary"
                  onClick={tts.resume}
                >
                  Resumir
                </button>
              )}
              <button 
                className="btn-danger"
                onClick={tts.stop}
              >
                Parar
              </button>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {tts.isPlaying && (
          <div className="tts-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${tts.progress}%` }}
              />
            </div>
            <p className="progress-text">
              {tts.progress.toFixed(0)}% concluído
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
