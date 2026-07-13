import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = 'gemini-2.5-flash';

// 10 vozes disponíveis no Gemini TTS
export const AVAILABLE_VOICES = [
  { id: 'Aoede', label: '👩 Aoede (Feminina)' },
  { id: 'Puck', label: '👨 Puck (Masculina)' },
  { id: 'Charon', label: '👨 Charon (Graves)' },
  { id: 'Kore', label: '👩 Kore (Clara)' },
  { id: 'Fenrir', label: '🐺 Fenrir (Profunda)' },
  { id: 'Orion', label: '⭐ Orion (Neutra)' },
  { id: 'Stella', label: '✨ Stella (Suave)' },
  { id: 'Ember', label: '🔥 Ember (Quente)' },
  { id: 'Breeze', label: '💨 Breeze (Leve)' },
  { id: 'Echo', label: '📢 Echo (Eco)' },
];

let aiInstance = null;
let rawApiKey = '';

export function initGemini(apiKey) {
  if (!apiKey) {
    aiInstance = null;
    rawApiKey = '';
    return;
  }
  rawApiKey = apiKey;
  aiInstance = new GoogleGenerativeAI(apiKey);
}

// Helper to convert raw 16-bit PCM audio to a playable WAV data URL using native high-performance Blob + FileReader
async function convertRawPcmToWav(base64Pcm, sampleRate = 24000) {
  const rawBinary = atob(base64Pcm);
  const pcmLength = rawBinary.length;
  const buffer = new ArrayBuffer(44 + pcmLength);
  const view = new DataView(buffer);
  
  // WAV Header structure
  view.setUint32(0, 0x52494646, false); // 'RIFF'
  view.setUint32(4, 36 + pcmLength, true); // size
  view.setUint32(8, 0x57415645, false); // 'WAVE'
  view.setUint32(12, 0x666d7420, false); // 'fmt '
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // format (PCM = 1)
  view.setUint16(22, 1, true); // channels (mono = 1)
  view.setUint32(24, sampleRate, true); // sample rate
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  view.setUint32(36, 0x64617461, false); // 'data'
  view.setUint32(40, pcmLength, true); // data chunk size
  
  // Copy PCM data
  const uint8View = new Uint8Array(buffer, 44);
  for (let i = 0; i < pcmLength; i++) {
    uint8View[i] = rawBinary.charCodeAt(i);
  }
  
  // High-performance Base64 conversion
  const blob = new Blob([buffer], { type: 'audio/wav' });
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result); // already in "data:audio/wav;base64,..." format
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Advanced TTS with speed control, voice selection, and streaming
 */
export async function generateAdvancedTTS(text, options = {}) {
  const {
    voiceName = 'Aoede',
    speed = 1.0 // 0.5 - 2.0
  } = options;

  if (!rawApiKey) {
    throw new Error('API key não configurada');
  }

  // Modelos TTS disponíveis (em ordem de preferência)
  const modelsForAudio = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-3.1-flash-tts-preview'
  ];

  // Aplicar speed via prompt (gemini não suporta speed nativamente)
  const speedInstructions = speed !== 1.0 
    ? `\n[IMPORTANTE: Fale ${speed > 1 ? 'mais rápido' : 'mais lentamente'} (${(speed * 100).toFixed(0)}% da velocidade normal)]`
    : '';

  let lastErr = null;

  for (const modelName of modelsForAudio) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${rawApiKey}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: text + speedInstructions
            }]
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName }
              }
            }
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        lastErr = new Error(err.error?.message || `HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      const audioPart = data.candidates?.[0]?.content?.parts?.find(p => 
        p.inlineData && p.inlineData.mimeType.startsWith('audio/')
      );

      if (!audioPart) {
        lastErr = new Error('Nenhum áudio gerado');
        continue;
      }

      const base64Audio = audioPart.inlineData.data;
      const mimeType = audioPart.inlineData.mimeType || '';
      
      // Wrap raw PCM in a standard playable WAV container
      if (mimeType.includes('pcm') || mimeType.includes('audio/wav') || mimeType === '' || mimeType.includes('octet-stream')) {
        try {
          return await convertRawPcmToWav(base64Audio, 24000);
        } catch (e) {
          console.error("WAV wrapping failed, playing raw data:", e);
        }
      }
      return `data:${mimeType};base64,${base64Audio}`;
    } catch (err) {
      lastErr = err;
      continue;
    }
  }

  throw new Error(lastErr?.message || "Nenhum modelo de áudio Gemini disponível. Verifique sua chave de API e faturamento.");
}

/**
 * Chunk text intelligently for TTS streaming
 */
export function chunkTextForTTS(text, maxChars = 4000) {
  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';
  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChars && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());

  return chunks;
}

/**
 * Test Gemini connection
 */
export async function testGeminiConnection() {
  if (!rawApiKey) throw new Error('Chave da API não configurada');

  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
  ];

  const tempAi = new GoogleGenerativeAI(rawApiKey);
  let lastError = '';

  for (const modelName of modelsToTry) {
    try {
      const model = tempAi.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say OK');
      const text = result.response.text();
      if (text) {
        window._workingGeminiModel = modelName;
        return `Conexão bem sucedida com ${modelName} ✅`;
      }
    } catch (e) {
      lastError = e.message;
      continue;
    }
  }

  throw new Error(`Nenhum modelo disponível. Erro: ${lastError}`);
}

/**
 * Enhanced summarization with AI
 */
export async function generateCatchMeUp(text, language = 'Portuguese') {
  if (!aiInstance) throw new Error('API não configurada');

  const chunks = chunkTextForTTS(text, 15000);
  let accumulatedSummary = '';

  for (const chunk of chunks) {
    const prompt = `Texto do livro:\n\n${chunk}\n\nForneça um resumo conciso e envolvente em ${language}. Foco em pontos principais da trama ou ideias-chave. Não revele spoilers além deste texto.`;
    const model = aiInstance.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    accumulatedSummary += result.response.text() + '\n\n';
  }

  return accumulatedSummary;
}

/**
 * Question answering about text
 */
export async function askQuestionAboutText(question, context, language = 'Portuguese') {
  if (!aiInstance) throw new Error('API não configurada');

  const prompt = `Contexto do livro:\n${context}\n\nPergunta: ${question}\n\nResponda de forma concisa em ${language}.`;
  const model = aiInstance.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
