import { settingsDB, trackApiUsage } from './storage';

let elApiKey = '';

// Memory cache to avoid duplicate billing (same as Gemini)
const audioCache = new Map();

// Popular multilingual voices available on free tier
export const ELEVENLABS_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (Feminina, EN)' },
  { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte (Feminina, Multilíngue)' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (Feminina, EN)' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam (Masculino, EN)' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel (Masculino, EN)' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill (Masculino, EN)' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica (Feminina, Multilíngue)' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura (Feminina, Multilíngue)' },
];

export function initElevenLabs(apiKey) {
  elApiKey = apiKey || '';
}

// Load key from DB on startup
settingsDB.getItem('elevenlabs_api_key').then(key => {
  if (key) elApiKey = key;
});

export async function generateElevenLabsAudio(text, voiceId = 'EXAVITQu4vr4xnSDxMaL') {
  if (!elApiKey) throw new Error('Chave da API ElevenLabs não configurada.');

  const cacheKey = `${text.trim()}_${voiceId}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey);
  }

  const response = await fetch('/api/elevenlabs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'tts',
      apiKey: elApiKey,
      text,
      voiceId,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Erro ElevenLabs: ${response.status}`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  audioCache.set(cacheKey, url);
  trackApiUsage('text', text.length); // track under 'text' cost bucket
  return url;
}

export async function testElevenLabsConnection(apiKey) {
  const response = await fetch('/api/elevenlabs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'test',
      apiKey,
    }),
  });

  if (response.status === 401) {
    throw new Error('Chave inválida ou expirada (401). Gere uma nova chave em elevenlabs.io.');
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Erro ${response.status} ao contactar ElevenLabs.`);
  }

  const data = await response.json();
  const limit   = data?.character_limit ?? 0;
  const used    = data?.character_count ?? 0;
  const remaining = limit - used;
  return `✅ Conectado! Plano: ${data?.tier ?? 'free'} — ${remaining.toLocaleString()} chars restantes este mês`;
}
