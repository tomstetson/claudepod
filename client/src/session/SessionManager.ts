/**
 * SessionManager - Manages tmux sessions and their states
 *
 * Handles:
 * - Session listing and metadata
 * - Session switching
 * - Session state persistence
 * - Claude Code state detection
 */

import { EventEmitter } from '../utils/EventEmitter';

export interface Session {
  name: string;
  label?: string;
  created?: string;
  lastActivity?: Date;
  notifications: boolean;
  claudeState: ClaudeState;
}

export type ClaudeState = 'idle' | 'thinking' | 'waiting' | 'prompting' | 'unknown';

interface SessionManagerEvents {
  sessionsChanged: Session[];
  sessionSwitched: Session;
  claudeStateChanged: { session: string; state: ClaudeState };
  error: Error;
}

export class SessionManager extends EventEmitter<SessionManagerEvents> {
  private sessions = new Map<string, Session>();
  private currentSession: string | null = null;
  private pollInterval: number | null = null;
  private pollFrequency = 5000; // 5 seconds

  // Claude state detection patterns
  private readonly CLAUDE_PATTERNS = {
    thinking: [
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/, // Spinner
      /Thinking\.{0,3}$/m,
      /Processing\.{0,3}$/m,
      /Working\.{0,3}$/m,
    ],
    waiting: [
      /\$ $/m,                    // Shell prompt
      /> $/m,                     // Generic prompt
      /Press Enter to continue/i,
      /\[Y\/n\]/i,
      /\[y\/N\]/i,
      /\(yes\/no\)/i,
    ],
    prompting: [
      /^Human:/m,                 // Claude conversation
      /^User:/m,
      /Enter your message/i,
      /Type your response/i,
      /\? $/m,                    // Question prompt
    ]
  };

  constructor() {
    super();
  }

  /**
   * Start polling for session updates
   */
  startPolling(frequency: number = 5000): void {
    this.pollFrequency = frequency;
    this.stopPolling();
    this.pollInterval = window.setInterval(() => {
      this.refreshSessions();
    }, this.pollFrequency);

    // Initial load
    this.refreshSessions();
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollInterval !== null) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Refresh session list from server
   */
  async refreshSessions(): Promise<void> {
    try {
      const response = await fetch('/api/sessions');
      if (!response.ok) {
        throw new Error(`Failed to fetch sessions: ${response.status}`);
      }

      const data = await response.json();
      const sessionNames: string[] = data.sessions || [];

      // Update sessions map
      const newSessions = new Map<string, Session>();

      for (const name of sessionNames) {
        const existing = this.sessions.get(name);
        if (existing) {
          newSessions.set(name, existing);
        } else {
          // New session
          newSessions.set(name, {
            name,
            notifications: true,
            claudeState: 'unknown',
            lastActivity: new Date()
          });
        }
      }

      // Check for removed sessions
      const changed = this.sessions.size !== newSessions.size ||
        [...this.sessions.keys()].some(k => !newSessions.has(k));

      this.sessions = newSessions;

      if (changed) {
        this.emit('sessionsChanged', this.getSessionList());
      }

      // Fetch labels
      await this.fetchSessionLabels();
    } catch (err) {
      console.error('Failed to refresh sessions:', err);
      this.emit('error', err as Error);
    }
  }

  /**
   * Fetch session labels from server
   */
  private async fetchSessionLabels(): Promise<void> {
    try {
      const response = await fetch('/api/session-labels');
      if (!response.ok) return;

      const labels = await response.json();

      for (const [name, label] of Object.entries(labels)) {
        const session = this.sessions.get(name);
        if (session && typeof label === 'string') {
          session.label = label;
        }
      }
    } catch {
      // Labels are optional
    }
  }

  /**
   * Get all sessions as array
   */
  getSessionList(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get a specific session
   */
  getSession(name: string): Session | undefined {
    return this.sessions.get(name);
  }

  /**
   * Get current session
   */
  getCurrentSession(): Session | null {
    if (!this.currentSession) return null;
    return this.sessions.get(this.currentSession) || null;
  }

  /**
   * Switch to a session
   */
  switchSession(name: string): Session | null {
    const session = this.sessions.get(name);
    if (!session) {
      console.warn(`Session not found: ${name}`);
      return null;
    }

    this.currentSession = name;
    session.lastActivity = new Date();
    this.emit('sessionSwitched', session);
    return session;
  }

  /**
   * Switch to next session
   */
  nextSession(): Session | null {
    const sessions = this.getSessionList();
    if (sessions.length === 0) return null;

    const currentIndex = sessions.findIndex(s => s.name === this.currentSession);
    const nextIndex = (currentIndex + 1) % sessions.length;
    return this.switchSession(sessions[nextIndex].name);
  }

  /**
   * Switch to previous session
   */
  previousSession(): Session | null {
    const sessions = this.getSessionList();
    if (sessions.length === 0) return null;

    const currentIndex = sessions.findIndex(s => s.name === this.currentSession);
    const prevIndex = currentIndex <= 0 ? sessions.length - 1 : currentIndex - 1;
    return this.switchSession(sessions[prevIndex].name);
  }

  /**
   * Update session label
   */
  async setSessionLabel(name: string, label: string): Promise<void> {
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(name)}/label`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
      });

      if (!response.ok) {
        throw new Error(`Failed to set label: ${response.status}`);
      }

      const session = this.sessions.get(name);
      if (session) {
        session.label = label;
        this.emit('sessionsChanged', this.getSessionList());
      }
    } catch (err) {
      this.emit('error', err as Error);
    }
  }

  /**
   * Toggle notifications for a session
   */
  async toggleNotifications(name: string): Promise<boolean> {
    const session = this.sessions.get(name);
    if (!session) return false;

    session.notifications = !session.notifications;

    try {
      await fetch(`/api/sessions/${encodeURIComponent(name)}/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: session.notifications })
      });
    } catch {
      // Revert on failure
      session.notifications = !session.notifications;
      return session.notifications;
    }

    this.emit('sessionsChanged', this.getSessionList());
    return session.notifications;
  }

  /**
   * Create a new session
   */
  async createSession(name: string, directory?: string): Promise<Session | null> {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, directory })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create session');
      }

      await this.refreshSessions();
      return this.switchSession(name);
    } catch (err) {
      this.emit('error', err as Error);
      return null;
    }
  }

  /**
   * Kill a session
   */
  async killSession(name: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/sessions/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Failed to kill session: ${response.status}`);
      }

      this.sessions.delete(name);

      // Switch to another session if this was current
      if (this.currentSession === name) {
        const remaining = this.getSessionList();
        if (remaining.length > 0) {
          this.switchSession(remaining[0].name);
        } else {
          this.currentSession = null;
        }
      }

      this.emit('sessionsChanged', this.getSessionList());
      return true;
    } catch (err) {
      this.emit('error', err as Error);
      return false;
    }
  }

  /**
   * Analyze terminal output to detect Claude state
   */
  analyzeOutput(sessionName: string, output: string): void {
    const session = this.sessions.get(sessionName);
    if (!session) return;

    const previousState = session.claudeState;
    let newState: ClaudeState = 'unknown';

    // Check patterns in order of priority
    // Prompting has highest priority (Claude is asking for input)
    for (const pattern of this.CLAUDE_PATTERNS.prompting) {
      if (pattern.test(output)) {
        newState = 'prompting';
        break;
      }
    }

    // Then check for thinking
    if (newState === 'unknown') {
      for (const pattern of this.CLAUDE_PATTERNS.thinking) {
        if (pattern.test(output)) {
          newState = 'thinking';
          break;
        }
      }
    }

    // Then check for waiting
    if (newState === 'unknown') {
      for (const pattern of this.CLAUDE_PATTERNS.waiting) {
        if (pattern.test(output)) {
          newState = 'waiting';
          break;
        }
      }
    }

    // Update if changed
    if (newState !== 'unknown' && newState !== previousState) {
      session.claudeState = newState;
      session.lastActivity = new Date();
      this.emit('claudeStateChanged', { session: sessionName, state: newState });
    }
  }

  /**
   * Get human-readable state label
   */
  getStateLabel(state: ClaudeState): string {
    switch (state) {
      case 'idle': return 'Idle';
      case 'thinking': return 'Thinking...';
      case 'waiting': return 'Waiting';
      case 'prompting': return 'Needs Input';
      case 'unknown': return '';
    }
  }

  /**
   * Get state color for UI
   */
  getStateColor(state: ClaudeState): string {
    switch (state) {
      case 'idle': return '#888';
      case 'thinking': return '#ffaa00';
      case 'waiting': return '#00ff00';
      case 'prompting': return '#ff6600';
      case 'unknown': return '#444';
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopPolling();
    this.removeAllListeners();
  }
}
