import { GoogleGenerativeAI } from '@google/generative-ai';
import { settingsDB, trackApiUsage } from './storage';

// Default model if none detected/saved yet
let currentModel = 'gemini-2.5-flash';
let aiInstance = null;
let rawApiKey = '';

// Memory caches to prevent duplicate billing
const audioCache = new Map();
const translationCache = new Map();
const explanationCache = new Map();

// Load the working model from DB on startup
settingsDB.getItem('gemini_model').then(savedModel => {
  if (savedModel) {
    currentModel = savedModel;
  }
});

// Initialize the Gemini SDK with the user's API Key and selected model
export function initGemini(apiKey, modelName = null) {
  if (!apiKey) {
    aiInstance = null;
    rawApiKey = '';
    return;
  }
  rawApiKey = apiKey;
  aiInstance = new GoogleGenerativeAI(apiKey);
  
  if (modelName) {
    currentModel = modelName;
  } else {
    // Reload saved model preference
    settingsDB.getItem('gemini_model').then(savedModel => {
      if (savedModel) {
        currentModel = savedModel;
      }
    });
  }
}

/**
 * Helper to chunk text into manageable pieces for LLM context limits and cost control.
 */
function chunkText(text, maxChars = 8000) {
  const chunks = [];
  let currentPos = 0;

  while (currentPos < text.length) {
    let endPos = currentPos + maxChars;
    
    // Try to find a natural break at the end of a sentence/paragraph within the chunk limit
    if (endPos < text.length) {
      const lastSentenceEnd = text.lastIndexOf('.', endPos);
      const lastParagraphEnd = text.lastIndexOf('\n', endPos);
      
      if (lastSentenceEnd > currentPos && lastSentenceEnd > lastParagraphEnd) {
        endPos = lastSentenceEnd + 1;
      } else if (lastParagraphEnd > currentPos) {
        endPos = lastParagraphEnd;
      }
    }

    chunks.push(text.substring(currentPos, endPos).trim());
    currentPos = endPos;
  }

  return chunks;
}

export async function testGeminiConnection() {
  if (!rawApiKey) throw new Error("Chave da API não configurada.");
  
  // Lista de modelos para tentar em ordem (incluindo o novo gemini-3.5-flash)
  const modelsToTry = [
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
  ];

  const tempAi = new GoogleGenerativeAI(rawApiKey);
  let lastError = '';
  
  for (const modelName of modelsToTry) {
    try {
      const model = tempAi.getGenerativeModel({ model: modelName });
      const result = await model.generateContent('Say OK');
      const text = result.response.text();
      if (text) {
        // Guardamos o modelo que funcionou no banco de dados e na memória
        await settingsDB.setItem('gemini_model', modelName);
        currentModel = modelName;
        return `Conexão bem sucedida com ${modelName} ✅`;
      }
    } catch (e) {
      lastError = e.message;
      continue; // tenta o próximo
    }
  }
  
  throw new Error(`Nenhum modelo disponível. Último erro: ${lastError}`);
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

export async function generateGeminiAudio(text, voiceName = 'Aoede') {
  if (!rawApiKey) throw new Error("Chave da API Gemini não configurada.");
  
  const cacheKey = `${text.trim()}_${voiceName}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey);
  }
  
  const modelsForAudio = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-preview-tts',
    'gemini-3.1-flash-tts-preview'
  ];

  let lastErr = null;

  for (const modelName of modelsForAudio) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${rawApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
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
        throw new Error(err.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const audioPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith('audio/'));
      
      if (audioPart) {
        const base64Audio = audioPart.inlineData.data;
        const mimeType = audioPart.inlineData.mimeType || '';
        
        const resultUrl = mimeType.includes('pcm') || mimeType.includes('audio/wav') || mimeType === '' || mimeType.includes('octet-stream')
          ? await convertRawPcmToWav(base64Audio, 24000)
          : `data:${mimeType};base64,${base64Audio}`;
          
        audioCache.set(cacheKey, resultUrl);
        trackApiUsage('tts', text.length);
        return resultUrl;
      }
    } catch (err) {
      lastErr = err;
      continue; // Tenta o próximo modelo
    }
  }

  throw new Error(lastErr?.message || "Nenhum modelo de áudio Gemini disponível ou faturamento não ativado.");
}

export async function translateText(text, targetLanguage = 'Portuguese') {
  if (!aiInstance) throw new Error("Chave da API Gemini não configurada.");
  
  const cacheKey = `${text.trim()}_${targetLanguage}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }
  
  const chunks = chunkText(text);
  const results = [];

  for (const chunk of chunks) {
    const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text, nothing else.\n\n${chunk}`;
    const model = aiInstance.getGenerativeModel({ model: currentModel });
    const result = await model.generateContent(prompt);
    results.push(result.response.text());
  }

  const resultText = results.join(' ');
  translationCache.set(cacheKey, resultText);
  trackApiUsage('text', text.length);
  return resultText;
}

export async function explainWord(word, context, language = 'Portuguese') {
  if (!aiInstance) throw new Error("Chave da API Gemini não configurada.");
  
  const cacheKey = `${word.trim()}_${context.trim()}_${language}`;
  if (explanationCache.has(cacheKey)) {
    return explanationCache.get(cacheKey);
  }
  
  const prompt = `Explain the meaning of the word "${word}" in the context of the following sentence:\n"${context}"\n\nExplain it in ${language} concisely. Provide the definition and why it fits this context.`;
  const model = aiInstance.getGenerativeModel({ model: currentModel });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const resultText = response.text();
  
  explanationCache.set(cacheKey, resultText);
  trackApiUsage('text', word.length + context.length);
  return resultText;
}

export async function generateCatchMeUp(text, language = 'Portuguese') {
  if (!aiInstance) throw new Error("Chave da API Gemini não configurada.");
  
  const chunks = chunkText(text, 15000); // Larger chunks for summarization context
  let accumulatedSummary = "";

  for (const chunk of chunks) {
    const prompt = `I am reading a book. Here is the text I have read so far:\n\n${chunk}\n\nProvide a concise and engaging "Catch Me Up" summary of what has happened in this segment, in ${language}. Focus on the main plot points or key ideas. Do not spoil anything beyond this text.`;
    const model = aiInstance.getGenerativeModel({ model: currentModel });
    const result = await model.generateContent(prompt);
    accumulatedSummary += result.response.text() + "\n\n";
    trackApiUsage('text', chunk.length);
  }

  return accumulatedSummary;
}

export async function askQuestionAboutText(question, context, language = 'Portuguese') {
  if (!aiInstance) throw new Error("Chave da API Gemini não configurada.");

  const prompt = `Contexto do livro: ${context}\n\nPergunta do usuário: ${question}\n\nResponda de forma concisa e útil em ${language}.`;
  const model = aiInstance.getGenerativeModel({ model: currentModel });
  const result = await model.generateContent(prompt);
  return result.response.text();
}