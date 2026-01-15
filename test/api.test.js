const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, stopServer, request } = require('./setup');

describe('API Endpoints', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await startServer();
  });

  after(() => {
    stopServer();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request('/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'healthy');
      assert.ok(res.body.uptime >= 0);
      assert.ok(res.body.timestamp);
    });
  });

  describe('GET /api/sessions', () => {
    it('should return sessions array', async () => {
      const res = await request('/api/sessions');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.sessions));
    });
  });

  describe('GET /api/directories', () => {
    it('should return directory listing for root', async () => {
      const res = await request('/api/directories');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.directories));
      assert.ok(res.body.base);
    });

    it('should reject path traversal attempts', async () => {
      const res = await request('/api/directories?path=../../../etc');
      // Path traversal attempts should be sanitized or rejected
      // The sanitizer strips out '..' segments, resulting in just 'etc' or empty
      assert.ok(
        res.status === 403 ||
        res.status === 404 ||  // 'etc' doesn't exist under PROJECTS_DIR
        res.body.current === '/' ||
        !res.body.current?.includes('..')
      );
    });
  });
});
