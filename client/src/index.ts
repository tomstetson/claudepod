/**
 * ClaudePod 2.0 - Main Entry Point
 *
 * Mobile-first terminal for Claude Code access via Tailscale.
 * Built with custom canvas renderer and iOS-optimized input handling.
 */

import { Terminal } from './terminal/Terminal';
import { WSConnection } from './connection/WSConnection';
import { iOSAdapter } from './platform/iOSAdapter';
import { detectPlatform, isStandalone } from './platform/PlatformAdapter';

// Application state
interface AppState {
  terminal: Terminal | null;
  connection: WSConnection | null;
  platform: iOSAdapter | null;
  currentSession: string | null;
  sessions: string[];
  composer: HTMLTextAreaElement | null;
}

const state: AppState = {
  terminal: null,
  connection: null,
  platform: null,
  currentSession: null,
  sessions: [],
  composer: null
};

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  console.log('ClaudePod 2.0 initializing...');
  console.log(`Platform: ${detectPlatform()}`);
  console.log(`Standalone: ${isStandalone()}`);

  // Setup platform adapter
  if (detectPlatform() === 'ios') {
    state.platform = new iOSAdapter();
    setupKeyboardHandling();
  }

  // Create terminal
  const container = document.getElementById('terminal-container');
  if (!container) {
    throw new Error('Terminal container not found');
  }

  state.terminal = new Terminal({
    container,
    fontSize: 14,
    scrollback: 10000
  });

  // Handle terminal data (user input)
  state.terminal.on('data', (data) => {
    if (state.connection?.isConnected()) {
      state.connection.sendInput(data);
    }
  });

  // Handle terminal resize
  state.terminal.on('resize', ({ cols, rows }) => {
    console.log(`Terminal resized: ${cols}x${rows}`);
    if (state.connection?.isConnected()) {
      state.connection.sendResize(cols, rows);
    }
  });

  // Create connection
  state.connection = new WSConnection({
    reconnect: true,
    maxReconnectAttempts: 10,
    pingInterval: 30000
  });

  // Handle connection output
  state.connection.on('output', (data) => {
    state.terminal?.write(data);
  });

  // Handle connection state changes
  state.connection.on('stateChange', (connectionState) => {
    updateConnectionStatus(connectionState);
  });

  state.connection.on('connected', () => {
    // Send initial resize
    const dims = state.terminal?.getDimensions();
    if (dims) {
      state.connection?.sendResize(dims.cols, dims.rows);
    }
  });

  state.connection.on('latency', (latency) => {
    updateLatencyDisplay(latency);
  });

  // Setup UI
  setupUI();

  // Load sessions
  await loadSessions();

  // Connect to first session or show session picker
  if (state.sessions.length > 0) {
    connectToSession(state.sessions[0]);
  } else {
    showNoSessionsMessage();
  }

  console.log('ClaudePod 2.0 initialized');
}

/**
 * Setup keyboard handling with iOS fixes
 */
function setupKeyboardHandling(): void {
  if (!state.platform) return;

  state.platform.onKeyboardChange((keyboardState) => {
    const container = document.getElementById('app');
    if (!container) return;

    if (keyboardState.visible) {
      container.classList.add('keyboard-visible');
      container.style.setProperty('--keyboard-height', `${keyboardState.height}px`);
    } else {
      container.classList.remove('keyboard-visible');
      container.style.removeProperty('--keyboard-height');
    }
  });
}

/**
 * Setup UI elements
 */
function setupUI(): void {
  // Setup input composer
  const composer = document.getElementById('input-composer') as HTMLTextAreaElement;
  if (composer) {
    state.composer = composer;

    composer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendComposerInput();
      }
    });

    // iOS: Prevent zoom on double-tap
    composer.addEventListener('touchend', (e) => {
      e.preventDefault();
      composer.focus();
    });
  }

  // Setup quick action buttons
  setupQuickActions();

  // Setup session switcher
  setupSessionSwitcher();

  // Setup scroll buttons
  setupScrollButtons();
}

/**
 * Setup quick action buttons
 */
function setupQuickActions(): void {
  const actions = [
    { id: 'btn-y', input: 'y\n' },
    { id: 'btn-n', input: 'n\n' },
    { id: 'btn-enter', input: '\r' },
    { id: 'btn-esc', input: '\x1b' },
    { id: 'btn-ctrl-c', input: '\x03' }
  ];

  for (const action of actions) {
    const btn = document.getElementById(action.id);
    if (btn) {
      btn.addEventListener('click', () => {
        state.platform?.haptic('light');
        state.connection?.sendInput(action.input);
        state.terminal?.scrollToBottom();
      });
    }
  }
}

/**
 * Setup session switcher
 */
function setupSessionSwitcher(): void {
  const sessionList = document.getElementById('session-list');
  if (!sessionList) return;

  sessionList.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const sessionItem = target.closest('[data-session]') as HTMLElement;
    if (sessionItem) {
      const sessionName = sessionItem.dataset.session;
      if (sessionName && sessionName !== state.currentSession) {
        connectToSession(sessionName);
      }
    }
  });
}

/**
 * Setup scroll buttons
 */
function setupScrollButtons(): void {
  const scrollTop = document.getElementById('btn-scroll-top');
  const scrollBottom = document.getElementById('btn-scroll-bottom');

  if (scrollTop) {
    scrollTop.addEventListener('click', () => {
      state.terminal?.scrollToTop();
    });
  }

  if (scrollBottom) {
    scrollBottom.addEventListener('click', () => {
      state.terminal?.scrollToBottom();
    });
  }
}

/**
 * Send input from composer
 */
function sendComposerInput(): void {
  if (!state.composer) return;

  const value = state.composer.value;
  if (value) {
    state.connection?.sendInput(value + '\n');
    state.composer.value = '';
    state.terminal?.scrollToBottom();
  }
}

/**
 * Load available sessions
 */
async function loadSessions(): Promise<void> {
  try {
    const response = await fetch('/api/sessions');
    const data = await response.json();
    state.sessions = data.sessions || [];
    renderSessionList();
  } catch (err) {
    console.error('Failed to load sessions:', err);
    state.sessions = [];
  }
}

/**
 * Render session list in UI
 */
function renderSessionList(): void {
  const sessionList = document.getElementById('session-list');
  if (!sessionList) return;

  sessionList.innerHTML = state.sessions.map(session => `
    <button
      class="session-item ${session === state.currentSession ? 'active' : ''}"
      data-session="${session}"
    >
      ${session}
    </button>
  `).join('');
}

/**
 * Connect to a session
 */
function connectToSession(sessionName: string): void {
  console.log(`Connecting to session: ${sessionName}`);
  state.currentSession = sessionName;
  state.connection?.connect(sessionName);
  state.terminal?.reset();
  renderSessionList();
  updateHeader(sessionName);
}

/**
 * Update connection status display
 */
function updateConnectionStatus(connectionState: string): void {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) {
    statusEl.textContent = connectionState;
    statusEl.className = `status status-${connectionState}`;
  }
}

/**
 * Update latency display
 */
function updateLatencyDisplay(latency: number): void {
  const latencyEl = document.getElementById('latency');
  if (latencyEl) {
    latencyEl.textContent = `${latency}ms`;
  }
}

/**
 * Update header with session name
 */
function updateHeader(sessionName: string): void {
  const headerTitle = document.getElementById('header-title');
  if (headerTitle) {
    headerTitle.textContent = sessionName;
  }
}

/**
 * Show no sessions message
 */
function showNoSessionsMessage(): void {
  const container = document.getElementById('terminal-container');
  if (container) {
    container.innerHTML = `
      <div class="no-sessions">
        <h2>No Active Sessions</h2>
        <p>Start a Claude Code session on your Mac:</p>
        <code>tmux new -s claude -c ~/projects claude</code>
      </div>
    `;
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
(window as unknown as { claudepod: AppState }).claudepod = state;
