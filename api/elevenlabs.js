export default async function handler(req, res) {
  // Add CORS headers for local development fallback
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, xi-api-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, apiKey, text, voiceId } = req.body || {};

  if (!apiKey) {
    return res.status(400).json({ error: 'Chave de API não configurada.' });
  }

  try {
    if (action === 'test') {
      const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
        headers: { 'xi-api-key': apiKey },
      });

      if (response.status === 401) {
        return res.status(401).json({ error: 'Chave inválida ou expirada (401).' });
      }

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `Erro ElevenLabs: ${errText}` });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } 
    
    if (action === 'tts') {
      if (!text || !voiceId) {
        return res.status(400).json({ error: 'Parâmetros em falta (text ou voiceId).' });
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.8,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `Erro ElevenLabs: ${errText}` });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', 'audio/mpeg');
      return res.status(200).send(buffer);
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
