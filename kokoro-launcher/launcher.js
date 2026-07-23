const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const localtunnel = require('localtunnel');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5050;

let controlTunnel = null;
let readerTunnel = null;

// Reconnection logic for tunnels
async function startTunnel(port, subdomain) {
  try {
    const tunnel = await localtunnel({ port, subdomain });
    console.log(`[TUNNEL] Conectado: ${tunnel.url} -> localhost:${port}`);

    tunnel.on('close', () => {
      console.log(`[TUNNEL] ${subdomain} fechado. Reconectando em 10s...`);
      setTimeout(() => {
        // If it was explicitly closed by us, we might not want to reconnect
        // But for control tunnel, we always want to reconnect.
        if (subdomain === 'leocontrole' || readerTunnel === tunnel) {
          console.log(`[TUNNEL] Tentando reconectar ${subdomain}...`);
          startTunnel(port, subdomain).then(newT => {
            if (subdomain === 'leocontrole') controlTunnel = newT;
            if (subdomain === 'leoreader') readerTunnel = newT;
          });
        }
      }, 10000);
    });

    return tunnel;
  } catch (err) {
    console.error(`[TUNNEL] Erro ao iniciar ${subdomain}:`, err.message);
    setTimeout(() => startTunnel(port, subdomain), 10000);
  }
}

// Check Docker status
function checkKokoroStatus() {
  return new Promise((resolve) => {
    exec('docker inspect -f "{{.State.Running}}" kokoro-tts', (error, stdout) => {
      if (error) {
        resolve('stopped');
      } else {
        resolve(stdout.trim() === 'true' ? 'running' : 'stopped');
      }
    });
  });
}

// Endpoints
app.get('/status', async (req, res) => {
  const status = await checkKokoroStatus();
  res.json({ 
    status, 
    tunnelOnline: readerTunnel !== null && !readerTunnel.closed
  });
});

app.post('/start', async (req, res) => {
  console.log('[API] Iniciando Kokoro...');
  
  exec('docker start kokoro-tts', async (err) => {
    if (err) {
      console.error('[API] Erro ao iniciar Docker:', err);
      return res.status(500).json({ error: 'Erro ao iniciar docker' });
    }
    
    // Start the reader tunnel if not already open
    if (!readerTunnel || readerTunnel.closed) {
      readerTunnel = await startTunnel(8880, 'leoreader');
    }
    
    res.json({ success: true, status: 'running' });
  });
});

app.post('/stop', async (req, res) => {
  console.log('[API] Parando Kokoro...');
  
  exec('docker stop kokoro-tts', (err) => {
    if (err) {
      console.error('[API] Erro ao parar Docker:', err);
    }
    
    // Close the reader tunnel
    if (readerTunnel) {
      const t = readerTunnel;
      readerTunnel = null; // Prevent reconnect logic from reopening it
      t.close();
    }
    
    res.json({ success: true, status: 'stopped' });
  });
});

app.listen(PORT, async () => {
  console.log(`[SERVER] Servidor de Controle iniciado na porta ${PORT}`);
  
  // Start the control tunnel (always on)
  controlTunnel = await startTunnel(PORT, 'leocontrole');
  
  // Check if kokoro is already running, if so, ensure reader tunnel is up
  const status = await checkKokoroStatus();
  if (status === 'running') {
    console.log('[SERVER] Kokoro detectado como rodando, conectando túnel de leitura...');
    readerTunnel = await startTunnel(8880, 'leoreader');
  }
});
