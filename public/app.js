// ClaudePod - Web Terminal Client

class ClaudePod {
  constructor() {
    this.terminal = null;
    this.fitAddon = null;
    this.socket = null;
    this.currentSession = null;
    this.sessions = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;

    this.init();
  }

  async init() {
    this.setupTerminal();
    this.setupEventListeners();
    await this.loadSessions();

    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registered');
      } catch (err) {
        console.warn('Service worker registration failed:', err);
      }
    }
  }

  setupTerminal() {
    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0f0f1a',
        foreground: '#e8e8e8',
        cursor: '#6c63ff',
        cursorAccent: '#0f0f1a',
        selectionBackground: 'rgba(108, 99, 255, 0.3)',
        black: '#1a1a2e',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e8e8e8',
        brightBlack: '#4a4a6a',
        brightRed: '#fca5a5',
        brightGreen: '#86efac',
        brightYellow: '#fcd34d',
        brightBlue: '#93c5fd',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#ffffff'
      },
      allowTransparency: false,
      scrollback: 5000,
      tabStopWidth: 4
    });

    this.fitAddon = new FitAddon.FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    this.terminal.loadAddon(webLinksAddon);

    const terminalEl = document.getElementById('terminal');
    this.terminal.open(terminalEl);
    this.fitAddon.fit();

    // Handle resize
    window.addEventListener('resize', () => {
      this.fitAddon.fit();
      this.sendResize();
    });

    // Handle terminal input
    this.terminal.onData((data) => {
      this.sendInput(data);
    });

    // Show empty state initially
    this.showEmptyState();
  }

  setupEventListeners() {
    // Session selector
    const sessionSelect = document.getElementById('session-select');
    sessionSelect.addEventListener('change', (e) => {
      const sessionName = e.target.value;
      if (sessionName) {
        this.connectToSession(sessionName);
      }
    });

    // New session button
    const newSessionBtn = document.getElementById('new-session-btn');
    newSessionBtn.addEventListener('click', () => this.createNewSession());

    // Quick action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.dataset.input;
        const key = btn.dataset.key;

        if (input) {
          this.sendInput(input);
        } else if (key) {
          this.sendKey(key);
        }

        // Focus terminal after button press
        this.terminal.focus();
      });
    });

    // Handle visibility change (for notification debouncing)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.currentSession) {
        // Could notify server that user is active
      }
    });
  }

  async loadSessions() {
    try {
      const response = await fetch('/api/sessions');
      const data = await response.json();
      this.sessions = data.sessions || [];
      this.updateSessionSelect();

      // Auto-connect to first session if available
      if (this.sessions.length > 0 && !this.currentSession) {
        this.connectToSession(this.sessions[0].name);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
      this.showStatus('Failed to load sessions', 'error');
    }
  }

  updateSessionSelect() {
    const select = document.getElementById('session-select');
    select.innerHTML = '';

    if (this.sessions.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No sessions';
      select.appendChild(option);
    } else {
      this.sessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.name;
        option.textContent = session.name + (session.attached ? ' (attached)' : '');
        if (session.name === this.currentSession) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }
  }

  async createNewSession() {
    try {
      this.showStatus('Creating session...', 'info');

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const data = await response.json();
      this.showStatus(`Created ${data.name}`, 'success');

      // Refresh sessions and connect to new one
      await this.loadSessions();
      this.connectToSession(data.name);
    } catch (err) {
      console.error('Failed to create session:', err);
      this.showStatus(err.message, 'error');
    }
  }

  connectToSession(sessionName) {
    // Close existing connection
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.currentSession = sessionName;
    this.reconnectAttempts = 0;
    this.terminal.clear();
    this.showStatus(`Connecting to ${sessionName}...`, 'info');

    // Update select
    const select = document.getElementById('session-select');
    select.value = sessionName;

    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/terminal/${sessionName}`;

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log(`Connected to session: ${sessionName}`);
      this.showStatus(`Connected to ${sessionName}`, 'success');
      this.reconnectAttempts = 0;
      this.terminal.focus();
      this.sendResize();
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'output':
            this.terminal.write(msg.data);
            break;

          case 'exit':
            this.showStatus(`Session ended (code: ${msg.code})`, 'warning');
            this.loadSessions(); // Refresh session list
            break;
        }
      } catch (err) {
        console.error('Invalid message:', err);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`Disconnected from session: ${sessionName}`, event.code, event.reason);

      if (event.code !== 1000) {
        // Abnormal close, try to reconnect
        this.attemptReconnect(sessionName);
      } else {
        this.showStatus('Disconnected', 'info');
      }
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      this.showStatus('Connection error', 'error');
    };
  }

  attemptReconnect(sessionName) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showStatus('Failed to reconnect', 'error');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);

    this.showStatus(`Reconnecting in ${delay / 1000}s...`, 'warning');

    setTimeout(() => {
      if (this.currentSession === sessionName) {
        this.connectToSession(sessionName);
      }
    }, delay);
  }

  sendInput(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'input', data }));
    }
  }

  sendKey(key) {
    const keyMap = {
      'Enter': '\r',
      'Escape': '\x1b',
      'Tab': '\t',
      'Backspace': '\x7f',
      'ArrowUp': '\x1b[A',
      'ArrowDown': '\x1b[B',
      'ArrowRight': '\x1b[C',
      'ArrowLeft': '\x1b[D'
    };

    const data = keyMap[key];
    if (data) {
      this.sendInput(data);
    }
  }

  sendResize() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const { cols, rows } = this.terminal;
      this.socket.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }

  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status visible ${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      statusEl.classList.remove('visible');
    }, 3000);
  }

  showEmptyState() {
    this.terminal.write('\r\n\x1b[90m  No active sessions.\r\n  Click "+ New" to start a Claude session.\x1b[0m\r\n');
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ClaudePod();
});
