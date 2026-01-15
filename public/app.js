// ClaudePod - Web Terminal Client

// Claude commands for the palette
const CLAUDE_COMMANDS = [
  { cmd: '/help', desc: 'Show help', category: 'Claude' },
  { cmd: '/compact', desc: 'Compact conversation', category: 'Claude' },
  { cmd: '/clear', desc: 'Clear conversation', category: 'Claude' },
  { cmd: '/status', desc: 'Show status', category: 'Claude' },
  { cmd: '/config', desc: 'Show config', category: 'Claude' },
  { cmd: 'y', desc: 'Yes / Confirm', category: 'Quick' },
  { cmd: 'n', desc: 'No / Decline', category: 'Quick' },
  { cmd: '\x03', desc: 'Cancel (Ctrl+C)', category: 'Control', display: '^C' },
  { cmd: '\x1b', desc: 'Escape', category: 'Control', display: 'Esc' },
  { cmd: 'git status', desc: 'Show working tree status', category: 'Git' },
  { cmd: 'git diff', desc: 'Show changes', category: 'Git' },
  { cmd: 'git log --oneline -10', desc: 'Recent commits', category: 'Git' },
  { cmd: 'npm test', desc: 'Run tests', category: 'Dev' },
  { cmd: 'npm run build', desc: 'Build project', category: 'Dev' },
  { cmd: 'ls -la', desc: 'List files', category: 'Dev' },
  { cmd: '__rename__', desc: 'Rename current session', category: 'Session', display: 'Rename' },
  { cmd: '__search__', desc: 'Search terminal output', category: 'Session', display: 'Search' },
  { cmd: '__notifications__', desc: 'Toggle notifications', category: 'Session', display: 'Notifications' },
];

class ClaudePod {
  constructor() {
    this.terminal = null;
    this.fitAddon = null;
    this.searchAddon = null;
    this.socket = null;
    this.currentSession = null;
    this.sessions = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.resizeTimeout = null;
    this.currentDirPath = '';
    this.refreshInterval = null;
    this.deferredPrompt = null;
    this.selectedPaletteIndex = 0;
    this.filteredCommands = [];

    this.init();
  }

  async init() {
    this.setupTerminal();
    this.setupEventListeners();
    this.setupModal();
    this.setupDirModal();
    this.setupInputComposer();
    this.setupCommandPalette();
    this.setupGestures();
    this.setupOfflineDetection();
    this.setupInstallPrompt();
    await this.loadSessions();
    this.startSessionRefresh();

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
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: 1.2,
      theme: {
        background: '#0a0a0a',
        foreground: '#e8e6e3',
        cursor: '#d97706',
        cursorAccent: '#0a0a0a',
        selectionBackground: 'rgba(217, 119, 6, 0.25)',
        selectionForeground: '#e8e6e3',
        black: '#1c1c1c',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e8e6e3',
        brightBlack: '#4a4a4a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff'
      },
      allowTransparency: false,
      scrollback: 5000,
      tabStopWidth: 4,
      convertEol: true,
      scrollOnUserInput: true
    });

    this.fitAddon = new FitAddon.FitAddon();
    this.terminal.loadAddon(this.fitAddon);

    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    this.terminal.loadAddon(webLinksAddon);

    // Search addon
    if (typeof SearchAddon !== 'undefined') {
      this.searchAddon = new SearchAddon.SearchAddon();
      this.terminal.loadAddon(this.searchAddon);
    }

    const terminalEl = document.getElementById('terminal');
    this.terminal.open(terminalEl);

    // Initial fit
    this.fitTerminal();

    // Handle resize with debounce
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.fitTerminal();
      }, 100);
    });
    resizeObserver.observe(terminalEl);

    // Also handle window resize for iOS orientation changes
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.fitTerminal();
      }, 150);
    });

    // Handle visibility change to refit on return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => this.fitTerminal(), 100);
      }
    });

    // Handle terminal input
    this.terminal.onData((data) => {
      this.sendInput(data);
    });

    // Show empty state initially
    this.showEmptyState();
  }

  fitTerminal() {
    try {
      this.fitAddon.fit();
      this.sendResize();
    } catch (e) {
      console.warn('Fit failed:', e);
    }
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

    // Font size controls
    document.getElementById('font-decrease').addEventListener('click', () => {
      this.haptic('light');
      this.changeFontSize(-1);
    });
    document.getElementById('font-increase').addEventListener('click', () => {
      this.haptic('light');
      this.changeFontSize(1);
    });

    // Load saved font size
    const savedSize = localStorage.getItem('claudepod_fontsize');
    if (savedSize) {
      this.terminal.options.fontSize = parseInt(savedSize);
    }

    // Scroll controls
    document.getElementById('scroll-top').addEventListener('click', () => {
      this.haptic('light');
      this.terminal.scrollToTop();
    });
    document.getElementById('scroll-bottom').addEventListener('click', () => {
      this.haptic('light');
      this.terminal.scrollToBottom();
    });

    // Kill session button
    const killSessionBtn = document.getElementById('kill-session-btn');
    killSessionBtn.addEventListener('click', () => this.showKillModal());

    // Quick action buttons
    document.querySelectorAll('.action-btn:not(#kill-session-btn):not(#palette-btn)').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.dataset.input;
        const key = btn.dataset.key;

        this.haptic('light');

        if (input) {
          this.sendInput(input);
        } else if (key) {
          this.sendKey(key);
        }

        // Focus terminal after button press
        this.terminal.focus();
      });
    });

    // Prevent iOS zoom on double tap
    document.addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - this.lastTap < 300) {
        e.preventDefault();
      }
      this.lastTap = now;
    }, { passive: false });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT';

      if (isInputFocused) return;

      // Ctrl/Cmd + Shift + N: New session
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        this.createNewSession();
      }

      // Ctrl/Cmd + Shift + K: Kill session
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        this.showKillModal();
      }
    });
  }

  setupModal() {
    const modal = document.getElementById('kill-modal');
    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    cancelBtn.addEventListener('click', () => this.hideKillModal());
    confirmBtn.addEventListener('click', () => this.confirmKillSession());

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideKillModal();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('visible')) {
        this.hideKillModal();
      }
    });
  }

  setupDirModal() {
    const modal = document.getElementById('dir-modal');
    const cancelBtn = document.getElementById('dir-cancel');
    const selectBtn = document.getElementById('dir-select');
    const dirList = document.getElementById('dir-list');

    cancelBtn.addEventListener('click', () => this.hideDirModal());
    selectBtn.addEventListener('click', () => this.createSessionInDir());

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideDirModal();
      }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('visible')) {
        this.hideDirModal();
      }
    });

    // Handle directory clicks via delegation
    dirList.addEventListener('click', (e) => {
      const item = e.target.closest('.dir-item');
      if (!item) return;

      const action = item.dataset.action;
      if (action === 'create-folder') {
        this.createFolder();
        return;
      }

      const path = item.dataset.path;
      if (path === '..') {
        this.loadDirectories(this.currentDirPath.split('/').slice(0, -1).join('/'));
      } else if (path !== undefined) {
        this.loadDirectories(path);
      }
    });
  }

  showDirModal() {
    const modal = document.getElementById('dir-modal');
    modal.classList.add('visible');
    this.loadDirectories('');
  }

  hideDirModal() {
    const modal = document.getElementById('dir-modal');
    modal.classList.remove('visible');
  }

  setupInputComposer() {
    const composer = document.getElementById('input-composer');
    const sendBtn = document.getElementById('send-btn');

    // Auto-resize textarea
    composer.addEventListener('input', () => {
      composer.style.height = 'auto';
      composer.style.height = Math.min(composer.scrollHeight, 120) + 'px';
    });

    // Send on button click
    sendBtn.addEventListener('click', () => this.sendComposerInput());

    // Send on Enter (Shift+Enter for newline)
    composer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendComposerInput();
      }
    });
  }

  sendComposerInput() {
    const composer = document.getElementById('input-composer');
    const text = composer.value.trim();
    if (!text) return;

    this.haptic('medium');

    // Send to terminal
    this.sendInput(text + '\n');

    // Add to history
    this.addToHistory(text);

    // Clear input
    composer.value = '';
    composer.style.height = 'auto';

    // Focus terminal for scrolling
    this.terminal.focus();
  }

  setupCommandPalette() {
    const modal = document.getElementById('palette-modal');
    const paletteBtn = document.getElementById('palette-btn');
    const searchInput = document.getElementById('palette-search');
    const paletteList = document.getElementById('palette-list');

    // Open palette
    paletteBtn.addEventListener('click', () => this.showPalette());

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hidePalette();
      }
    });

    // Search filtering
    searchInput.addEventListener('input', () => {
      this.filterPalette(searchInput.value);
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hidePalette();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectNextPaletteItem();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectPrevPaletteItem();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executePaletteItem();
      }
    });

    // Click to execute
    paletteList.addEventListener('click', (e) => {
      const item = e.target.closest('.palette-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        if (!isNaN(index)) {
          this.selectedPaletteIndex = index;
          this.executePaletteItem();
        }
      }
    });
  }

  showPalette() {
    const modal = document.getElementById('palette-modal');
    const searchInput = document.getElementById('palette-search');

    modal.classList.add('visible');
    searchInput.value = '';
    this.filterPalette('');
    searchInput.focus();
  }

  hidePalette() {
    const modal = document.getElementById('palette-modal');
    modal.classList.remove('visible');
    this.terminal.focus();
  }

  filterPalette(query) {
    const q = query.toLowerCase();
    const history = this.getHistory();

    // Build list: history first (if matching), then commands
    let items = [];

    // Add matching history items
    if (history.length > 0) {
      const matchingHistory = history
        .filter(h => h.toLowerCase().includes(q))
        .slice(0, 5)
        .map(h => ({ cmd: h, desc: 'Recent', category: 'History' }));
      items = items.concat(matchingHistory);
    }

    // Add matching commands
    const matchingCmds = CLAUDE_COMMANDS.filter(c =>
      c.cmd.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
    items = items.concat(matchingCmds);

    this.filteredCommands = items;
    this.selectedPaletteIndex = 0;
    this.renderPalette();
  }

  renderPalette() {
    const paletteList = document.getElementById('palette-list');

    if (this.filteredCommands.length === 0) {
      paletteList.innerHTML = '<div class="palette-empty">No commands found</div>';
      return;
    }

    // Group by category
    const byCategory = {};
    this.filteredCommands.forEach((item, idx) => {
      if (!byCategory[item.category]) {
        byCategory[item.category] = [];
      }
      byCategory[item.category].push({ ...item, idx });
    });

    let html = '';
    for (const [category, items] of Object.entries(byCategory)) {
      html += `<div class="palette-category">${category}</div>`;
      for (const item of items) {
        const selected = item.idx === this.selectedPaletteIndex ? 'palette-item-selected' : '';
        const display = item.display || item.cmd;
        html += `
          <div class="palette-item ${selected}" data-index="${item.idx}">
            <span class="palette-cmd">${this.escapeHtml(display)}</span>
            <span class="palette-desc">${this.escapeHtml(item.desc)}</span>
          </div>
        `;
      }
    }

    paletteList.innerHTML = html;

    // Scroll selected into view
    const selectedEl = paletteList.querySelector('.palette-item-selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }

  selectNextPaletteItem() {
    if (this.selectedPaletteIndex < this.filteredCommands.length - 1) {
      this.selectedPaletteIndex++;
      this.renderPalette();
    }
  }

  selectPrevPaletteItem() {
    if (this.selectedPaletteIndex > 0) {
      this.selectedPaletteIndex--;
      this.renderPalette();
    }
  }

  executePaletteItem() {
    const item = this.filteredCommands[this.selectedPaletteIndex];
    if (!item) return;

    this.haptic('light');
    this.hidePalette();

    // Handle special commands
    if (item.cmd === '__rename__') {
      this.editSessionLabel();
      return;
    }

    if (item.cmd === '__search__') {
      this.showSearchPrompt();
      return;
    }

    if (item.cmd === '__notifications__') {
      this.toggleNotifications();
      return;
    }

    // For control characters, send directly
    if (item.cmd === '\x03' || item.cmd === '\x1b') {
      this.sendInput(item.cmd);
    } else {
      // Send command + newline
      this.sendInput(item.cmd + '\n');
      this.addToHistory(item.cmd);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Command history
  addToHistory(cmd) {
    const history = this.getHistory();
    // Remove duplicates and add to front
    const filtered = history.filter(h => h !== cmd);
    filtered.unshift(cmd);
    // Keep last 50
    localStorage.setItem('claudepod_history', JSON.stringify(filtered.slice(0, 50)));
  }

  getHistory() {
    try {
      return JSON.parse(localStorage.getItem('claudepod_history') || '[]');
    } catch {
      return [];
    }
  }

  // Haptic feedback
  haptic(type = 'light') {
    if (!navigator.vibrate) return;

    const patterns = {
      light: 10,
      medium: 25,
      heavy: 50,
      success: [10, 50, 10],
      error: [50, 100, 50],
    };

    navigator.vibrate(patterns[type] || patterns.light);
  }

  // Font size control
  changeFontSize(delta) {
    const currentSize = this.terminal.options.fontSize || 14;
    const newSize = Math.min(Math.max(currentSize + delta, 10), 24);

    this.terminal.options.fontSize = newSize;
    localStorage.setItem('claudepod_fontsize', newSize);
    this.fitTerminal();

    this.showStatus(`Font size: ${newSize}px`, 'info');
  }

  // Gesture support
  setupGestures() {
    if (typeof Hammer === 'undefined') {
      console.warn('Hammer.js not loaded, gestures disabled');
      return;
    }

    const terminalEl = document.getElementById('terminal');
    const hammer = new Hammer(terminalEl);

    // Configure swipe
    hammer.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });

    // Swipe left = next session
    hammer.on('swipeleft', () => {
      this.haptic('light');
      this.nextSession();
    });

    // Swipe right = previous session
    hammer.on('swiperight', () => {
      this.haptic('light');
      this.prevSession();
    });
  }

  nextSession() {
    if (this.sessions.length < 2) return;

    const currentIndex = this.sessions.findIndex(s => s.name === this.currentSession);
    const nextIndex = (currentIndex + 1) % this.sessions.length;
    const nextSession = this.sessions[nextIndex];

    if (nextSession) {
      this.connectToSession(nextSession.name);
    }
  }

  prevSession() {
    if (this.sessions.length < 2) return;

    const currentIndex = this.sessions.findIndex(s => s.name === this.currentSession);
    const prevIndex = currentIndex <= 0 ? this.sessions.length - 1 : currentIndex - 1;
    const prevSession = this.sessions[prevIndex];

    if (prevSession) {
      this.connectToSession(prevSession.name);
    }
  }

  // Terminal search
  showSearchPrompt() {
    if (!this.searchAddon) {
      this.showStatus('Search not available', 'warning');
      return;
    }

    const query = prompt('Search terminal:');
    if (query && query.trim()) {
      const found = this.searchAddon.findNext(query.trim());
      if (!found) {
        this.showStatus('No matches found', 'info');
      } else {
        this.showStatus(`Found: "${query.trim()}"`, 'success');
      }
    }
  }

  searchNext() {
    if (this.searchAddon) {
      this.searchAddon.findNext();
    }
  }

  searchPrev() {
    if (this.searchAddon) {
      this.searchAddon.findPrevious();
    }
  }

  async loadDirectories(path) {
    const dirList = document.getElementById('dir-list');
    const pathDisplay = document.getElementById('dir-current-path');

    dirList.innerHTML = '<div class="dir-loading">Loading...</div>';

    try {
      const response = await fetch(`/api/directories?path=${encodeURIComponent(path)}`);
      const text = await response.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.error('Failed to parse response:', text.substring(0, 200));
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load directories');
      }

      this.currentDirPath = data.current === '/' ? '' : data.current;
      pathDisplay.textContent = data.base + (data.current === '/' ? '' : '/' + data.current);

      this.renderDirectories(data);
    } catch (err) {
      console.error('loadDirectories error:', err);
      dirList.innerHTML = `<div class="dir-empty">Error: ${err.message}</div>`;
    }
  }

  renderDirectories(data) {
    const dirList = document.getElementById('dir-list');

    let html = '';

    // Create new folder button
    html += `
      <div class="dir-item dir-item-create" data-action="create-folder">
        <span class="dir-item-icon">+</span>
        <span class="dir-item-name">New Folder</span>
      </div>
    `;

    // Parent directory link
    if (data.parent !== null) {
      html += `
        <div class="dir-item dir-item-back" data-path="..">
          <span class="dir-item-icon">&#8592;</span>
          <span class="dir-item-name">..</span>
        </div>
      `;
    }

    // Directory entries
    if (data.directories.length === 0 && data.parent === null) {
      html += '<div class="dir-empty">No subdirectories</div>';
    } else {
      for (const dir of data.directories) {
        html += `
          <div class="dir-item" data-path="${dir.path}">
            <span class="dir-item-icon">&#128193;</span>
            <span class="dir-item-name">${dir.name}</span>
          </div>
        `;
      }
    }

    dirList.innerHTML = html;
  }

  async createFolder() {
    const name = prompt('Enter folder name:');
    if (!name || !name.trim()) return;

    const cleanName = name.trim();

    // Basic validation
    if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_\-. ]*$/.test(cleanName)) {
      this.showStatus('Invalid folder name', 'error');
      return;
    }

    try {
      const response = await fetch('/api/directories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: this.currentDirPath,
          name: cleanName
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create folder');
      }

      this.showStatus(`Created ${cleanName}`, 'success');
      // Navigate to the new folder
      this.loadDirectories(data.path);
    } catch (err) {
      console.error('Failed to create folder:', err);
      this.showStatus(err.message, 'error');
    }
  }

  async createSessionInDir() {
    this.hideDirModal();

    try {
      this.showStatus('Creating session...', 'info');

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: this.currentDirPath })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const data = await response.json();
      this.showStatus(`Created ${data.name}`, 'success');

      await this.loadSessions();
      this.connectToSession(data.name);
    } catch (err) {
      console.error('Failed to create session:', err);
      this.showStatus(err.message, 'error');
    }
  }

  showKillModal() {
    if (!this.currentSession) {
      this.showStatus('No active session', 'warning');
      return;
    }

    const modal = document.getElementById('kill-modal');
    const sessionNameEl = document.getElementById('kill-session-name');
    sessionNameEl.textContent = this.currentSession;
    modal.classList.add('visible');
  }

  hideKillModal() {
    const modal = document.getElementById('kill-modal');
    modal.classList.remove('visible');
  }

  async confirmKillSession() {
    const sessionName = this.currentSession;
    this.hideKillModal();

    if (!sessionName) return;

    // Save state for potential revert
    const oldSessions = [...this.sessions];
    const sessionIndex = this.sessions.findIndex(s => s.name === sessionName);

    // Optimistic update - remove from list immediately
    this.sessions = this.sessions.filter(s => s.name !== sessionName);
    this.currentSession = null;
    this.updateSessionSelect();
    this.terminal.clear();
    this.showEmptyState();
    this.showStatus(`Ended ${sessionName}`, 'success');
    this.haptic('success');

    try {
      const response = await fetch(`/api/sessions/${sessionName}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to end session');
      }
    } catch (err) {
      // Revert on failure
      console.error('Failed to kill session:', err);
      this.sessions = oldSessions;
      this.currentSession = sessionName;
      this.updateSessionSelect();
      this.connectToSession(sessionName);
      this.haptic('error');
      this.showStatus(err.message, 'error');
    }
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
        // Show label if available, otherwise session name
        const displayName = session.label || session.name;
        // Indicators: • = attached, 🔔 = notifications on, 🔕 = notifications off
        let indicators = '';
        if (session.attached) indicators += ' •';
        if (session.notifications === false) indicators += ' 🔕';
        option.textContent = displayName + indicators;
        option.title = session.label
          ? `${session.name}: ${session.label}${session.notifications === false ? ' (muted)' : ''}`
          : `${session.name}${session.notifications === false ? ' (muted)' : ''}`;
        if (session.name === this.currentSession) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    }
  }

  async editSessionLabel() {
    if (!this.currentSession) {
      this.showStatus('No active session', 'warning');
      return;
    }

    const session = this.sessions.find(s => s.name === this.currentSession);
    const oldLabel = session?.label || '';

    const newLabel = prompt('Session label (leave empty to clear):', oldLabel);
    if (newLabel === null) return; // Cancelled

    const cleanLabel = newLabel.trim() || null;

    // Optimistic update
    if (session) {
      session.label = cleanLabel;
      this.updateSessionSelect();
    }
    this.haptic('success');
    this.showStatus(cleanLabel ? `Label: ${cleanLabel}` : 'Label cleared', 'success');

    try {
      const response = await fetch(`/api/sessions/${this.currentSession}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: cleanLabel })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update label');
      }
    } catch (err) {
      // Revert on failure
      console.error('Failed to update label:', err);
      if (session) {
        session.label = oldLabel;
        this.updateSessionSelect();
      }
      this.haptic('error');
      this.showStatus(err.message, 'error');
    }
  }

  async toggleNotifications() {
    if (!this.currentSession) {
      this.showStatus('No active session', 'warning');
      return;
    }

    const session = this.sessions.find(s => s.name === this.currentSession);
    const oldEnabled = session?.notifications !== false;
    const newEnabled = !oldEnabled;

    // Optimistic update
    if (session) {
      session.notifications = newEnabled;
      this.updateSessionSelect();
    }
    this.haptic('success');
    this.showStatus(`Notifications ${newEnabled ? 'enabled' : 'disabled'}`, 'success');

    try {
      const response = await fetch(`/api/sessions/${this.currentSession}/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle notifications');
      }
    } catch (err) {
      // Revert on failure
      console.error('Failed to toggle notifications:', err);
      if (session) {
        session.notifications = oldEnabled;
        this.updateSessionSelect();
      }
      this.haptic('error');
      this.showStatus(err.message, 'error');
    }
  }

  createNewSession() {
    this.showDirModal();
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

    this.setConnectionStatus('connecting');
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log(`Connected to session: ${sessionName}`);
      this.setConnectionStatus('connected');
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

          case 'error':
            this.showStatus(msg.message || 'Connection error', 'error');
            this.terminal.write(`\r\n\x1b[31mError: ${msg.message}\x1b[0m\r\n`);
            break;
        }
      } catch (err) {
        console.error('Invalid message:', err);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`Disconnected from session: ${sessionName}`, event.code, event.reason);
      this.setConnectionStatus('disconnected');

      if (event.code !== 1000 && event.code !== 4001 && event.code !== 4002) {
        // Abnormal close, try to reconnect
        this.attemptReconnect(sessionName);
      } else {
        this.showStatus('Disconnected', 'info');
      }
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      this.setConnectionStatus('error');
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
    clearTimeout(this.statusTimeout);
    this.statusTimeout = setTimeout(() => {
      statusEl.classList.remove('visible');
    }, 3000);
  }

  setConnectionStatus(status) {
    const indicator = document.getElementById('connection-status');
    indicator.className = 'connection-status ' + status;
    indicator.title = status.charAt(0).toUpperCase() + status.slice(1);
  }

  setButtonLoading(btn, loading) {
    if (loading) {
      btn.classList.add('btn-loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  }

  setupOfflineDetection() {
    const banner = document.getElementById('offline-banner');

    const updateOnlineStatus = () => {
      if (navigator.onLine) {
        banner.classList.remove('visible');
      } else {
        banner.classList.add('visible');
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Smart reconnection on network restore
    window.addEventListener('online', () => {
      if (this.currentSession && (!this.socket || this.socket.readyState !== WebSocket.OPEN)) {
        this.showStatus('Back online, reconnecting...', 'info');
        setTimeout(() => {
          this.connectToSession(this.currentSession);
        }, 500);
      }
    });

    window.addEventListener('offline', () => {
      this.showStatus('You are offline', 'warning');
    });
  }

  setupInstallPrompt() {
    const installBtn = document.getElementById('install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      installBtn.style.display = 'inline-flex';
    });

    installBtn.addEventListener('click', async () => {
      if (!this.deferredPrompt) return;

      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        this.showStatus('App installed!', 'success');
      }

      this.deferredPrompt = null;
      installBtn.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
      this.showStatus('ClaudePod installed!', 'success');
      installBtn.style.display = 'none';
    });
  }

  startSessionRefresh() {
    // Refresh session list every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadSessions();
    }, 30000);

    // Also refresh when returning to app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.loadSessions();
      }
    });
  }

  stopSessionRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  showEmptyState() {
    this.terminal.write('\r\n\x1b[38;2;90;90;90m  No active sessions.\r\n  Tap "+ New" to start a Claude session.\x1b[0m\r\n');
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ClaudePod();
});
