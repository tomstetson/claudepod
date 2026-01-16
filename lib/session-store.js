/**
 * SessionStore - Persistent storage for session metadata and buffers
 *
 * Stores session data on disk for recovery after server restart.
 * Each session gets its own directory with metadata and buffer files.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class SessionStore {
  /**
   * @param {Object} options
   * @param {string} options.baseDir - Base directory for storage (default: ~/.claudepod/sessions)
   */
  constructor(options = {}) {
    const defaultBase = path.join(os.homedir(), '.claudepod', 'sessions');
    this.baseDir = options.baseDir || defaultBase;

    // Ensure base directory exists
    this.ensureDir(this.baseDir);
  }

  /**
   * Ensure a directory exists, creating it if necessary
   * @param {string} dir
   */
  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Get the directory path for a session
   * @param {string} sessionName
   * @returns {string}
   */
  getSessionDir(sessionName) {
    // Sanitize session name to prevent path traversal
    const safeName = sessionName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.baseDir, safeName);
  }

  /**
   * Get the metadata file path for a session
   * @param {string} sessionName
   * @returns {string}
   */
  getMetaPath(sessionName) {
    return path.join(this.getSessionDir(sessionName), 'meta.json');
  }

  /**
   * Get the buffer file path for a session
   * @param {string} sessionName
   * @returns {string}
   */
  getBufferPath(sessionName) {
    return path.join(this.getSessionDir(sessionName), 'buffer.log');
  }

  /**
   * Save session metadata
   *
   * @param {Object} session - Session metadata
   * @param {string} session.name - Session name
   * @param {string} session.label - Optional display label
   * @param {boolean} session.notifications - Notifications enabled
   * @param {Object} session.terminalSize - Terminal dimensions
   * @param {Object} session.bufferState - Current buffer state
   */
  async saveMetadata(session) {
    const dir = this.getSessionDir(session.name);
    this.ensureDir(dir);

    const metadata = {
      name: session.name,
      label: session.label || null,
      created: session.created || new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      notifications: session.notifications !== false,
      terminalSize: session.terminalSize || { cols: 80, rows: 24 },
      bufferState: session.bufferState || null
    };

    const metaPath = this.getMetaPath(session.name);
    await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Load session metadata
   *
   * @param {string} sessionName
   * @returns {Object|null} - Session metadata or null if not found
   */
  async loadMetadata(sessionName) {
    const metaPath = this.getMetaPath(sessionName);

    try {
      const content = await fs.promises.readFile(metaPath, 'utf-8');
      return JSON.parse(content);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /**
   * Update last activity timestamp
   *
   * @param {string} sessionName
   */
  async touchSession(sessionName) {
    const metadata = await this.loadMetadata(sessionName);
    if (metadata) {
      metadata.lastActivity = new Date().toISOString();
      await this.saveMetadata(metadata);
    }
  }

  /**
   * Append terminal output to the buffer file
   * Uses append mode for efficiency
   *
   * @param {string} sessionName
   * @param {string} data - Terminal output data
   */
  async appendBuffer(sessionName, data) {
    const dir = this.getSessionDir(sessionName);
    this.ensureDir(dir);

    const bufferPath = this.getBufferPath(sessionName);
    await fs.promises.appendFile(bufferPath, data);
  }

  /**
   * Read buffer content from disk
   *
   * @param {string} sessionName
   * @returns {string} - Buffer content or empty string
   */
  async readBuffer(sessionName) {
    const bufferPath = this.getBufferPath(sessionName);

    try {
      return await fs.promises.readFile(bufferPath, 'utf-8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        return '';
      }
      throw err;
    }
  }

  /**
   * Get buffer file size in bytes
   *
   * @param {string} sessionName
   * @returns {number}
   */
  async getBufferSize(sessionName) {
    const bufferPath = this.getBufferPath(sessionName);

    try {
      const stats = await fs.promises.stat(bufferPath);
      return stats.size;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return 0;
      }
      throw err;
    }
  }

  /**
   * Clear buffer file
   *
   * @param {string} sessionName
   */
  async clearBuffer(sessionName) {
    const bufferPath = this.getBufferPath(sessionName);

    try {
      await fs.promises.writeFile(bufferPath, '');
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /**
   * Delete all data for a session
   *
   * @param {string} sessionName
   */
  async deleteSession(sessionName) {
    const dir = this.getSessionDir(sessionName);

    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /**
   * List all stored sessions
   *
   * @returns {string[]} - Array of session names
   */
  async listSessions() {
    try {
      const entries = await fs.promises.readdir(this.baseDir, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  /**
   * Clean up old sessions that no longer exist in tmux
   *
   * @param {string[]} activeSessions - List of currently active tmux session names
   * @param {number} maxAge - Maximum age in milliseconds for inactive sessions (default: 7 days)
   */
  async cleanup(activeSessions, maxAge = 7 * 24 * 60 * 60 * 1000) {
    const storedSessions = await this.listSessions();
    const now = Date.now();

    for (const sessionName of storedSessions) {
      // Skip active sessions
      if (activeSessions.includes(sessionName)) {
        continue;
      }

      // Check last activity
      const metadata = await this.loadMetadata(sessionName);
      if (metadata && metadata.lastActivity) {
        const lastActivity = new Date(metadata.lastActivity).getTime();
        if (now - lastActivity > maxAge) {
          await this.deleteSession(sessionName);
        }
      }
    }
  }

  /**
   * Get storage statistics
   *
   * @returns {Object} - Storage stats
   */
  async getStats() {
    const sessions = await this.listSessions();
    let totalSize = 0;
    let sessionStats = [];

    for (const name of sessions) {
      const bufferSize = await this.getBufferSize(name);
      const metadata = await this.loadMetadata(name);

      totalSize += bufferSize;
      sessionStats.push({
        name,
        bufferSize,
        lastActivity: metadata?.lastActivity
      });
    }

    return {
      sessionCount: sessions.length,
      totalSize,
      sessions: sessionStats
    };
  }
}

module.exports = { SessionStore };
