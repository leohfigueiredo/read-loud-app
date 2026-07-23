/**
 * Qwen3-TTS ComfyUI Service
 * Connects to a local/remote ComfyUI server running the ComfyUI-Qwen-TTS node pack.
 * https://github.com/flybirdxx/ComfyUI-Qwen-TTS
 */

import { settingsDB } from './storage';

// Default ComfyUI URL
const DEFAULT_COMFY_URL = 'http://127.0.0.1:8188';

/**
 * Test connection to ComfyUI server
 */
export async function testComfyUIConnection(url) {
  const targetUrl = (url || DEFAULT_COMFY_URL).replace(/\/$/, '');
  const headers = { 'bypass-tunnel-reminder': 'true' };
  try {
    const res = await fetch(`${targetUrl}/system_stats`, { headers });
    if (res.ok) {
      const data = await res.json();
      return `Conectado! ComfyUI executando na versão ${data.system?.os || 'desconhecida'}`;
    }
    throw new Error(`Status HTTP: ${res.status}`);
  } catch (err) {
    throw new Error(`Não foi possível conectar ao ComfyUI em ${targetUrl}. Verifique se o servidor está rodando.`);
  }
}

/**
 * Generate TTS Audio via Qwen3-TTS in ComfyUI
 * Returns a URL to the generated audio file
 */
export async function generateQwenAudio(text, onProgress) {
  // Load settings
  const comfyUrl = (await settingsDB.getItem('qwen_comfy_url') || DEFAULT_COMFY_URL).replace(/\/$/, '');
  const mode = await settingsDB.getItem('qwen_mode') || 'preset'; // 'preset' | 'design'
  const speaker = await settingsDB.getItem('qwen_speaker') || 'Serena';
  const instruct = await settingsDB.getItem('qwen_instruct') || '';
  const attention = await settingsDB.getItem('qwen_attention') || 'auto';

  onProgress?.('Enviando prompt ao ComfyUI...');

  // Construct workflow JSON for ComfyUI API
  const prompt = {};
  
  if (mode === 'design') {
    prompt["1"] = {
      "inputs": {
        "text": text,
        "instruct": instruct || "A clear and natural voice.",
        "model_choice": "1.7B",
        "attention": attention,
        "unload_model_after_generate": false
      },
      "class_type": "VoiceDesignNode"
    };
  } else {
    prompt["1"] = {
      "inputs": {
        "text": text,
        "speaker": speaker,
        "instruct": instruct,
        "attention": attention,
        "unload_model_after_generate": false
      },
      "class_type": "CustomVoiceNode"
    };
  }
  
  // Standard ComfyUI SaveAudio node
  prompt["2"] = {
    "inputs": {
      "filename_prefix": "qwen3_tts",
      "audio": ["1", 0]
    },
    "class_type": "SaveAudio"
  };

  const clientId = `read_loud_${Math.random().toString(36).substring(2, 11)}`;

  const headers = { 'bypass-tunnel-reminder': 'true' };
  const response = await fetch(`${comfyUrl}/prompt`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({ client_id: clientId, prompt })
  });

  if (!response.ok) {
    throw new Error(`Erro do ComfyUI ao iniciar a fila: Código ${response.status}`);
  }

  const data = await response.json();
  const promptId = data.prompt_id;

  onProgress?.('A gerar áudio no ComfyUI (aguardando finalização)...');

  // Poll ComfyUI History API to wait for completion
  let history = null;
  const startTime = Date.now();
  const timeout = 90000; // 90 seconds timeout
  
  while (!history) {
    if (Date.now() - startTime > timeout) {
      throw new Error("Tempo limite excedido ao aguardar a geração do áudio no ComfyUI.");
    }
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const histRes = await fetch(`${comfyUrl}/history/${promptId}`, { headers });
      if (histRes.ok) {
        const histData = await histRes.json();
        if (histData && histData[promptId]) {
          history = histData[promptId];
        }
      }
    } catch (e) {
      // Ignore network blips during polling
    }
  }

  // Extract outputs
  const outputs = history.outputs;
  if (!outputs || !outputs["2"] || !outputs["2"].audio || outputs["2"].audio.length === 0) {
    throw new Error("A geração falhou. Verifique o console do seu ComfyUI para ver o erro do Qwen3-TTS.");
  }

  const audioInfo = outputs["2"].audio[0];
  const audioUrl = `${comfyUrl}/view?filename=${encodeURIComponent(audioInfo.filename)}&type=${encodeURIComponent(audioInfo.type)}&subfolder=${encodeURIComponent(audioInfo.subfolder || '')}`;
  
  onProgress?.('ready');
  return audioUrl;
}
