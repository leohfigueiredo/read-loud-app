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

/**
 * Advanced TTS with speed control, voice selection, and streaming
 */
export async function generateAdvancedTTS(text, options = {}) {
  const {
    voiceName = 'Aoede',
    speed = 1.0, // 0.5 - 2.0
    startByteOffset = 0
  } = options;

  if (!rawApiKey) {
    throw new Error('API key não configurada');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${rawApiKey}`;

  // Aplicar speed via prompt (gemini não suporta speed nativamente)
  const speedInstructions = speed !== 1.0 
    ? `\n[IMPORTANTE: Fale ${speed > 1 ? 'mais rápido' : 'mais lentamente'} (${(speed * 100).toFixed(0)}% da velocidade normal)]`
    : '';

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
    throw new Error(err.error?.message || 'Erro na TTS');
  }

  const data = await response.json();
  const audioPart = data.candidates?.[0]?.content?.parts?.find(p => 
    p.inlineData && p.inlineData.mimeType.startsWith('audio/')
  );

  if (!audioPart) {
    throw new Error('Nenhum áudio gerado');
  }

  const base64Audio = audioPart.inlineData.data;
  const mimeType = audioPart.inlineData.mimeType || 'audio/wav';
  return `data:${mimeType};base64,${base64Audio}`;
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
