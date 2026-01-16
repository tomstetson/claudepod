/**
 * ConnectionManager - WebSocket connection handler with automatic reconnection
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - State tracking for sync after reconnect
 * - Visibility-aware connection management
 * - Event-based API for UI integration
 */

class ConnectionManager {
  constructor(options = {}) {
    // Configuration
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;
    this.idleTimeout = options.idleTimeout || 5 * 60 * 1000; // 5 minutes

    // State
    this.socket = null;
    this.sessionName = null;
    this.reconnectAttempts = 0;
    this.intentionalClose = false;
    this.lastReceivedLine = 0;
    this.bufferState = null;
    this.reconnectTimer = null;
    this.idleTimer = null;

    // Event handlers
    this.handlers = {
      connected: [],
      disconnected: [],
      reconnecting: [],
      reconnect_failed: [],
      message: [],
      error: [],
      state_sync: [],
      output: []
    };

    // Bind methods
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
    this.handleOffline = this.handleOffline.bind(this);

    // Setup visibility and network listeners
    this.setupListeners();
  }

  /**
   * Register an event handler
   * @param {string} event - Event name
   * @param {Function} handler - Handler function
   */
  on(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }
    return this;
  }

  /**
   * Remove an event handler
   * @param {string} event - Event name
   * @param {Function} handler - Handler function
   */
  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
    return this;
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.handlers[event]) {
      for (const handler of this.handlers[event]) {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in ${event} handler:`, err);
        }
      }
    }
  }

  /**
   * Setup visibility and network listeners
   */
  setupListeners() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  /**
   * Cleanup listeners
   */
  destroy() {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.disconnect();
  }

  /**
   * Handle visibility change
   */
  handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // App became visible
      this.clearIdleTimer();

      // Reconnect if disconnected
      if (this.sessionName && !this.isConnected()) {
        console.log('App visible, reconnecting...');
        this.connect(this.sessionName);
      }
    } else {
      // App hidden - start idle timer
      this.startIdleTimer();
    }
  }

  /**
   * Handle coming back online
   */
  handleOnline() {
    if (this.sessionName && !this.isConnected()) {
      console.log('Network restored, reconnecting...');
      // Small delay to let network stabilize
      setTimeout(() => this.connect(this.sessionName), 500);
    }
  }

  /**
   * Handle going offline
   */
  handleOffline() {
    // Clear reconnect attempts - no point trying while offline
    this.clearReconnectTimer();
  }

  /**
   * Start idle timer for background disconnection
   */
  startIdleTimer() {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (document.visibilityState === 'hidden' && this.isConnected()) {
        console.log('Idle timeout, disconnecting...');
        this.disconnect();
      }
    }, this.idleTimeout);
  }

  /**
   * Clear idle timer
   */
  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Clear reconnect timer
   */
  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   * @returns {string} - 'connected', 'connecting', 'disconnected'
   */
  getState() {
    if (!this.socket) return 'disconnected';
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      default: return 'disconnected';
    }
  }

  /**
   * Connect to a session
   * @param {string} sessionName - Session to connect to
   */
  connect(sessionName) {
    // Close existing connection
    if (this.socket) {
      this.intentionalClose = true;
      this.socket.close(1000, 'Switching session');
      this.socket = null;
    }

    this.sessionName = sessionName;
    this.intentionalClose = false;
    this.clearReconnectTimer();

    this.createSocket();
  }

  /**
   * Create WebSocket connection
   */
  createSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/terminal/${this.sessionName}`;

    console.log(`Connecting to ${url}...`);
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log(`Connected to session: ${this.sessionName}`);
      this.reconnectAttempts = 0;
      this.clearReconnectTimer();

      this.emit('connected', {
        sessionName: this.sessionName,
        wasReconnect: this.lastReceivedLine > 0
      });
    };

    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (err) {
        console.error('Invalid message:', err);
      }
    };

    this.socket.onclose = (event) => {
      console.log(`Disconnected: code=${event.code}, reason=${event.reason}`);

      this.emit('disconnected', {
        code: event.code,
        reason: event.reason,
        wasIntentional: this.intentionalClose
      });

      // Don't reconnect if intentional or clean close
      if (this.intentionalClose) {
        return;
      }

      // Session not found - don't reconnect
      if (event.code === 4001) {
        this.emit('error', { message: `Session "${this.sessionName}" not found`, recoverable: false });
        return;
      }

      // PTY spawn failed - don't reconnect
      if (event.code === 4002) {
        this.emit('error', { message: 'Failed to attach to session', recoverable: false });
        return;
      }

      // Abnormal close - try to reconnect
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (err) => {
      console.error('WebSocket error:', err);
      this.emit('error', { message: 'Connection error', recoverable: true });
    };
  }

  /**
   * Handle incoming message
   * @param {Object} msg - Parsed message
   */
  handleMessage(msg) {
    switch (msg.type) {
      case 'state_sync':
        // Initial state sync on connect
        this.bufferState = msg.bufferState;
        if (msg.startLine) {
          this.lastReceivedLine = msg.startLine + (msg.lines?.length || 0) - 1;
        }
        this.emit('state_sync', msg);
        break;

      case 'sync_response':
        // Response to sync_request
        this.bufferState = msg.bufferState;
        this.emit('sync_response', msg);
        break;

      case 'output':
        // Terminal output
        if (msg.line) {
          this.lastReceivedLine = msg.line;
        }
        this.emit('output', msg);
        break;

      case 'pong':
        this.emit('pong', msg);
        break;

      case 'exit':
        this.emit('exit', msg);
        break;

      case 'error':
        this.emit('error', msg);
        break;

      case 'buffer_state':
        this.bufferState = msg.bufferState;
        this.emit('buffer_state', msg);
        break;

      default:
        // Pass through unknown messages
        this.emit('message', msg);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      this.emit('reconnect_failed', {
        attempts: this.reconnectAttempts
      });
      return;
    }

    // Don't reconnect while offline
    if (!navigator.onLine) {
      console.log('Offline, skipping reconnect');
      return;
    }

    // Don't reconnect while hidden (will reconnect on visibility change)
    if (document.visibilityState === 'hidden') {
      console.log('Hidden, will reconnect when visible');
      return;
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay
    );

    this.reconnectAttempts++;

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay
    });

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (this.sessionName && !this.intentionalClose) {
        this.createSocket();
      }
    }, delay);
  }

  /**
   * Disconnect from session
   */
  disconnect() {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.clearIdleTimer();

    if (this.socket) {
      this.socket.close(1000, 'User disconnect');
      this.socket = null;
    }
  }

  /**
   * Send a message
   * @param {Object} msg - Message to send
   * @returns {boolean} - Whether message was sent
   */
  send(msg) {
    if (!this.isConnected()) {
      console.warn('Cannot send, not connected');
      return false;
    }

    try {
      this.socket.send(JSON.stringify(msg));
      return true;
    } catch (err) {
      console.error('Send failed:', err);
      return false;
    }
  }

  /**
   * Send terminal input
   * @param {string} data - Input data
   */
  sendInput(data) {
    return this.send({ type: 'input', data });
  }

  /**
   * Send resize
   * @param {number} cols - Columns
   * @param {number} rows - Rows
   */
  sendResize(cols, rows) {
    return this.send({ type: 'resize', cols, rows });
  }

  /**
   * Send ping for latency measurement
   */
  sendPing() {
    return this.send({ type: 'ping', timestamp: Date.now() });
  }

  /**
   * Request historical content
   * @param {number} fromLine - Starting line number
   * @param {number} count - Number of lines to fetch
   */
  requestHistory(fromLine, count) {
    return this.send({ type: 'sync_request', fromLine, count });
  }

  /**
   * Request buffer state
   */
  requestBufferState() {
    return this.send({ type: 'buffer_state' });
  }

  /**
   * Reset state for new session
   */
  resetState() {
    this.lastReceivedLine = 0;
    this.bufferState = null;
    this.reconnectAttempts = 0;
  }
}

// Export for use in app.js
window.ConnectionManager = ConnectionManager;
