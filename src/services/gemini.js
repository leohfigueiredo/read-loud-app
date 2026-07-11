import { GoogleGenerativeAI } from '@google/generative-ai';

// gemini-2.5-flash: modelo atual do Google (substitui o 2.0-flash que foi descontinuado)
const MODEL = 'gemini-2.5-flash';

let aiInstance = null;
let rawApiKey = '';

// Initialize the Gemini SDK with the user's API Key
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
  
  // Lista de modelos para tentar em ordem
  const modelsToTry = [
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
        // Guardamos o modelo que funcionou
        window._workingGeminiModel = modelName;
        return `Conexão bem sucedida com ${modelName} ✅`;
      }
    } catch (e) {
      lastError = e.message;
      continue; // tenta o próximo
    }
  }
  
  throw new Error(`Nenhum modelo disponível. Último erro: ${lastError}`);
}

export async function generateGeminiAudio(text, voiceName = 'Aoede') {
  if (!rawApiKey) throw new Error("Chave da API Gemini não configurada.");
  
  // A geração de áudio TTS usa o modelo gemini-2.5-flash-preview-tts via v1beta
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${rawApiKey}`;
  
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
    throw new Error(err.error?.message || "Erro na conexão com Gemini TTS");
  }
  
  const data = await response.json();
  const audioPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData && p.inlineData.mimeType.startsWith('audio/'));
  
  if (audioPart) {
    const base64Audio = audioPart.inlineData.data;
    const mimeType = audioPart.inlineData.mimeType || 'audio/wav';
    return `data:${mimeType};base64,${base64Audio}`;
  }
  throw new Error("A API do Gemini não retornou áudio.");
}

export async function translateText(text, targetLanguage = 'Portuguese') {
  if (!aiInstance) throw new Error("Chave da API Gemini não configurada.");
  
  const chunks = chunkText(text);
  const results = [];

  for (const chunk of chunks) {
    const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text, nothing else.\n\n${chunk}`;
    const model = aiInstance.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    results.push(result.response.text());
  }

  return results.join(' ');
}

export async function explainWord(word, context, language = 'Portuguese') {
  if (!aiInstance) throw new Error("Chave da API Gemini não configurada.");
  
  const prompt = `Explain the meaning of the word "${word}" in the context of the following sentence:\n"${context}"\n\nExplain it in ${language} concisely. Provide the definition and why it fits this context.`;
  const model = aiInstance.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export async function generateCatchMeUp(text, language = 'Portuguese') {
  if (!aiInstance) throw new Error("Chave da API Gemini não configurada.");
  
  // For "Catch Me Up", we want a summary of the whole text provided. 
  const chunks = chunkText(text, 15000); // Larger chunks for summarization context
  let accumulatedSummary = "";

  for (const chunk of chunks) {
    const prompt = `I am reading a book. Here is the text I have read so far:\n\n${chunk}\n\nProvide a concise and engaging "Catch Me Up" summary of what has happened in this segment, in ${language}. Focus on the main plot points or key ideas. Do not spoil anything beyond this text.`;
    const model = aiInstance.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    accumulatedSummary += result.response.text() + "\n\n";
  }

  return accumulatedSummary;
}

/**
 * New function for direct chat/questions about the text.
 */
export async function askQuestionAboutText(question, context, language = 'Portuguese') {
  if (!aiInstance) throw new Error("Chave da API Gemini não configurada.");

  const prompt = `Contexto do livro: ${context}\n\nPergunta do usuário: ${question}\n\nResponda de forma concisa e útil em ${language}.`;
  const model = aiInstance.getGenerativeModel({ model: MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text();
}