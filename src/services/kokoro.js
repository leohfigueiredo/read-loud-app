/**
 * Kokoro TTS Service
 * Open-source neural TTS running 100% in the browser (no API key needed).
 * Supports pt-BR natively. Downloads ~80MB model on first use, then cached.
 * https://github.com/hexgrad/kokoro
 */

let kokoroInstance = null;
let isLoading = false;
let loadError = null;
const audioCache = new Map();

// Only voices actually bundled in kokoro-js v1.2.1 (no Portuguese yet in browser build)
export const KOKORO_VOICES = [
  // 🇬🇧 British English — Femininas
  { id: 'bf_emma',     name: '🇬🇧 Emma (Feminina – Qualidade B)' },
  { id: 'bf_isabella', name: '🇬🇧 Isabella (Feminina)' },
  { id: 'bf_alice',    name: '🇬🇧 Alice (Feminina)' },
  { id: 'bf_lily',     name: '🇬🇧 Lily (Feminina)' },
  // 🇬🇧 British English — Masculinos
  { id: 'bm_george',   name: '🇬🇧 George (Masculino)' },
  { id: 'bm_fable',    name: '🇬🇧 Fable (Masculino – Expressivo)' },
  { id: 'bm_lewis',    name: '🇬🇧 Lewis (Masculino)' },
  { id: 'bm_daniel',   name: '🇬🇧 Daniel (Masculino)' },
  // 🇺🇸 American English — Femininas
  { id: 'af_heart',    name: '🇺🇸 Heart (Feminina – Melhor Qualidade)' },
  { id: 'af_bella',    name: '🇺🇸 Bella (Feminina – Alta Qualidade)' },
  { id: 'af_nicole',   name: '🇺🇸 Nicole (Feminina – Suave)' },
  { id: 'af_sarah',    name: '🇺🇸 Sarah (Feminina)' },
  // 🇺🇸 American English — Masculinos
  { id: 'am_fenrir',   name: '🇺🇸 Fenrir (Masculino)' },
  { id: 'am_michael',  name: '🇺🇸 Michael (Masculino)' },
  { id: 'am_puck',     name: '🇺🇸 Puck (Masculino – Expressivo)' },
];


export function getKokoroStatus() {
  if (kokoroInstance) return 'ready';
  if (isLoading) return 'loading';
  if (loadError) return 'error';
  return 'idle';
}

export async function initKokoro(onProgress) {
  if (kokoroInstance) return kokoroInstance;
  if (isLoading) {
    // Wait for existing load
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (kokoroInstance) { clearInterval(check); resolve(kokoroInstance); }
        if (loadError)      { clearInterval(check); reject(loadError); }
      }, 500);
    });
  }

  isLoading = true;
  loadError = null;
  onProgress?.('A carregar modelo de voz neural (~80MB)...');

  try {
    const { KokoroTTS, env } = await import('./kokoro.web.js');

    // Configure local WASM paths to load from public directory
    env.wasmPaths = '/';

    const isMobile = typeof navigator !== 'undefined' && 
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Force WASM on mobile devices to prevent WebGPU precision (FP16) driver bugs 
    // that output NaNs (causing screeching/beeping audio) on mobile GPUs.
    const device = (typeof navigator !== 'undefined' && navigator.gpu && !isMobile) ? 'webgpu' : 'wasm';
    onProgress?.(`Usando backend: ${device.toUpperCase()}`);

    kokoroInstance = await KokoroTTS.from_pretrained(
      'onnx-community/Kokoro-82M-v1.0-ONNX',
      { dtype: 'q8', device }
    );

    isLoading = false;
    onProgress?.('ready');
    return kokoroInstance;
  } catch (err) {
    isLoading = false;
    loadError = err;
    throw err;
  }
}

// Valid voices in kokoro-js — fallback to af_heart if an old/invalid ID is used
const VALID_VOICE_IDS = new Set(['af_heart','af_bella','af_nicole','af_sarah','af_alloy','af_aoede','af_jessica','af_kore','af_nova','af_river','af_sky','am_adam','am_echo','am_eric','am_fenrir','am_liam','am_michael','am_onyx','am_puck','am_santa','bf_emma','bf_isabella','bf_alice','bf_lily','bm_george','bm_lewis','bm_daniel','bm_fable']);

export async function generateKokoroAudio(text, voiceId = 'af_heart', onProgress) {
  // Fallback if old/unsupported voice selected (e.g. pf_dora which doesn't exist)
  if (!VALID_VOICE_IDS.has(voiceId)) voiceId = 'af_heart';
  const cacheKey = `${text.trim()}_${voiceId}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey);
  }

  const tts = await initKokoro(onProgress);
  const audio = await tts.generate(text, { voice: voiceId });

  // RawAudio from @huggingface/transformers stores data as this.audio (NOT .data)
  const rawData = audio.audio;
  if (!rawData || rawData.length === 0) {
    throw new Error('Sem dados de áudio gerados pelo Kokoro.');
  }

  // Copy the WASM memory view into a clean, isolated Float32Array.
  // Without this, any encoder reads from byte 0 of the entire WASM heap.
  const cleanData = new Float32Array(rawData);
  const sampleRate = audio.sampling_rate || 24000;

  const result = { data: cleanData, sampleRate };
  audioCache.set(cacheKey, result);
  return result;
}

/**
 * Play Kokoro audio directly via Web Audio API — no <audio> element, no blob URL.
 * This is the only reliable approach on Android/HarmonyOS mobile browsers.
 * @returns controller with { pause, resume, stop }
 */
export function playKokoroAudio({ data, sampleRate }, onEnded) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx({ sampleRate });

  const audioBuffer = ctx.createBuffer(1, data.length, sampleRate);
  audioBuffer.copyToChannel(data, 0);

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.onended = () => {
    ctx.close().catch(() => {});
    onEnded?.();
  };
  source.start(0);

  return {
    pause:  () => ctx.suspend().catch(() => {}),
    resume: () => ctx.resume().catch(() => {}),
    stop:   () => { try { source.stop(0); } catch {} ctx.close().catch(() => {}); },
  };
}
