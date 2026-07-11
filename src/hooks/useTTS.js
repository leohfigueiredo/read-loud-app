import { useState, useRef, useCallback } from 'react';
import { generateAdvancedTTS, chunkTextForTTS, AVAILABLE_VOICES } from '../services/tts-advanced';

export function useTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voiceName, setVoiceName] = useState('Aoede');
  const [speed, setSpeed] = useState(1.0);
  const [progress, setProgress] = useState(0);

  const audioRefs = useRef({});
  const currentAudioRef = useRef(null);
  const chunksRef = useRef([]);
  const totalChunksRef = useRef(0);
  const currentChunkRef = useRef(0);

  const playChunk = useCallback(async (index) => {
    if (!audioRefs.current[index]) {
      try {
        const audioUrl = await generateAdvancedTTS(chunksRef.current[index], { voiceName, speed });
        audioRefs.current[index] = audioUrl;
      } catch (err) {
        console.error('Audio error:', err);
        return;
      }
    }

    const audio = new Audio(audioRefs.current[index]);
    currentAudioRef.current = audio;

    audio.onended = () => {
      if (index + 1 < totalChunksRef.current) {
        playChunk(index + 1);
      } else {
        setIsPlaying(false);
      }
    };

    try {
      await audio.play();
      currentChunkRef.current = index;
      setProgress((index / totalChunksRef.current) * 100);
    } catch (err) {
      console.error('Play error:', err);
    }
  }, [voiceName, speed]);

  const startReading = useCallback(async (text) => {
    if (!text) return;
    setIsPlaying(true);
    const chunks = chunkTextForTTS(text);
    chunksRef.current = chunks;
    totalChunksRef.current = chunks.length;
    audioRefs.current = {};
    await playChunk(0);
  }, [playChunk]);

  const pause = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.play();
      setIsPaused(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    setIsPlaying(false);
    setIsPaused(false);
    audioRefs.current = {};
  }, []);

  return { isPlaying, isPaused, voiceName, speed, progress, availableVoices: AVAILABLE_VOICES, startReading, pause, resume, stop, setVoiceName: (v) => setVoiceName(v), setSpeed: (s) => setSpeed(Math.max(0.5, Math.min(2.0, s))) };
}
