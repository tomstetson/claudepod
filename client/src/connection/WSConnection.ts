/**
 * WebSocket Connection Manager
 *
 * Handles WebSocket connection to the ClaudePod server with:
 * - Automatic reconnection with exponential backoff
 * - Visibility-aware connection management
 * - Ping/pong for latency tracking
 * - Message protocol handling
 */

import { EventEmitter } from '../utils/EventEmitter';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ServerMessage {
  type: string;
  [key: string]: unknown;
}

export interface ClientMessage {
  type: string;
  [key: string]: unknown;
}

interface WSConnectionEvents {
  connected: void;
  disconnected: { reason: string; code: number };
  reconnecting: { attempt: number; maxAttempts: number };
  message: ServerMessage;
  output: string;
  error: Error;
  stateChange: ConnectionState;
  latency: number;
}

export interface WSConnectionOptions {
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  pingInterval?: number;
  idleTimeout?: number;
}

const DEFAULT_OPTIONS: Required<WSConnectionOptions> = {
  reconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,
  maxReconnectDelay: 30000,
  pingInterval: 30000,
  idleTimeout: 300000 // 5 minutes
};

export class WSConnection extends EventEmitter<WSConnectionEvents> {
  private socket: WebSocket | null = null;
  private options: Required<WSConnectionOptions>;
  private state: ConnectionState = 'disconnected';

  private sessionName: string = '';
  private baseUrl: string = '';

  // Reconnection state
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;

  // Ping/pong
  private pingTimer: number | null = null;
  private lastPingTime: number = 0;
  private latency: number | null = null;

  // Idle detection
  private idleTimer: number | null = null;

  // Visibility handling
  private isVisible = !document.hidden;

  constructor(options: WSConnectionOptions = {}) {
    super();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.setupVisibilityHandling();
  }

  /**
   * Connect to a session
   */
  connect(sessionName: string): void {
    if (this.state === 'connected' || this.state === 'connecting') {
      if (this.sessionName === sessionName) return;
      this.disconnect('Switching sessions');
    }

    this.sessionName = sessionName;
    this.baseUrl = this.buildUrl(sessionName);
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  /**
   * Disconnect from current session
   */
  disconnect(reason: string = 'User disconnected'): void {
    this.stopReconnect();
    this.stopPing();
    this.stopIdleTimer();

    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.close(1000, reason);
      this.socket = null;
    }

    this.setState('disconnected');
    this.emit('disconnected', { reason, code: 1000 });
  }

  /**
   * Send data to terminal
   */
  sendInput(data: string): boolean {
    return this.send({ type: 'input', data });
  }

  /**
   * Send resize command
   */
  sendResize(cols: number, rows: number): boolean {
    return this.send({ type: 'resize', cols, rows });
  }

  /**
   * Request history sync
   */
  requestHistory(fromLine: number, count: number): boolean {
    return this.send({ type: 'sync_request', fromLine, count });
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get current latency
   */
  getLatency(): number | null {
    return this.latency;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  // Private methods

  private buildUrl(sessionName: string): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/terminal/${encodeURIComponent(sessionName)}`;
  }

  private doConnect(): void {
    this.setState('connecting');

    try {
      this.socket = new WebSocket(this.baseUrl);
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
    } catch (err) {
      this.handleError(err as Event);
    }
  }

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.setState('connected');
    this.emit('connected');
    this.startPing();
    this.resetIdleTimer();
  }

  private handleClose(event: CloseEvent): void {
    this.stopPing();
    this.socket = null;

    const reason = event.reason || 'Connection closed';
    const code = event.code;

    // Don't reconnect for clean closes
    if (code === 1000) {
      this.setState('disconnected');
      this.emit('disconnected', { reason, code });
      return;
    }

    // Attempt reconnection
    if (this.options.reconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.setState('disconnected');
      this.emit('disconnected', { reason, code });
    }
  }

  private handleError(event: Event): void {
    const error = new Error('WebSocket error');
    console.error('WebSocket error:', event);
    this.emit('error', error);
  }

  private handleMessage(event: MessageEvent): void {
    this.resetIdleTimer();

    let message: ServerMessage;
    try {
      message = JSON.parse(event.data);
    } catch {
      // Treat as raw output
      this.emit('output', event.data);
      return;
    }

    // Handle pong
    if (message.type === 'pong') {
      this.latency = Date.now() - this.lastPingTime;
      this.emit('latency', this.latency);
      return;
    }

    // Handle output
    if (message.type === 'output' && typeof message.data === 'string') {
      this.emit('output', message.data);
    }

    // Emit generic message
    this.emit('message', message);
  }

  private send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.socket.send(JSON.stringify(message));
      this.resetIdleTimer();
      return true;
    } catch {
      return false;
    }
  }

  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('stateChange', state);
    }
  }

  private scheduleReconnect(): void {
    this.setState('reconnecting');
    this.reconnectAttempts++;

    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.options.maxReconnectAttempts
    });

    // Exponential backoff
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.options.maxReconnectDelay
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (this.isVisible) {
        this.doConnect();
      }
    }, delay);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = window.setInterval(() => {
      this.lastPingTime = Date.now();
      this.send({ type: 'ping', timestamp: this.lastPingTime });
    }, this.options.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private resetIdleTimer(): void {
    this.stopIdleTimer();

    if (this.options.idleTimeout > 0) {
      this.idleTimer = window.setTimeout(() => {
        if (!this.isVisible) {
          this.disconnect('Idle timeout');
        }
      }, this.options.idleTimeout);
    }
  }

  private stopIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private setupVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;

      if (this.isVisible) {
        // Page became visible
        if (this.state === 'disconnected' && this.sessionName) {
          // Reconnect if we were connected before
          this.connect(this.sessionName);
        } else if (this.state === 'reconnecting') {
          // Speed up reconnection
          this.stopReconnect();
          this.doConnect();
        }
      }
    });

    // Handle online/offline
    window.addEventListener('online', () => {
      if (this.state === 'reconnecting' || this.state === 'disconnected') {
        if (this.sessionName) {
          this.reconnectAttempts = 0;
          this.connect(this.sessionName);
        }
      }
    });
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.disconnect('Destroyed');
    this.removeAllListeners();
  }
}
