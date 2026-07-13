import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom dev server middleware to proxy ElevenLabs to bypass CORS locally in npm run dev
function elevenLabsDevProxy() {
  return {
    name: 'elevenlabs-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/elevenlabs' && req.method === 'POST') {
          try {
            let bodyStr = '';
            for await (const chunk of req) {
              bodyStr += chunk;
            }
            const { action, apiKey, text, voiceId } = JSON.parse(bodyStr);

            if (action === 'test') {
              const elRes = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
                headers: { 'xi-api-key': apiKey },
              });
              res.statusCode = elRes.status;
              res.setHeader('Content-Type', 'application/json');
              const data = await elRes.json();
              res.end(JSON.stringify(data));
              return;
            }

            if (action === 'tts') {
              const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                method: 'POST',
                headers: {
                  'xi-api-key': apiKey,
                  'Content-Type': 'application/json',
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
              });

              res.statusCode = elRes.status;
              if (elRes.ok) {
                res.setHeader('Content-Type', 'audio/mpeg');
                const arrayBuffer = await elRes.arrayBuffer();
                res.end(Buffer.from(arrayBuffer));
              } else {
                res.setHeader('Content-Type', 'application/json');
                const errText = await elRes.text();
                res.end(JSON.stringify({ error: errText }));
              }
              return;
            }
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }
        next();
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), elevenLabsDevProxy()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdf-worker'
          if (id.includes('epubjs')) return 'epub'
          if (id.includes('@google/generative-ai')) return 'gemini'
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor'
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    minify: 'terser'
  }
})
