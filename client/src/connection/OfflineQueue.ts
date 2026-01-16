/**
 * OfflineQueue - IndexedDB-backed queue for offline input
 *
 * Stores user input when offline and replays it when connection is restored.
 * This is a unique feature that no competitor offers for AI agent sessions.
 */

import { EventEmitter } from '../utils/EventEmitter';

export interface QueuedInput {
  id: string;
  timestamp: number;
  sessionName: string;
  type: 'input' | 'resize';
  data: string | { cols: number; rows: number };
}

interface OfflineQueueEvents {
  queueChanged: { count: number; sessionName: string };
  replaying: { current: number; total: number };
  replayComplete: { count: number };
  error: Error;
}

const DB_NAME = 'claudepod-offline';
const DB_VERSION = 1;
const STORE_NAME = 'input-queue';

export class OfflineQueue extends EventEmitter<OfflineQueueEvents> {
  private db: IDBDatabase | null = null;
  private dbReady: Promise<void>;
  private replaying = false;

  constructor() {
    super();
    this.dbReady = this.initDB();
  }

  /**
   * Initialize IndexedDB
   */
  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;

        // Handle database connection errors
        this.db.onerror = (event) => {
          console.error('IndexedDB error:', event);
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('sessionName', 'sessionName', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is ready
   */
  private async ensureDB(): Promise<IDBDatabase> {
    await this.dbReady;
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enqueue input for later replay
   */
  async enqueue(sessionName: string, type: 'input' | 'resize', data: string | { cols: number; rows: number }): Promise<void> {
    try {
      const db = await this.ensureDB();

      const item: QueuedInput = {
        id: this.generateId(),
        timestamp: Date.now(),
        sessionName,
        type,
        data
      };

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.add(item);

        request.onsuccess = async () => {
          const count = await this.getQueueCount(sessionName);
          this.emit('queueChanged', { count, sessionName });
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error('Failed to enqueue:', err);
      this.emit('error', err as Error);
    }
  }

  /**
   * Get all queued items for a session
   */
  async getQueue(sessionName: string): Promise<QueuedInput[]> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('sessionName');
        const request = index.getAll(sessionName);

        request.onsuccess = () => {
          const items = request.result as QueuedInput[];
          // Sort by timestamp
          items.sort((a, b) => a.timestamp - b.timestamp);
          resolve(items);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (err) {
      console.error('Failed to get queue:', err);
      return [];
    }
  }

  /**
   * Get count of queued items for a session
   */
  async getQueueCount(sessionName: string): Promise<number> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('sessionName');
        const request = index.count(sessionName);

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch {
      return 0;
    }
  }

  /**
   * Get total count across all sessions
   */
  async getTotalCount(): Promise<number> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.count();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch {
      return 0;
    }
  }

  /**
   * Delete a specific item
   */
  private async deleteItem(id: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear queue for a session
   */
  async clearQueue(sessionName: string): Promise<void> {
    try {
      const items = await this.getQueue(sessionName);

      for (const item of items) {
        await this.deleteItem(item.id);
      }

      this.emit('queueChanged', { count: 0, sessionName });
    } catch (err) {
      console.error('Failed to clear queue:', err);
      this.emit('error', err as Error);
    }
  }

  /**
   * Clear all queues
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('Failed to clear all:', err);
      this.emit('error', err as Error);
    }
  }

  /**
   * Replay queued inputs through a send function
   */
  async replay(
    sessionName: string,
    sendFn: (type: 'input' | 'resize', data: string | { cols: number; rows: number }) => boolean
  ): Promise<number> {
    if (this.replaying) {
      console.warn('Already replaying');
      return 0;
    }

    this.replaying = true;
    let replayedCount = 0;

    try {
      const items = await this.getQueue(sessionName);

      if (items.length === 0) {
        return 0;
      }

      console.log(`Replaying ${items.length} queued inputs for ${sessionName}`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        this.emit('replaying', { current: i + 1, total: items.length });

        // Send the input
        const success = sendFn(item.type, item.data);

        if (success) {
          // Delete from queue
          await this.deleteItem(item.id);
          replayedCount++;

          // Small delay between inputs to avoid overwhelming
          await this.delay(50);
        } else {
          // Stop replay if send fails
          console.warn('Replay send failed, stopping');
          break;
        }
      }

      this.emit('replayComplete', { count: replayedCount });
      this.emit('queueChanged', {
        count: items.length - replayedCount,
        sessionName
      });

      return replayedCount;
    } catch (err) {
      console.error('Replay failed:', err);
      this.emit('error', err as Error);
      return replayedCount;
    } finally {
      this.replaying = false;
    }
  }

  /**
   * Check if currently replaying
   */
  isReplaying(): boolean {
    return this.replaying;
  }

  /**
   * Utility delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.removeAllListeners();
  }
}
