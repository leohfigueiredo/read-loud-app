/**
 * Kokoro-FastAPI Local Server Service
 * Connects to a local/remote Kokoro-FastAPI Docker container or server.
 * https://github.com/remsky/Kokoro-FastAPI
 */

import { settingsDB } from './storage';

const DEFAULT_KOKORO_URL = 'http://127.0.0.1:8880';

const kokoroAudioCache = new Map();
const MAX_CACHE_SIZE = 20;

/**
 * Test connection to Kokoro FastAPI server
 */
export async function testKokoroServerConnection(url) {
  const targetUrl = (url || DEFAULT_KOKORO_URL).replace(/\/$/, '');
  const headers = { 
    'bypass-tunnel-reminder': 'true',
    'ngrok-skip-browser-warning': 'true'
  };
  try {
    // Check Swagger docs endpoint or web UI to verify server response
    const res = await fetch(`${targetUrl}/web/`, { headers });
    if (res.ok) {
      return `Conectado! Kokoro-FastAPI executando com sucesso.`;
    }
    // Fallback: check root or health
    const resRoot = await fetch(`${targetUrl}/`, { headers });
    if (resRoot.ok) {
      return `Conectado! Servidor respondendo.`;
    }
    throw new Error(`Status HTTP: ${res.status}`);
  } catch (err) {
    throw new Error(`Não foi possível conectar ao Kokoro-FastAPI em ${targetUrl}. Verifique se o container Docker está rodando.`);
  }
}

/**
 * Generate Speech Audio from Local Kokoro-FastAPI Server
 * Returns a blob URL to the generated audio file
 */
export async function generateKokoroServerAudio(text, onProgress) {
  const serverUrl = (await settingsDB.getItem('kokoro_server_url') || DEFAULT_KOKORO_URL).replace(/\/$/, '');
  const voice = await settingsDB.getItem('kokoro_server_voice') || 'af_heart';
  
  const cacheKey = `${voice}_${text}`;
  if (kokoroAudioCache.has(cacheKey)) {
    onProgress?.('ready');
    return kokoroAudioCache.get(cacheKey);
  }

  onProgress?.('Gerando áudio via Kokoro local...');

  const response = await fetch(`${serverUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'bypass-tunnel-reminder': 'true',
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({
      model: 'kokoro',
      input: text,
      voice: voice,
      response_format: 'mp3',
      speed: 1.0
    })
  });

  if (!response.ok) {
    throw new Error(`Erro do Kokoro-FastAPI: Código ${response.status}`);
  }

  const blob = await response.blob();
  const audioUrl = URL.createObjectURL(blob);
  
  kokoroAudioCache.set(cacheKey, audioUrl);
  if (kokoroAudioCache.size > MAX_CACHE_SIZE) {
    const firstKey = kokoroAudioCache.keys().next().value;
    URL.revokeObjectURL(kokoroAudioCache.get(firstKey));
    kokoroAudioCache.delete(firstKey);
  }
  
  onProgress?.('ready');
  return audioUrl;
}
