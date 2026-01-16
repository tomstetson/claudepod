/**
 * ClaudePod App - Main Application Class
 *
 * Orchestrates all components for a complete Claude Code mobile experience:
 * - Terminal rendering and input
 * - Session management
 * - Claude Code state detection
 * - Offline input queue
 * - Adaptive quick actions
 */

import { Terminal } from './terminal/Terminal';
import { WSConnection, ConnectionState } from './connection/WSConnection';
import { OfflineQueue } from './connection/OfflineQueue';
import { SessionManager, Session } from './session/SessionManager';
import { ClaudeCodeDetector, ClaudePrompt, ClaudeActivity } from './session/ClaudeCodeDetector';
import { InputComposer } from './input/InputComposer';
import { QuickActions } from './ui/QuickActions';
import { iOSAdapter } from './platform/iOSAdapter';
import { detectPlatform, isStandalone } from './platform/PlatformAdapter';
import { EventEmitter } from './utils/EventEmitter';

interface AppEvents {
  ready: void;
  error: Error;
  sessionChanged: Session;
  connectionChanged: ConnectionState;
}

export class App extends EventEmitter<AppEvents> {
  // Core components
  private terminal: Terminal | null = null;
  private connection: WSConnection;
  private offlineQueue: OfflineQueue;
  private sessionManager: SessionManager;
  private claudeDetector: ClaudeCodeDetector;

  // UI components
  private inputComposer: InputComposer | null = null;
  private quickActions: QuickActions | null = null;

  // Platform
  private platform: iOSAdapter | null = null;

  // State
  private currentSession: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _isOnline = navigator.onLine;

  // DOM elements
  private elements: {
    terminalContainer: HTMLElement | null;
    composerInput: HTMLTextAreaElement | null;
    quickActionsContainer: HTMLElement | null;
    sessionList: HTMLElement | null;
    statusBar: HTMLElement | null;
    activityIndicator: HTMLElement | null;
  } = {
    terminalContainer: null,
    composerInput: null,
    quickActionsContainer: null,
    sessionList: null,
    statusBar: null,
    activityIndicator: null
  };

  constructor() {
    super();

    // Initialize services
    this.connection = new WSConnection();
    this.offlineQueue = new OfflineQueue();
    this.sessionManager = new SessionManager();
    this.claudeDetector = new ClaudeCodeDetector();

    // Platform adapter
    if (detectPlatform() === 'ios') {
      this.platform = new iOSAdapter();
    }

    // Setup event handlers
    this.setupConnectionHandlers();
    this.setupSessionHandlers();
    this.setupClaudeDetectorHandlers();
    this.setupOnlineHandlers();
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    console.log('ClaudePod initializing...');
    console.log(`Platform: ${detectPlatform()}, Standalone: ${isStandalone()}`);

    // Get DOM elements
    this.elements = {
      terminalContainer: document.getElementById('terminal-container'),
      composerInput: document.getElementById('input-composer') as HTMLTextAreaElement,
      quickActionsContainer: document.getElementById('quick-actions'),
      sessionList: document.getElementById('session-list'),
      statusBar: document.getElementById('status-bar'),
      activityIndicator: document.getElementById('activity-indicator')
    };

    // Initialize terminal
    if (this.elements.terminalContainer) {
      this.terminal = new Terminal({
        container: this.elements.terminalContainer,
        fontSize: 14,
        scrollback: 10000
      });

      this.terminal.on('data', (data) => this.handleTerminalInput(data));
      this.terminal.on('resize', ({ cols, rows }) => this.handleTerminalResize(cols, rows));
    }

    // Initialize input composer
    if (this.elements.composerInput) {
      this.inputComposer = new InputComposer(this.elements.composerInput);
      this.inputComposer.on('submit', (text) => this.sendInput(text + '\n'));
      this.inputComposer.on('slashCommand', (cmd) => this.sendInput(cmd + '\n'));
    }

    // Initialize quick actions
    if (this.elements.quickActionsContainer) {
      this.quickActions = new QuickActions(this.elements.quickActionsContainer);
      this.quickActions.on('action', ({ input }) => {
        this.platform?.haptic('light');
        this.sendInput(input);
        this.terminal?.scrollToBottom();
      });
    }

    // Setup keyboard handling
    this.setupKeyboardHandling();

    // Setup scroll buttons
    this.setupScrollButtons();

    // Setup send button
    this.setupSendButton();

    // Load sessions
    await this.sessionManager.refreshSessions();
    this.sessionManager.startPolling(5000);

    // Connect to first session
    const sessions = this.sessionManager.getSessionList();
    if (sessions.length > 0) {
      this.connectToSession(sessions[0].name);
    } else {
      this.showNoSessions();
    }

    this.emit('ready');
    console.log('ClaudePod ready');
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(): void {
    this.connection.on('stateChange', (state) => {
      this.updateConnectionStatus(state);
      this.emit('connectionChanged', state);
    });

    this.connection.on('output', (data) => {
      this.terminal?.write(data);
      this.claudeDetector.processOutput(data);
    });

    this.connection.on('connected', async () => {
      // Send resize
      const dims = this.terminal?.getDimensions();
      if (dims) {
        this.connection.sendResize(dims.cols, dims.rows);
      }

      // Replay offline queue
      if (this.currentSession) {
        const count = await this.offlineQueue.getQueueCount(this.currentSession);
        if (count > 0) {
          this.showNotification(`Replaying ${count} queued input(s)...`);
          await this.offlineQueue.replay(this.currentSession, (type, data) => {
            if (type === 'input') {
              return this.connection.sendInput(data as string);
            } else {
              const { cols, rows } = data as { cols: number; rows: number };
              return this.connection.sendResize(cols, rows);
            }
          });
        }
      }
    });

    this.connection.on('latency', (latency) => {
      this.updateLatency(latency);
    });

    this.connection.on('reconnecting', ({ attempt, maxAttempts }) => {
      this.showNotification(`Reconnecting (${attempt}/${maxAttempts})...`);
    });
  }

  /**
   * Setup session event handlers
   */
  private setupSessionHandlers(): void {
    this.sessionManager.on('sessionsChanged', (sessions) => {
      this.renderSessionList(sessions);
    });

    this.sessionManager.on('sessionSwitched', (session) => {
      this.emit('sessionChanged', session);
    });
  }

  /**
   * Setup Claude detector handlers
   */
  private setupClaudeDetectorHandlers(): void {
    this.claudeDetector.on('promptDetected', (prompt) => {
      this.quickActions?.updateForPrompt(prompt);
      this.showPromptHint(prompt);
    });

    this.claudeDetector.on('activityChanged', (activity) => {
      this.quickActions?.updateForActivity(activity);
      this.updateActivityIndicator(activity);
    });
  }

  /**
   * Setup online/offline handlers
   */
  private setupOnlineHandlers(): void {
    window.addEventListener('online', () => {
      this._isOnline = true;
      document.body.classList.remove('offline');
      this.showNotification('Back online');
    });

    window.addEventListener('offline', () => {
      this._isOnline = false;
      document.body.classList.add('offline');
      this.showNotification('Offline - inputs will be queued');
    });
  }

  /**
   * Setup keyboard handling
   */
  private setupKeyboardHandling(): void {
    if (!this.platform) return;

    this.platform.onKeyboardChange((state) => {
      const app = document.getElementById('app');
      if (!app) return;

      if (state.visible) {
        app.classList.add('keyboard-visible');
        app.style.setProperty('--keyboard-height', `${state.height}px`);
      } else {
        app.classList.remove('keyboard-visible');
        app.style.removeProperty('--keyboard-height');
      }
    });
  }

  /**
   * Setup scroll buttons
   */
  private setupScrollButtons(): void {
    const scrollTopBtn = document.getElementById('btn-scroll-top');
    const scrollBottomBtn = document.getElementById('btn-scroll-bottom');

    scrollTopBtn?.addEventListener('click', () => {
      this.platform?.haptic('light');
      this.terminal?.scrollToTop();
    });

    scrollBottomBtn?.addEventListener('click', () => {
      this.platform?.haptic('light');
      this.terminal?.scrollToBottom();
    });
  }

  /**
   * Setup send button
   */
  private setupSendButton(): void {
    const sendBtn = document.getElementById('send-btn');

    sendBtn?.addEventListener('click', () => {
      this.platform?.haptic('light');
      this.inputComposer?.submit();
    });
  }

  /**
   * Connect to a session
   */
  connectToSession(sessionName: string): void {
    if (this.currentSession === sessionName && this.connection.isConnected()) {
      return;
    }

    console.log(`Connecting to session: ${sessionName}`);

    this.currentSession = sessionName;
    this.terminal?.reset();
    this.claudeDetector.clearBuffer();
    this.quickActions?.reset();

    this.connection.connect(sessionName);
    this.sessionManager.switchSession(sessionName);

    this.updateHeader(sessionName);
  }

  /**
   * Send input to terminal
   */
  sendInput(data: string): void {
    if (this.connection.isConnected()) {
      this.connection.sendInput(data);
      this.terminal?.scrollToBottom();
    } else if (this.currentSession) {
      // Queue for later
      this.offlineQueue.enqueue(this.currentSession, 'input', data);
      this.showNotification('Input queued (offline)');
    }
  }

  /**
   * Handle terminal input
   */
  private handleTerminalInput(data: string): void {
    this.sendInput(data);
  }

  /**
   * Handle terminal resize
   */
  private handleTerminalResize(cols: number, rows: number): void {
    if (this.connection.isConnected()) {
      this.connection.sendResize(cols, rows);
    }
  }

  /**
   * Render session list
   */
  private renderSessionList(sessions: Session[]): void {
    if (!this.elements.sessionList) return;

    if (sessions.length === 0) {
      this.elements.sessionList.innerHTML = '<span class="no-sessions-hint">No sessions</span>';
      return;
    }

    this.elements.sessionList.innerHTML = sessions.map(session => {
      const isActive = session.name === this.currentSession;
      const label = session.label || session.name;
      const stateColor = this.claudeDetector.getActivityColor(
        session.claudeState as ClaudeActivity || 'idle'
      );

      return `
        <button
          class="session-item ${isActive ? 'active' : ''}"
          data-session="${session.name}"
        >
          <span class="session-indicator" style="background: ${stateColor}"></span>
          <span class="session-label">${label}</span>
        </button>
      `;
    }).join('');

    // Add click handlers
    this.elements.sessionList.querySelectorAll('.session-item').forEach(el => {
      el.addEventListener('click', () => {
        const sessionName = el.getAttribute('data-session');
        if (sessionName) {
          this.platform?.haptic('light');
          this.connectToSession(sessionName);
        }
      });
    });
  }

  /**
   * Update connection status display
   */
  private updateConnectionStatus(state: ConnectionState): void {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.textContent = state;
      statusEl.className = `status status-${state}`;
    }
  }

  /**
   * Update latency display
   */
  private updateLatency(latency: number): void {
    const latencyEl = document.getElementById('latency');
    if (latencyEl) {
      latencyEl.textContent = `${latency}ms`;
    }
  }

  /**
   * Update header
   */
  private updateHeader(sessionName: string): void {
    const headerTitle = document.getElementById('header-title');
    if (headerTitle) {
      const session = this.sessionManager.getSession(sessionName);
      headerTitle.textContent = session?.label || sessionName;
    }
  }

  /**
   * Update activity indicator
   */
  private updateActivityIndicator(activity: ClaudeActivity): void {
    const indicator = this.elements.activityIndicator;
    if (!indicator) return;

    const label = this.claudeDetector.getActivityLabel(activity);
    const color = this.claudeDetector.getActivityColor(activity);

    if (label) {
      indicator.textContent = label;
      indicator.style.color = color;
      indicator.style.display = 'block';
    } else {
      indicator.style.display = 'none';
    }
  }

  /**
   * Show prompt hint
   */
  private showPromptHint(prompt: ClaudePrompt): void {
    // Could show a toast or hint about expected input
    console.log('Prompt detected:', prompt.type, prompt.message);
  }

  /**
   * Show notification
   */
  private showNotification(message: string): void {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: calc(var(--footer-height, 100px) + var(--safe-bottom, 0px) + 16px);
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000;
      animation: toast-in 0.2s ease-out;
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toast-out 0.2s ease-in forwards';
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }

  /**
   * Show no sessions message
   */
  private showNoSessions(): void {
    if (!this.elements.terminalContainer) return;

    this.elements.terminalContainer.innerHTML = `
      <div class="no-sessions">
        <h2>No Active Sessions</h2>
        <p>Start a Claude Code session on your Mac:</p>
        <code>tmux new -s claude claude</code>
        <p style="margin-top: 16px; color: #666;">
          Sessions will appear automatically when detected.
        </p>
      </div>
    `;
  }

  /**
   * Next session (for swipe gesture)
   */
  nextSession(): void {
    const session = this.sessionManager.nextSession();
    if (session) {
      this.platform?.haptic('light');
      this.connectToSession(session.name);
    }
  }

  /**
   * Previous session (for swipe gesture)
   */
  previousSession(): void {
    const session = this.sessionManager.previousSession();
    if (session) {
      this.platform?.haptic('light');
      this.connectToSession(session.name);
    }
  }

  /**
   * Get current session
   */
  getCurrentSession(): string | null {
    return this.currentSession;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.terminal?.destroy();
    this.connection.destroy();
    this.offlineQueue.destroy();
    this.sessionManager.destroy();
    this.claudeDetector.destroy();
    this.inputComposer?.destroy();
    this.platform?.destroy();
    this.removeAllListeners();
  }
}
