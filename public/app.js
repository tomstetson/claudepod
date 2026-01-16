// ClaudePod - Web Terminal Client

// Terminal color themes
const TERMINAL_THEMES = {
  default: {
    name: 'Default',
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
  dracula: {
    name: 'Dracula',
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: 'rgba(68, 71, 90, 0.5)',
    selectionForeground: '#f8f8f2',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff'
  },
  nord: {
    name: 'Nord',
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    cursorAccent: '#2e3440',
    selectionBackground: 'rgba(136, 192, 208, 0.3)',
    selectionForeground: '#d8dee9',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4'
  },
  solarized: {
    name: 'Solarized Dark',
    background: '#002b36',
    foreground: '#839496',
    cursor: '#839496',
    cursorAccent: '#002b36',
    selectionBackground: 'rgba(131, 148, 150, 0.3)',
    selectionForeground: '#839496',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#586e75',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3'
  },
  monokai: {
    name: 'Monokai',
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#272822',
    selectionBackground: 'rgba(73, 72, 62, 0.5)',
    selectionForeground: '#f8f8f2',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5'
  }
};

// Claude commands for the palette
const CLAUDE_COMMANDS = [
  // Quick actions (most used on mobile)
  { cmd: '\x03', desc: 'Cancel current operation', category: 'Quick', display: '^C Interrupt' },
  { cmd: '\x1b', desc: 'Send escape key', category: 'Quick', display: 'Esc' },
  { cmd: '__kill__', desc: 'End current session', category: 'Quick', display: 'End Session' },
  // Claude commands
  { cmd: '/help', desc: 'Show Claude help', category: 'Claude' },
  { cmd: '/compact', desc: 'Compact conversation', category: 'Claude' },
  { cmd: '/clear', desc: 'Clear conversation', category: 'Claude' },
  { cmd: '/status', desc: 'Show status', category: 'Claude' },
  // Session management
  { cmd: '__rename__', desc: 'Rename session', category: 'Session', display: 'Rename' },
  { cmd: '__notifications__', desc: 'Toggle notifications', category: 'Session', display: 'Notifications' },
  { cmd: '__export__', desc: 'Export to file', category: 'Session', display: 'Export' },
  // View controls
  { cmd: '__clear__', desc: 'Clear terminal', category: 'View', display: 'Clear Display' },
  { cmd: '__scroll_top__', desc: 'Scroll to top', category: 'View', display: 'Top' },
  { cmd: '__scroll_bottom__', desc: 'Scroll to bottom', category: 'View', display: 'Bottom' },
  { cmd: '__theme__', desc: 'Change theme', category: 'View', display: 'Theme' },
  { cmd: '__font_up__', desc: 'Increase font size', category: 'View', display: 'Font +' },
  { cmd: '__font_down__', desc: 'Decrease font size', category: 'View', display: 'Font -' },
  { cmd: '__search__', desc: 'Search terminal', category: 'View', display: 'Search' },
  // Git shortcuts
  { cmd: 'git status', desc: 'Working tree status', category: 'Git' },
  { cmd: 'git diff', desc: 'Show changes', category: 'Git' },
  { cmd: 'git log --oneline -10', desc: 'Recent commits', category: 'Git' },
  // Dev shortcuts
  { cmd: 'npm test', desc: 'Run tests', category: 'Dev' },
  { cmd: 'npm run build', desc: 'Build project', category: 'Dev' },
  { cmd: 'ls -la', desc: 'List files', category: 'Dev' },
];

class ClaudePod {
  constructor() {
    this.terminal = null;
    this.fitAddon = null;
    this.searchAddon = null;
    this.connection = null; // ConnectionManager instance
    this.scrollController = null; // ScrollController instance
    this.performanceMonitor = null; // PerformanceMonitor instance
    this.currentSession = null;
    this.sessions = [];
    this.resizeTimeout = null;
    this.currentDirPath = '';
    this.refreshInterval = null;
    this.deferredPrompt = null;
    this.selectedPaletteIndex = 0;
    this.filteredCommands = [];
    this.pingInterval = null;
    this.latency = null;
    this.currentTheme = localStorage.getItem('claudepod_theme') || 'default';

    // Buffer state for scrollback
    this.bufferState = null;
    this.lastReceivedLine = 0;

    // Keyboard state for scroll preservation
    this.savedScrollPosition = null;

    // Virtual keyboard state tracking for iOS
    this.keyboardVisible = false;
    this.viewportHeight = window.innerHeight;

    this.init();
  }

  async init() {
    // Handle PWA shortcut actions
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');

    if (action) {
      // Clear the URL parameter
      window.history.replaceState({}, '', '/');

      // Queue action for after init
      this.pendingAction = action;
    }

    this.setupTerminal();
    this.setupConnection();
    this.setupScroll();
    this.setupPerformanceMonitor();
    this.setupEventListeners();
    this.setupModal();
    this.setupDirModal();
    this.setupInputComposer();
    this.setupCommandPalette();
    this.setupGestures();
    this.setupOfflineDetection();
    this.setupInstallPrompt();
    this.setupDpad();
    this.setupMenuDetection();
    this.setupPasteChip();
    this.setupKeyboardDismiss();
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
    const theme = TERMINAL_THEMES[this.currentTheme] || TERMINAL_THEMES.default;

    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace',
      fontWeight: 400,
      letterSpacing: 0,
      lineHeight: 1.2,
      theme: theme,
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

    // Virtual keyboard detection for iOS with scroll preservation
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        const heightDiff = this.viewportHeight - currentHeight;
        const wasKeyboardVisible = this.keyboardVisible;

        // Keyboard is likely open if viewport shrunk by >150px
        this.keyboardVisible = heightDiff > 150;

        // Get terminal viewport for scroll preservation
        const viewport = this.terminal?.element?.querySelector('.xterm-viewport');

        if (this.keyboardVisible && !wasKeyboardVisible) {
          // Keyboard just opened - save scroll position
          document.body.classList.add('keyboard-visible');
          if (viewport) {
            this.savedScrollPosition = viewport.scrollTop;
          }
          // Scroll input into view
          const composer = document.getElementById('input-composer');
          if (document.activeElement === composer) {
            composer.scrollIntoView({ block: 'end', behavior: 'smooth' });
          }
        } else if (!this.keyboardVisible && wasKeyboardVisible) {
          // Keyboard just closed - restore scroll position
          document.body.classList.remove('keyboard-visible');
          if (viewport && this.savedScrollPosition !== null) {
            // Use requestAnimationFrame to ensure layout is complete
            requestAnimationFrame(() => {
              viewport.scrollTop = this.savedScrollPosition;
              this.savedScrollPosition = null;
            });
          }
        }

        // Refit terminal
        this.fitTerminal();
      });

      // Store initial viewport height
      this.viewportHeight = window.visualViewport.height;
    }

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

  setupConnection() {
    this.connection = new ConnectionManager({
      maxReconnectAttempts: 10,
      baseDelay: 1000,
      maxDelay: 30000,
      idleTimeout: 5 * 60 * 1000 // 5 minutes
    });

    // Connection events
    this.connection.on('connected', (data) => {
      console.log('Connected:', data);
      this.setConnectionStatus('connected');
      this.showStatus(`Connected to ${this.currentSession}`, 'success');
      this.terminal.focus();
      this.sendResize();
      this.startPing();
      this.loadDraft();

      // Handle pending PWA action
      if (this.pendingAction) {
        setTimeout(() => {
          if (this.pendingAction === 'new') {
            this.showDirModal();
          } else if (this.pendingAction === 'palette') {
            this.showPalette();
          }
          this.pendingAction = null;
        }, 500);
      }
    });

    this.connection.on('disconnected', (data) => {
      console.log('Disconnected:', data);
      this.setConnectionStatus('disconnected');
      this.stopPing();

      if (!data.wasIntentional) {
        this.showStatus('Disconnected', 'warning');
      }
    });

    this.connection.on('reconnecting', (data) => {
      this.setConnectionStatus('connecting');
      this.showStatus(`Reconnecting... (${data.attempt}/${data.maxAttempts})`, 'warning');
    });

    this.connection.on('reconnect_failed', () => {
      this.setConnectionStatus('error');
      this.showStatus('Connection lost. Tap to retry.', 'error');
    });

    this.connection.on('error', (data) => {
      console.error('Connection error:', data);

      // User-friendly error messages
      let message = data.message || 'Connection error';

      if (message.includes('not found')) {
        message = 'Session not found - it may have ended';
      } else if (message.includes('Failed to attach')) {
        message = 'Could not attach to session - try refreshing';
      } else if (message.includes('WebSocket')) {
        message = 'Connection lost - attempting to reconnect...';
      }

      if (!data.recoverable) {
        this.showStatus(message, 'error');
        // Offer to refresh sessions after non-recoverable error
        setTimeout(() => this.loadSessions(), 2000);
      } else {
        this.showStatus(message, 'warning');
      }
    });

    // Terminal output
    this.connection.on('output', (msg) => {
      if (this.terminal && msg.data) {
        this.terminal.write(msg.data);
      }
      if (msg.line) {
        this.lastReceivedLine = msg.line;
      }
    });

    // State sync on initial connect or reconnect
    this.connection.on('state_sync', (msg) => {
      console.log('State sync received:', msg.bufferState, 'restored:', msg.restored);
      this.bufferState = msg.bufferState;

      // Update scroll controller with buffer state
      if (this.scrollController && msg.bufferState) {
        this.scrollController.updateBufferState(msg.bufferState);
      }

      // Write historical content to terminal
      if (msg.lines && msg.lines.length > 0) {
        // Clear terminal and write history
        this.terminal.clear();
        const content = msg.lines.join('\n');
        if (content) {
          this.terminal.write(content + '\n');
        }

        // Show message if history was restored from disk
        if (msg.restored) {
          this.showStatus(`Restored ${msg.lines.length} lines of history`, 'success');
        }
      }

      if (msg.startLine) {
        this.lastReceivedLine = msg.startLine + (msg.lines?.length || 0) - 1;
      }
    });

    // Sync response for history fetch - ScrollController handles this
    this.connection.on('sync_response', (msg) => {
      console.log('Sync response:', msg.startLine, '-', msg.endLine);
      this.bufferState = msg.bufferState;
      // ScrollController.handleSyncResponse is called automatically via event binding
    });

    // Pong for latency measurement
    this.connection.on('pong', (msg) => {
      this.latency = Date.now() - msg.timestamp;
      this.setConnectionStatus('connected');
    });

    // Session exit
    this.connection.on('exit', (msg) => {
      this.showStatus(`Session ended (code: ${msg.code})`, 'warning');
      this.loadSessions();
    });
  }

  setupScroll() {
    const historyLoadingEl = document.getElementById('history-loading');
    const scrollIndicatorEl = document.getElementById('scroll-indicator');

    this.scrollController = new ScrollController({
      terminal: this.terminal,
      connection: this.connection,
      fetchThreshold: 200,
      fetchCount: 500,
      onHistoryLoad: (event) => {
        if (event.loading) {
          // Show loading indicator
          historyLoadingEl?.classList.add('visible');
        } else {
          // Hide loading indicator
          historyLoadingEl?.classList.remove('visible');

          if (event.loaded) {
            this.showStatus(`Loaded ${event.count} lines of history`, 'success');
          }
        }
      }
    });

    // Initialize after a short delay to ensure terminal is ready
    setTimeout(() => {
      if (this.scrollController.init()) {
        // Set up scroll position indicator
        this.setupScrollIndicator(scrollIndicatorEl);
      }
    }, 100);
  }

  setupScrollIndicator(indicatorEl) {
    if (!indicatorEl || !this.scrollController) return;

    const viewport = this.terminal?.element?.querySelector('.xterm-viewport');
    if (!viewport) return;

    let indicatorTimeout = null;

    viewport.addEventListener('scroll', () => {
      // Show indicator
      const info = this.scrollController.getScrollInfo();
      if (info && info.bufferState) {
        const { bufferState, loadedRange, atTop, atBottom } = info;
        const totalLines = bufferState.newestLine - bufferState.oldestLine + 1;
        const loadedLines = loadedRange.end - loadedRange.start + 1;

        let text = '';
        if (atTop && this.scrollController.hasMoreHistory()) {
          text = `↑ ${loadedRange.start - bufferState.oldestLine} more lines`;
        } else if (atBottom) {
          text = 'At latest';
        } else {
          text = `${loadedLines} of ${totalLines} lines`;
        }

        indicatorEl.textContent = text;
        indicatorEl.classList.add('visible');

        // Hide after 2 seconds of no scroll
        clearTimeout(indicatorTimeout);
        indicatorTimeout = setTimeout(() => {
          indicatorEl.classList.remove('visible');
        }, 2000);
      }
    }, { passive: true });
  }

  setupPerformanceMonitor() {
    // Only enable on low-power devices or if user has performance issues
    const shouldMonitor = PerformanceMonitor.isLowPowerDevice();

    if (shouldMonitor) {
      this.performanceMonitor = new PerformanceMonitor({
        targetFps: 60,
        lowFpsThreshold: 30,
        criticalFpsThreshold: 15,
        onQualityChange: (event) => {
          console.log(`Quality changed to ${event.newQuality}`);
          this.applyQualitySettings(event.newQuality);
        },
        onFpsUpdate: (event) => {
          // Could add FPS indicator to UI if desired
        }
      });

      this.performanceMonitor.start();
      console.log('Performance monitoring enabled (low-power device detected)');
    }
  }

  applyQualitySettings(quality) {
    if (!this.terminal) return;

    switch (quality) {
      case 'low':
        this.terminal.options.scrollback = 200;
        this.terminal.options.cursorBlink = false;
        this.showStatus('Reduced quality for performance', 'info');
        break;
      case 'medium':
        this.terminal.options.scrollback = 500;
        this.terminal.options.cursorBlink = true;
        break;
      case 'high':
      default:
        this.terminal.options.scrollback = 1000;
        this.terminal.options.cursorBlink = true;
        break;
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
    document.getElementById('font-decrease')?.addEventListener('click', () => {
      this.haptic('light');
      this.changeFontSize(-1);
    });
    document.getElementById('font-increase')?.addEventListener('click', () => {
      this.haptic('light');
      this.changeFontSize(1);
    });

    // Load saved font size
    const savedSize = localStorage.getItem('claudepod_fontsize');
    if (savedSize) {
      this.terminal.options.fontSize = parseInt(savedSize);
    }

    // Scroll controls
    document.getElementById('scroll-top')?.addEventListener('click', () => {
      this.haptic('light');
      this.terminal.scrollToTop();
    });
    document.getElementById('scroll-bottom')?.addEventListener('click', () => {
      this.haptic('light');
      this.terminal.scrollToBottom();
    });

    // Kill session button
    const killSessionBtn = document.getElementById('kill-session-btn');
    killSessionBtn?.addEventListener('click', () => this.showKillModal());

    // Quick action buttons (both .action-btn and .quick-btn)
    document.querySelectorAll('.action-btn:not(#kill-session-btn):not(#palette-btn), .quick-btn:not(#palette-btn)').forEach(btn => {
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
      // Global shortcuts (work even in inputs)
      // Ctrl/Cmd + P: Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        this.showPalette();
        return;
      }

      // Ctrl/Cmd + K: Clear terminal
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'k') {
        e.preventDefault();
        this.terminal.clear();
        this.showStatus('Terminal cleared', 'info');
        return;
      }

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

      // Ctrl/Cmd + F: Search terminal
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        this.showSearchPrompt();
      }

      // Ctrl/Cmd + T: Cycle theme
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        this.cycleTheme();
      }

      // Ctrl/Cmd + S: Export session
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        this.exportSession();
      }

      // Ctrl/Cmd + O: Import file
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        this.importFile();
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
    const upBtn = document.getElementById('dir-up');
    const recentContainer = document.getElementById('dir-recent');

    cancelBtn.addEventListener('click', () => this.hideDirModal());
    selectBtn.addEventListener('click', () => this.createSessionInDir());

    // Up button handler
    upBtn.addEventListener('click', () => {
      if (this.currentDirPath) {
        this.loadDirectories(this.currentDirPath.split('/').slice(0, -1).join('/'));
      }
    });

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

    // Handle recent folder clicks
    recentContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.dir-recent-item');
      if (item && item.dataset.path !== undefined) {
        this.loadDirectories(item.dataset.path);
      }
    });
  }

  showDirModal() {
    this.lockScroll();
    const modal = document.getElementById('dir-modal');
    modal.classList.add('visible');
    this.renderRecentFolders();
    this.loadDirectories('');
  }

  // Folder history management
  getFolderHistory() {
    try {
      return JSON.parse(localStorage.getItem('claudepod_folder_history') || '[]');
    } catch {
      return [];
    }
  }

  addToFolderHistory(path) {
    if (!path) return; // Don't save root
    const history = this.getFolderHistory();
    // Remove if exists, add to front
    const filtered = history.filter(h => h !== path);
    filtered.unshift(path);
    // Keep last 5
    localStorage.setItem('claudepod_folder_history', JSON.stringify(filtered.slice(0, 5)));
  }

  renderRecentFolders() {
    const container = document.getElementById('dir-recent');
    const history = this.getFolderHistory();

    if (history.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html = '<div class="dir-recent-header">Recent</div>';
    for (const path of history) {
      const name = path.split('/').pop() || path;
      html += `
        <div class="dir-recent-item" data-path="${this.escapeHtml(path)}">
          <span class="dir-item-icon">&#128337;</span>
          <span class="dir-item-name">${this.escapeHtml(name)}</span>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  hideDirModal() {
    this.unlockScroll();
    const modal = document.getElementById('dir-modal');
    modal.classList.remove('visible');
  }

  setupInputComposer() {
    const composer = document.getElementById('input-composer');
    const sendBtn = document.getElementById('send-btn');

    if (!composer || !sendBtn) return;

    // Auto-resize textarea
    composer.addEventListener('input', () => {
      composer.style.height = 'auto';
      composer.style.height = Math.min(composer.scrollHeight, 120) + 'px';
      // Save draft on input
      this.saveDraft();
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

    // Clear input and draft
    composer.value = '';
    composer.style.height = 'auto';
    this.clearDraft();

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
    this.lockScroll();
    const modal = document.getElementById('palette-modal');
    const searchInput = document.getElementById('palette-search');

    modal.classList.add('visible');
    searchInput.value = '';
    this.filterPalette('');
    searchInput.focus();
  }

  hidePalette() {
    this.unlockScroll();
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

    // Build dynamic commands list with context-aware descriptions
    const commands = CLAUDE_COMMANDS.map(c => {
      // Make notification command dynamic based on current session state
      if (c.cmd === '__notifications__' && this.currentSession) {
        const session = this.sessions.find(s => s.name === this.currentSession);
        const isEnabled = session?.notifications !== false;
        return {
          ...c,
          desc: isEnabled ? 'Mute notifications' : 'Unmute notifications',
          display: isEnabled ? '🔕 Mute' : '🔔 Unmute'
        };
      }
      return c;
    });

    // Add matching commands
    const matchingCmds = commands.filter(c =>
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

    if (item.cmd === '__clear__') {
      this.terminal.clear();
      this.showStatus('Terminal cleared', 'info');
      return;
    }

    if (item.cmd === '__scroll_top__') {
      this.terminal.scrollToTop();
      return;
    }

    if (item.cmd === '__scroll_bottom__') {
      this.terminal.scrollToBottom();
      return;
    }

    if (item.cmd === '__shortcuts__') {
      this.showShortcuts();
      return;
    }

    if (item.cmd === '__theme__') {
      this.showThemeSelector();
      return;
    }

    if (item.cmd === '__copy__') {
      this.copySelection();
      return;
    }

    if (item.cmd === '__export__') {
      this.exportSession();
      return;
    }

    if (item.cmd === '__import__') {
      this.importFile();
      return;
    }

    if (item.cmd === '__kill__') {
      this.showKillModal();
      return;
    }

    if (item.cmd === '__font_up__') {
      this.changeFontSize(1);
      return;
    }

    if (item.cmd === '__font_down__') {
      this.changeFontSize(-1);
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

  // Scroll lock for modals (iOS fix)
  lockScroll() {
    this.scrollPosition = window.scrollY;
    document.body.classList.add('scroll-locked');
    document.body.style.top = `-${this.scrollPosition}px`;
  }

  unlockScroll() {
    document.body.classList.remove('scroll-locked');
    document.body.style.top = '';
    window.scrollTo(0, this.scrollPosition || 0);
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
    const hammer = new Hammer(terminalEl, {
      // Allow native scrolling for vertical direction
      touchAction: 'pan-y'
    });

    // Configure swipe for horizontal only
    hammer.get('swipe').set({
      direction: Hammer.DIRECTION_HORIZONTAL,
      threshold: 50,  // Require larger swipe to trigger
      velocity: 0.5   // Require faster swipe
    });

    // Disable pan to not interfere with scrolling
    hammer.get('pan').set({ enable: false });

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

  // Show keyboard shortcuts help
  showShortcuts() {
    const shortcuts = [
      ['⌘/Ctrl + P', 'Command palette'],
      ['⌘/Ctrl + K', 'Clear terminal'],
      ['⌘/Ctrl + F', 'Search terminal'],
      ['⌘/Ctrl + T', 'Cycle theme'],
      ['⌘/Ctrl + C', 'Copy selection'],
      ['⌘/Ctrl + S', 'Export session'],
      ['⌘/Ctrl + O', 'Import file'],
      ['⌘/Ctrl + ⇧ + N', 'New session'],
      ['⌘/Ctrl + ⇧ + K', 'Kill session'],
      ['Swipe ←/→', 'Switch sessions'],
    ];

    let output = '\r\n\x1b[1;36m  Keyboard Shortcuts\x1b[0m\r\n';
    output += '\x1b[38;2;90;90;90m  ─────────────────────────────\x1b[0m\r\n';

    shortcuts.forEach(([key, desc]) => {
      output += `  \x1b[1;33m${key.padEnd(18)}\x1b[0m ${desc}\r\n`;
    });

    output += '\x1b[38;2;90;90;90m  ─────────────────────────────\x1b[0m\r\n';
    output += '  \x1b[38;2;90;90;90mTap "/" for command palette\x1b[0m\r\n';

    this.terminal.write(output);
  }

  // Theme selector
  showThemeSelector() {
    const themeNames = Object.keys(TERMINAL_THEMES);
    const currentIndex = themeNames.indexOf(this.currentTheme);

    // Show available themes in terminal
    let output = '\r\n\x1b[1;36m  Terminal Themes\x1b[0m\r\n';
    output += '\x1b[38;2;90;90;90m  ─────────────────────────────\x1b[0m\r\n';

    themeNames.forEach((key, idx) => {
      const theme = TERMINAL_THEMES[key];
      const marker = key === this.currentTheme ? '→' : ' ';
      output += `  ${marker} \x1b[1;33m${(idx + 1)}.\x1b[0m ${theme.name}\r\n`;
    });

    output += '\x1b[38;2;90;90;90m  ─────────────────────────────\x1b[0m\r\n';
    output += '  \x1b[38;2;90;90;90mEnter number to select theme\x1b[0m\r\n';

    this.terminal.write(output);

    // Use prompt for selection
    const choice = prompt(`Select theme (1-${themeNames.length}):`, String(currentIndex + 1));
    if (choice === null) return;

    const idx = parseInt(choice) - 1;
    if (idx >= 0 && idx < themeNames.length) {
      this.setTheme(themeNames[idx]);
    }
  }

  setTheme(themeName) {
    if (!TERMINAL_THEMES[themeName]) {
      this.showStatus('Unknown theme', 'error');
      return;
    }

    this.currentTheme = themeName;
    localStorage.setItem('claudepod_theme', themeName);

    const theme = TERMINAL_THEMES[themeName];
    this.terminal.options.theme = theme;

    this.haptic('success');
    this.showStatus(`Theme: ${theme.name}`, 'success');
  }

  cycleTheme() {
    const themeNames = Object.keys(TERMINAL_THEMES);
    const currentIndex = themeNames.indexOf(this.currentTheme);
    const nextIndex = (currentIndex + 1) % themeNames.length;
    this.setTheme(themeNames[nextIndex]);
  }

  // Copy selection to clipboard
  async copySelection() {
    const selection = this.terminal.getSelection();

    if (!selection) {
      this.showStatus('No text selected', 'info');
      return;
    }

    try {
      await navigator.clipboard.writeText(selection);
      this.haptic('success');
      this.showStatus('Copied to clipboard', 'success');
      // Clear selection after copy
      this.terminal.clearSelection();
    } catch (err) {
      console.error('Failed to copy:', err);
      this.showStatus('Copy failed', 'error');
    }
  }

  // Export session to file
  exportSession() {
    if (!this.terminal || !this.currentSession) {
      this.showStatus('No session to export', 'error');
      return;
    }

    try {
      // Get full buffer content
      const buffer = this.terminal.buffer.active;
      const lines = [];

      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        }
      }

      const content = lines.join('\n');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${this.currentSession}-${timestamp}.txt`;

      // Create download
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.haptic('success');
      this.showStatus(`Exported to ${filename}`, 'success');
    } catch (err) {
      console.error('Export failed:', err);
      this.showStatus('Export failed', 'error');
    }
  }

  // Import text from file
  importFile() {
    if (!this.connection || !this.connection.isConnected()) {
      this.showStatus('Not connected', 'error');
      return;
    }

    // Create hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.log,.sh,.js,.py,.json,.yaml,.yml,.toml,.env,.conf,.cfg';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const content = await file.text();

        // Confirm before sending large files
        if (content.length > 5000) {
          const lines = content.split('\n').length;
          if (!confirm(`Import ${lines} lines (${content.length} chars)? Large pastes may be slow.`)) {
            return;
          }
        }

        // Send content to terminal
        this.sendInput(content);
        this.haptic('success');
        this.showStatus(`Imported ${file.name}`, 'success');
      } catch (err) {
        console.error('Import failed:', err);
        this.showStatus('Import failed', 'error');
      }
    };

    input.click();
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
    const upBtn = document.getElementById('dir-up');

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

      // Update up button state
      upBtn.disabled = data.parent === null;

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
    const skipPermissions = document.getElementById('skip-permissions-toggle').checked;
    const directory = this.currentDirPath;

    this.hideDirModal();

    try {
      this.showStatus('Creating session...', 'info');

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory, skipPermissions })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const data = await response.json();

      // Save folder to history on successful creation
      this.addToFolderHistory(directory);

      this.showStatus(`Created ${data.name}`, 'success');

      await this.loadSessions();
      this.connectToSession(data.name);
    } catch (err) {
      console.error('Failed to create session:', err);
      this.showStatus(err.message, 'error');
    }
  }

  showKillModal() {
    this.lockScroll();
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
    this.unlockScroll();
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
    this.currentSession = sessionName;
    this.terminal.clear();
    this.showStatus(`Connecting to ${sessionName}...`, 'info');

    // Update select
    const select = document.getElementById('session-select');
    select.value = sessionName;

    // Reset buffer state for new session
    this.bufferState = null;
    this.lastReceivedLine = 0;

    // Connect using ConnectionManager
    this.setConnectionStatus('connecting');
    this.connection.resetState();
    this.connection.connect(sessionName);
  }

  sendInput(data) {
    if (this.connection) {
      this.connection.sendInput(data);
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
    if (this.connection && this.terminal) {
      const { cols, rows } = this.terminal;
      this.connection.sendResize(cols, rows);
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

    // Build title with latency if available
    let title = status.charAt(0).toUpperCase() + status.slice(1);
    if (status === 'connected' && this.latency !== null) {
      title += ` (${this.latency}ms)`;
      // Add quality class based on latency
      if (this.latency < 100) {
        indicator.classList.add('quality-good');
      } else if (this.latency < 300) {
        indicator.classList.add('quality-fair');
      } else {
        indicator.classList.add('quality-poor');
      }
    }
    indicator.title = title;
  }

  startPing() {
    this.stopPing(); // Clear any existing
    this.pingInterval = setInterval(() => {
      if (this.connection && this.connection.isConnected()) {
        this.connection.sendPing();
      }
    }, 5000); // Ping every 5 seconds
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.latency = null;
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
    let offlineSince = null;

    const updateOnlineStatus = () => {
      if (navigator.onLine) {
        banner.classList.remove('visible');

        // Calculate offline duration
        if (offlineSince) {
          const offlineDuration = Date.now() - offlineSince;
          const seconds = Math.round(offlineDuration / 1000);
          console.log(`Back online after ${seconds}s offline`);
          offlineSince = null;
        }
      } else {
        banner.classList.add('visible');
        offlineSince = Date.now();
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Smart reconnection on network restore
    window.addEventListener('online', () => {
      if (this.currentSession && this.connection) {
        if (!this.connection.isConnected()) {
          this.showStatus('Back online, reconnecting...', 'info');
          // ConnectionManager will handle reconnection automatically
        } else {
          this.showStatus('Connection restored', 'success');
        }
      } else {
        this.showStatus('Back online', 'success');
      }

      // Refresh session list in case sessions changed while offline
      setTimeout(() => this.loadSessions(), 1000);
    });

    window.addEventListener('offline', () => {
      this.showStatus('You are offline - input will be queued', 'warning');
      this.setConnectionStatus('disconnected');
    });
  }

  setupInstallPrompt() {
    const installBtn = document.getElementById('install-btn');

    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         window.navigator.standalone === true;

    if (isStandalone) {
      // Already installed, don't show install button
      return;
    }

    // Check if iOS Safari (no beforeinstallprompt support)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    if (isIOS) {
      // Show install button with iOS instructions
      installBtn.style.display = 'inline-flex';
      installBtn.textContent = 'Add to Home';
      installBtn.addEventListener('click', () => {
        this.showIOSInstallInstructions();
      });
      return;
    }

    // Android/Chrome - use beforeinstallprompt
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

  showIOSInstallInstructions() {
    // Show instructions in terminal
    const instructions = [
      '',
      '\x1b[1;36m  Install ClaudePod on iOS\x1b[0m',
      '\x1b[38;2;90;90;90m  ─────────────────────────────\x1b[0m',
      '',
      '  1. Tap the \x1b[1mShare\x1b[0m button (box with arrow)',
      '  2. Scroll down and tap \x1b[1m"Add to Home Screen"\x1b[0m',
      '  3. Tap \x1b[1m"Add"\x1b[0m in the top right',
      '',
      '\x1b[38;2;90;90;90m  ─────────────────────────────\x1b[0m',
      ''
    ].join('\r\n');

    this.terminal.write(instructions);
    this.showStatus('See instructions above', 'info');
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

  // ============ D-PAD SETUP ============
  setupDpad() {
    const arrowKeys = {
      'up': '\x1b[A',
      'down': '\x1b[B',
      'right': '\x1b[C',
      'left': '\x1b[D'
    };

    document.querySelectorAll('.dpad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const direction = btn.dataset.arrow;
        if (direction && arrowKeys[direction]) {
          this.haptic('light');
          this.sendInput(arrowKeys[direction]);
        }
      });
    });
  }

  // ============ MENU DETECTION & TAP-TO-SELECT ============
  setupMenuDetection() {
    this.menuOverlay = document.getElementById('menu-overlay');
    this.detectedMenuOptions = [];
    this.menuCheckInterval = null;

    // Check for menus periodically when terminal has data
    if (this.terminal) {
      this.terminal.onData(() => {
        // Debounce menu detection
        clearTimeout(this.menuCheckTimeout);
        this.menuCheckTimeout = setTimeout(() => {
          this.detectAndRenderMenu();
        }, 300);
      });
    }
  }

  detectAndRenderMenu() {
    if (!this.terminal || !this.menuOverlay) return;

    const buffer = this.terminal.buffer.active;
    const viewportHeight = this.terminal.rows;
    const baseY = buffer.viewportY;

    // Scan visible lines for menu patterns
    const menuPatterns = [];
    let currentSelection = -1;

    for (let i = 0; i < viewportHeight; i++) {
      const line = buffer.getLine(baseY + i);
      if (!line) continue;

      const text = line.translateToString(true);

      // Detect selection indicator (❯ or >)
      const selectionMatch = text.match(/^(\s*)(❯|>)\s+(.+)$/);
      if (selectionMatch) {
        currentSelection = menuPatterns.length;
        menuPatterns.push({
          row: i,
          text: selectionMatch[3].trim(),
          isSelected: true
        });
        continue;
      }

      // Detect unselected options (indented, no indicator)
      const optionMatch = text.match(/^(\s{2,})([^❯>\s].+)$/);
      if (optionMatch && menuPatterns.length > 0) {
        // Only add if we already found a selected item (part of same menu)
        const optionText = optionMatch[2].trim();
        // Skip if it's a prompt line or header
        if (!optionText.startsWith('?') && optionText.length > 1) {
          menuPatterns.push({
            row: i,
            text: optionText,
            isSelected: false
          });
        }
      }

      // Detect checkbox options [ ] or [x]
      const checkboxMatch = text.match(/^(\s*)\[([ x])\]\s+(.+)$/i);
      if (checkboxMatch) {
        menuPatterns.push({
          row: i,
          text: checkboxMatch[3].trim(),
          isSelected: checkboxMatch[2].toLowerCase() === 'x',
          isCheckbox: true
        });
      }
    }

    // Only show overlay if we found menu options
    if (menuPatterns.length >= 2) {
      this.renderMenuOverlay(menuPatterns, currentSelection);
    } else {
      this.clearMenuOverlay();
    }
  }

  renderMenuOverlay(options, currentSelection) {
    if (!this.menuOverlay) return;

    this.detectedMenuOptions = options;
    this.currentMenuSelection = currentSelection;

    // Get terminal dimensions for positioning
    const terminalEl = document.getElementById('terminal');
    const termRect = terminalEl.getBoundingClientRect();
    const cellHeight = termRect.height / this.terminal.rows;
    const cellWidth = termRect.width / this.terminal.cols;

    let html = '';
    options.forEach((opt, idx) => {
      const top = opt.row * cellHeight;
      const height = cellHeight;

      html += `
        <div class="menu-option"
             data-index="${idx}"
             style="top: ${top}px; left: 0; right: 0; height: ${height}px;">
          <span class="menu-option-label">TAP</span>
        </div>
      `;
    });

    this.menuOverlay.innerHTML = html;
    this.menuOverlay.classList.add('active');

    // Add click handlers
    this.menuOverlay.querySelectorAll('.menu-option').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(el.dataset.index);
        this.selectMenuOption(idx);
      });
    });
  }

  selectMenuOption(targetIndex) {
    if (!this.detectedMenuOptions || targetIndex < 0) return;

    const currentIdx = this.currentMenuSelection >= 0 ? this.currentMenuSelection : 0;
    const delta = targetIndex - currentIdx;

    this.haptic('medium');

    // Send arrow keys to navigate
    if (delta !== 0) {
      const arrowKey = delta > 0 ? '\x1b[B' : '\x1b[A'; // Down or Up
      const count = Math.abs(delta);
      for (let i = 0; i < count; i++) {
        this.sendInput(arrowKey);
      }
    }

    // Send Enter after a short delay
    setTimeout(() => {
      this.sendInput('\r');
      this.clearMenuOverlay();
    }, 50);
  }

  clearMenuOverlay() {
    if (this.menuOverlay) {
      this.menuOverlay.innerHTML = '';
      this.menuOverlay.classList.remove('active');
    }
    this.detectedMenuOptions = [];
    this.currentMenuSelection = -1;
  }

  // ============ PASTE CHIP ============
  setupPasteChip() {
    this.pasteChip = document.getElementById('paste-chip');
    const composer = document.getElementById('input-composer');

    if (!this.pasteChip || !composer) return;

    // Check clipboard on focus
    composer.addEventListener('focus', () => this.checkClipboard());

    // Paste chip click handler
    this.pasteChip.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          composer.value += text;
          composer.dispatchEvent(new Event('input'));
          this.haptic('light');
          this.pasteChip.style.display = 'none';
        }
      } catch (err) {
        console.warn('Paste failed:', err);
      }
    });
  }

  async checkClipboard() {
    if (!this.pasteChip) return;

    try {
      // Check if clipboard has text (requires permission)
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        this.pasteChip.style.display = 'block';
      } else {
        this.pasteChip.style.display = 'none';
      }
    } catch (err) {
      // Clipboard access denied or empty
      this.pasteChip.style.display = 'none';
    }
  }

  // ============ KEYBOARD DISMISS ON SCROLL ============
  setupKeyboardDismiss() {
    const terminalEl = document.getElementById('terminal');
    if (!terminalEl) return;

    // Find the xterm viewport
    const viewport = terminalEl.querySelector('.xterm-viewport');
    if (!viewport) {
      // Retry after terminal is fully initialized
      setTimeout(() => this.setupKeyboardDismiss(), 500);
      return;
    }

    let lastScrollTop = viewport.scrollTop;
    let scrollAccumulator = 0;

    viewport.addEventListener('scroll', () => {
      const delta = viewport.scrollTop - lastScrollTop;
      lastScrollTop = viewport.scrollTop;

      // Only track upward scroll (negative delta)
      if (delta < 0) {
        scrollAccumulator += Math.abs(delta);

        // Dismiss keyboard after 50px of upward scroll
        if (scrollAccumulator > 50) {
          const composer = document.getElementById('input-composer');
          if (document.activeElement === composer) {
            composer.blur();
            this.showStatus('Keyboard dismissed', 'info');
          }
          scrollAccumulator = 0;
        }
      } else {
        // Reset accumulator on downward scroll
        scrollAccumulator = 0;
      }
    }, { passive: true });
  }

  // ============ DRAFT PERSISTENCE ============
  saveDraft() {
    const composer = document.getElementById('input-composer');
    if (!composer || !this.currentSession) return;

    const draft = composer.value;
    if (draft) {
      localStorage.setItem(`claudepod_draft_${this.currentSession}`, draft);
    } else {
      localStorage.removeItem(`claudepod_draft_${this.currentSession}`);
    }
  }

  loadDraft() {
    const composer = document.getElementById('input-composer');
    if (!composer || !this.currentSession) return;

    const draft = localStorage.getItem(`claudepod_draft_${this.currentSession}`);
    if (draft) {
      composer.value = draft;
      composer.dispatchEvent(new Event('input')); // Trigger auto-resize
    }
  }

  clearDraft() {
    if (this.currentSession) {
      localStorage.removeItem(`claudepod_draft_${this.currentSession}`);
    }
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ClaudePod();
});
