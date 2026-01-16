require('dotenv').config({ quiet: true });

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const path = require('path');
const pty = require('node-pty');
const tmux = require('./lib/tmux');
const notifications = require('./lib/notifications');
const sessions = require('./lib/sessions');

// Base projects directory
const PROJECTS_DIR = process.env.CLAUDEPOD_PROJECTS_DIR || process.env.HOME;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Security headers - relaxed CSP for local network use
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP - app runs on trusted local network
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Track active sessions (which sessions have connected clients)
const activeSessions = new Map(); // sessionName -> Set of WebSocket clients

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API: List sessions
app.get('/api/sessions', (req, res) => {
  try {
    const tmuxSessions = tmux.listSessions();
    const meta = sessions.getAllMeta();

    // Enrich sessions with labels and notification settings
    const enriched = tmuxSessions.map(s => ({
      ...s,
      label: meta[s.name]?.label || null,
      notifications: meta[s.name]?.notifications !== false
    }));

    // Cleanup stale metadata
    sessions.cleanup(tmuxSessions);

    res.json({ sessions: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Set session label
app.put('/api/sessions/:name/label', (req, res) => {
  try {
    const { name } = req.params;
    const { label } = req.body || {};

    // Validate session name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    // Validate label (allow empty to clear)
    if (label && typeof label !== 'string') {
      return res.status(400).json({ error: 'Label must be a string' });
    }

    const cleanLabel = label ? label.trim().slice(0, 50) : null;

    if (cleanLabel) {
      sessions.setLabel(name, cleanLabel);
    } else {
      sessions.deleteMeta(name);
    }

    res.json({ success: true, name, label: cleanLabel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Toggle notifications for a session
app.put('/api/sessions/:name/notifications', (req, res) => {
  try {
    const { name } = req.params;
    const { enabled } = req.body || {};

    // Validate session name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid session name' });
    }

    // Validate enabled flag
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }

    sessions.setNotifications(name, enabled);

    res.json({ success: true, name, notifications: enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Create session
app.post('/api/sessions', (req, res) => {
  try {
    const { name, directory, skipPermissions } = req.body || {};
    const sessionName = tmux.createSession(name, directory, { skipPermissions: !!skipPermissions });
    res.json({ name: sessionName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// API: List directories
app.get('/api/directories', (req, res) => {
  try {
    const relativePath = req.query.path || '';

    // Strict sanitization - remove any path traversal attempts
    const cleanPath = relativePath
      .split(/[/\\]+/)
      .filter(segment => segment && segment !== '.' && segment !== '..')
      .join('/');

    const fullPath = path.resolve(PROJECTS_DIR, cleanPath);

    // Double-check we're still within PROJECTS_DIR
    if (!fullPath.startsWith(path.resolve(PROJECTS_DIR))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if path exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }

    // List directory contents
    const entries = fs.readdirSync(fullPath, { withFileTypes: true })
      .filter(entry => {
        // Only show directories, hide hidden files
        return entry.isDirectory() && !entry.name.startsWith('.');
      })
      .map(entry => ({
        name: entry.name,
        path: cleanPath ? `${cleanPath}/${entry.name}` : entry.name
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      current: cleanPath || '/',
      parent: cleanPath ? path.dirname(cleanPath) || null : null,
      directories: entries,
      base: PROJECTS_DIR
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Create directory
app.post('/api/directories', (req, res) => {
  try {
    const { path: relativePath, name } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // Validate folder name - only allow safe characters
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_\-. ]*$/.test(name)) {
      return res.status(400).json({ error: 'Invalid folder name. Use letters, numbers, spaces, dashes, underscores, and dots.' });
    }

    // Sanitize parent path
    const cleanPath = (relativePath || '')
      .split(/[/\\]+/)
      .filter(segment => segment && segment !== '.' && segment !== '..')
      .join('/');

    const parentPath = path.resolve(PROJECTS_DIR, cleanPath);

    // Verify parent is within PROJECTS_DIR
    if (!parentPath.startsWith(path.resolve(PROJECTS_DIR))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check parent exists
    if (!fs.existsSync(parentPath)) {
      return res.status(404).json({ error: 'Parent directory not found' });
    }

    const newFolderPath = path.join(parentPath, name);

    // Check new folder path is still within PROJECTS_DIR
    if (!newFolderPath.startsWith(path.resolve(PROJECTS_DIR))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if folder already exists
    if (fs.existsSync(newFolderPath)) {
      return res.status(409).json({ error: 'Folder already exists' });
    }

    // Create the directory
    fs.mkdirSync(newFolderPath, { recursive: true });

    res.json({
      success: true,
      path: cleanPath ? `${cleanPath}/${name}` : name,
      fullPath: newFolderPath
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Kill session
app.delete('/api/sessions/:name', (req, res) => {
  try {
    const { name } = req.params;
    tmux.killSession(name);
    res.json({ success: true, name });
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

  // Validate origin (allow local network and Tailscale)
  const origin = req.headers.origin;
  const allowedPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
    /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
    /^https?:\/\/100\.\d+\.\d+\.\d+(:\d+)?$/,  // Tailscale CGNAT range
  ];

  if (origin && !allowedPatterns.some(p => p.test(origin))) {
    console.warn(`Rejected WebSocket from origin: ${origin}`);
    ws.close(4003, 'Invalid origin');
    return;
  }

  // Check if session exists
  if (!tmux.sessionExists(sessionName)) {
    console.log(`Session not found: ${sessionName}`);
    ws.close(4001, `Session "${sessionName}" not found`);
    return;
  }

  console.log(`Client connected to session: ${sessionName} from origin: ${origin || 'none'}`);

  // Track this as an active session
  if (!activeSessions.has(sessionName)) {
    activeSessions.set(sessionName, new Set());
  }
  activeSessions.get(sessionName).add(ws);

  // Clear notification debounce since user is viewing
  notifications.clearDebounce(sessionName);

  // Spawn pty attached to tmux session
  const tmuxPath = process.env.TMUX_PATH || '/opt/homebrew/bin/tmux';
  let ptyProcess;
  try {
    console.log(`Spawning PTY for session ${sessionName}...`);
    ptyProcess = pty.spawn(tmuxPath, ['attach', '-t', sessionName], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME,
      env: process.env
    });
    console.log(`PTY spawned for session ${sessionName}, PID: ${ptyProcess.pid}`);
  } catch (err) {
    console.error(`Failed to spawn pty for session ${sessionName}:`, err.message);
    ws.send(JSON.stringify({ type: 'error', message: `Failed to attach: ${err.message}` }));
    ws.close(4002, `Failed to spawn PTY: ${err.message}`);
    activeSessions.get(sessionName)?.delete(ws);
    return;
  }

  // Buffer for prompt detection
  let outputBuffer = '';
  let dataEventCount = 0;

  // Send terminal output to WebSocket
  ptyProcess.onData((data) => {
    dataEventCount++;
    if (dataEventCount <= 3) {
      console.log(`PTY data event #${dataEventCount} for ${sessionName}, ws.readyState: ${ws.readyState}`);
    }
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

    // Only send notifications if enabled for this session
    if (sessions.getNotifications(sessionName)) {
      notifications.checkAndNotify(sessionName, outputBuffer, isActive);
    }
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`PTY exited for session ${sessionName} with code ${exitCode}, signal ${signal}, dataEvents: ${dataEventCount}`);
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

        case 'ping':
          // Echo back for latency measurement
          ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
          break;
      }
    } catch (err) {
      console.error('Invalid message:', err.message);
    }
  });

  // Cleanup on disconnect
  ws.on('close', (code, reason) => {
    console.log(`Client disconnected from session: ${sessionName} (code: ${code}, reason: ${reason || 'none'})`);

    // Remove from active sessions
    const viewers = activeSessions.get(sessionName);
    if (viewers) {
      viewers.delete(ws);
      if (viewers.size === 0) {
        activeSessions.delete(sessionName);
      }
    }

    // Kill the pty process (detaches from tmux, doesn't kill the session)
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });

  ws.on('error', (err) => {
    console.error(`WebSocket error for session ${sessionName}:`, err.message);
    if (ptyProcess) {
      ptyProcess.kill();
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Catch-all: serve index.html for SPA routing
// Express 5 requires named wildcards
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Close WebSocket connections
  wss.clients.forEach(client => {
    client.close(1001, 'Server shutting down');
  });

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ClaudePod running at http://0.0.0.0:${PORT}`);
  console.log(`Access via Tailscale at http://<your-tailscale-ip>:${PORT}`);
});
