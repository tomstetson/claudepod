const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { SessionStore } = require('../lib/session-store');

describe('SessionStore', () => {
  let store;
  let testDir;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = path.join(os.tmpdir(), `claudepod-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    store = new SessionStore({ baseDir: testDir });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.promises.rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create base directory if it does not exist', () => {
      assert.strictEqual(fs.existsSync(testDir), true);
    });

    it('should use default directory if not specified', () => {
      const defaultStore = new SessionStore();
      const expectedDir = path.join(os.homedir(), '.claudepod', 'sessions');
      assert.strictEqual(defaultStore.baseDir, expectedDir);
    });
  });

  describe('getSessionDir', () => {
    it('should return correct path for valid session name', () => {
      const dir = store.getSessionDir('test-session');
      assert.strictEqual(dir, path.join(testDir, 'test-session'));
    });

    it('should sanitize invalid characters in session name', () => {
      const dir = store.getSessionDir('test/session/../bad');
      // /session/../ has 4 invalid chars: / . . /
      assert.strictEqual(dir, path.join(testDir, 'test_session____bad'));
    });
  });

  describe('saveMetadata / loadMetadata', () => {
    it('should save and load metadata correctly', async () => {
      const session = {
        name: 'test-session',
        label: 'My Test',
        notifications: true,
        terminalSize: { cols: 120, rows: 40 }
      };

      await store.saveMetadata(session);
      const loaded = await store.loadMetadata('test-session');

      assert.strictEqual(loaded.name, 'test-session');
      assert.strictEqual(loaded.label, 'My Test');
      assert.strictEqual(loaded.notifications, true);
      assert.deepStrictEqual(loaded.terminalSize, { cols: 120, rows: 40 });
      assert.ok(loaded.created);
      assert.ok(loaded.lastActivity);
    });

    it('should return null for non-existent session', async () => {
      const loaded = await store.loadMetadata('non-existent');
      assert.strictEqual(loaded, null);
    });

    it('should update lastActivity on save', async () => {
      const session = { name: 'test-session' };

      await store.saveMetadata(session);
      const first = await store.loadMetadata('test-session');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));

      await store.saveMetadata(session);
      const second = await store.loadMetadata('test-session');

      assert.notStrictEqual(first.lastActivity, second.lastActivity);
    });

    it('should use default values for missing fields', async () => {
      await store.saveMetadata({ name: 'minimal' });
      const loaded = await store.loadMetadata('minimal');

      assert.strictEqual(loaded.label, null);
      assert.strictEqual(loaded.notifications, true);
      assert.deepStrictEqual(loaded.terminalSize, { cols: 80, rows: 24 });
    });
  });

  describe('touchSession', () => {
    it('should update lastActivity timestamp', async () => {
      await store.saveMetadata({ name: 'test-session' });
      const before = await store.loadMetadata('test-session');

      await new Promise(resolve => setTimeout(resolve, 10));
      await store.touchSession('test-session');

      const after = await store.loadMetadata('test-session');
      assert.notStrictEqual(before.lastActivity, after.lastActivity);
    });

    it('should do nothing for non-existent session', async () => {
      // Should not throw
      await store.touchSession('non-existent');
    });
  });

  describe('appendBuffer / readBuffer', () => {
    it('should append and read buffer content', async () => {
      await store.appendBuffer('test-session', 'line1\n');
      await store.appendBuffer('test-session', 'line2\n');
      await store.appendBuffer('test-session', 'line3\n');

      const content = await store.readBuffer('test-session');
      assert.strictEqual(content, 'line1\nline2\nline3\n');
    });

    it('should return empty string for non-existent buffer', async () => {
      const content = await store.readBuffer('non-existent');
      assert.strictEqual(content, '');
    });

    it('should handle large content', async () => {
      const largeContent = 'x'.repeat(100000);
      await store.appendBuffer('test-session', largeContent);

      const content = await store.readBuffer('test-session');
      assert.strictEqual(content.length, 100000);
    });

    it('should handle binary-safe content', async () => {
      const content = 'text with \x1b[31mANSI\x1b[0m codes\n';
      await store.appendBuffer('test-session', content);

      const loaded = await store.readBuffer('test-session');
      assert.strictEqual(loaded, content);
    });
  });

  describe('getBufferSize', () => {
    it('should return correct buffer size', async () => {
      await store.appendBuffer('test-session', 'hello world\n');
      const size = await store.getBufferSize('test-session');
      assert.strictEqual(size, 12);
    });

    it('should return 0 for non-existent buffer', async () => {
      const size = await store.getBufferSize('non-existent');
      assert.strictEqual(size, 0);
    });
  });

  describe('clearBuffer', () => {
    it('should clear buffer content', async () => {
      await store.appendBuffer('test-session', 'content\n');
      await store.clearBuffer('test-session');

      const content = await store.readBuffer('test-session');
      assert.strictEqual(content, '');
    });

    it('should not throw for non-existent buffer', async () => {
      await store.clearBuffer('non-existent');
    });
  });

  describe('deleteSession', () => {
    it('should delete all session data', async () => {
      await store.saveMetadata({ name: 'test-session', label: 'Test' });
      await store.appendBuffer('test-session', 'content\n');

      await store.deleteSession('test-session');

      const metadata = await store.loadMetadata('test-session');
      const buffer = await store.readBuffer('test-session');

      assert.strictEqual(metadata, null);
      assert.strictEqual(buffer, '');
    });

    it('should not throw for non-existent session', async () => {
      await store.deleteSession('non-existent');
    });
  });

  describe('listSessions', () => {
    it('should list all stored sessions', async () => {
      await store.saveMetadata({ name: 'session1' });
      await store.saveMetadata({ name: 'session2' });
      await store.saveMetadata({ name: 'session3' });

      const sessions = await store.listSessions();
      assert.deepStrictEqual(sessions.sort(), ['session1', 'session2', 'session3']);
    });

    it('should return empty array when no sessions', async () => {
      const sessions = await store.listSessions();
      assert.deepStrictEqual(sessions, []);
    });
  });

  describe('cleanup', () => {
    it('should delete old inactive sessions', async () => {
      // Create a session with old lastActivity
      await store.saveMetadata({ name: 'old-session' });

      // Manually set old timestamp
      const metaPath = store.getMetaPath('old-session');
      const metadata = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      metadata.lastActivity = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
      await fs.promises.writeFile(metaPath, JSON.stringify(metadata));

      await store.cleanup([], 7 * 24 * 60 * 60 * 1000); // 7 day max age

      const sessions = await store.listSessions();
      assert.strictEqual(sessions.includes('old-session'), false);
    });

    it('should keep active sessions', async () => {
      await store.saveMetadata({ name: 'active-session' });

      // Manually set old timestamp
      const metaPath = store.getMetaPath('active-session');
      const metadata = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
      metadata.lastActivity = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      await fs.promises.writeFile(metaPath, JSON.stringify(metadata));

      // Pass it as active
      await store.cleanup(['active-session'], 7 * 24 * 60 * 60 * 1000);

      const sessions = await store.listSessions();
      assert.strictEqual(sessions.includes('active-session'), true);
    });

    it('should keep recent inactive sessions', async () => {
      await store.saveMetadata({ name: 'recent-session' });

      await store.cleanup([], 7 * 24 * 60 * 60 * 1000);

      const sessions = await store.listSessions();
      assert.strictEqual(sessions.includes('recent-session'), true);
    });
  });

  describe('getStats', () => {
    it('should return storage statistics', async () => {
      await store.saveMetadata({ name: 'session1' });
      await store.appendBuffer('session1', 'hello\n');

      await store.saveMetadata({ name: 'session2' });
      await store.appendBuffer('session2', 'world\n');

      const stats = await store.getStats();

      assert.strictEqual(stats.sessionCount, 2);
      assert.strictEqual(stats.totalSize, 12); // 6 + 6 bytes
      assert.strictEqual(stats.sessions.length, 2);
    });

    it('should return empty stats when no sessions', async () => {
      const stats = await store.getStats();

      assert.strictEqual(stats.sessionCount, 0);
      assert.strictEqual(stats.totalSize, 0);
      assert.deepStrictEqual(stats.sessions, []);
    });
  });
});
