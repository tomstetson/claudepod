require('dotenv/config');

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const pty = require('node-pty');
const tmux = require('./lib/tmux');
const notifications = require('./lib/notifications');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Track active sessions (which sessions have connected clients)
const activeSessions = new Map(); // sessionName -> Set of WebSocket clients

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API: List sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = tmux.listSessions();
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Create session
app.post('/api/sessions', (req, res) => {
  try {
    const { name } = req.body || {};
    const sessionName = tmux.createSession(name);
    res.json({ name: sessionName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// WebSocket: Terminal connection
wss.on('connection', (ws, req) => {
  // Extract session name from URL: /terminal/sessionName
  const match = req.url.match(/^\/terminal\/([a-zA-Z0-9_-]+)$/);
  if (!match) {
    ws.close(4000, 'Invalid URL. Use /terminal/<session_name>');
    return;
  }

  const sessionName = match[1];

  // Check if session exists
  if (!tmux.sessionExists(sessionName)) {
    ws.close(4001, `Session "${sessionName}" not found`);
    return;
  }

  console.log(`Client connected to session: ${sessionName}`);

  // Track this as an active session
  if (!activeSessions.has(sessionName)) {
    activeSessions.set(sessionName, new Set());
  }
  activeSessions.get(sessionName).add(ws);

  // Clear notification debounce since user is viewing
  notifications.clearDebounce(sessionName);

  // Spawn pty attached to tmux session
  const ptyProcess = pty.spawn('tmux', ['attach', '-t', sessionName], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env
  });

  // Buffer for prompt detection
  let outputBuffer = '';

  // Send terminal output to WebSocket
  ptyProcess.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }

    // Check for prompts (only if no clients are viewing this session)
    outputBuffer += data;
    if (outputBuffer.length > 1000) {
      outputBuffer = outputBuffer.slice(-500);
    }

    // Check if this session is being actively viewed
    const viewers = activeSessions.get(sessionName);
    const isActive = viewers && viewers.size > 0;
    notifications.checkAndNotify(sessionName, outputBuffer, isActive);
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`PTY exited for session ${sessionName} with code ${exitCode}`);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      ws.close(1000, 'Session ended');
    }
  });

  // Handle incoming messages from WebSocket
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.type) {
        case 'input':
          ptyProcess.write(msg.data);
          break;

        case 'resize':
          if (msg.cols && msg.rows) {
            ptyProcess.resize(msg.cols, msg.rows);
          }
          break;
      }
    } catch (err) {
      console.error('Invalid message:', err.message);
    }
  });

  // Cleanup on disconnect
  ws.on('close', () => {
    console.log(`Client disconnected from session: ${sessionName}`);

    // Remove from active sessions
    const viewers = activeSessions.get(sessionName);
    if (viewers) {
      viewers.delete(ws);
      if (viewers.size === 0) {
        activeSessions.delete(sessionName);
      }
    }

    // Kill the pty process (detaches from tmux, doesn't kill the session)
    ptyProcess.kill();
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for session ${sessionName}:`, err.message);
    ptyProcess.kill();
  });
});

// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ClaudePod running at http://0.0.0.0:${PORT}`);
  console.log(`Access via Tailscale at http://<your-tailscale-ip>:${PORT}`);
});
