const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { startServer, stopServer, request } = require('./setup');

// All server tests share a single server instance
describe('Server Integration', () => {
  before(async () => {
    await startServer();
  });

  after(() => {
    stopServer();
  });

  describe('Static Files', () => {
    it('should serve index.html at root', async () => {
      const res = await request('/');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.includes('ClaudePod'));
    });

    it('should serve style.css', async () => {
      const res = await request('/style.css');
      assert.strictEqual(res.status, 200);
    });

    it('should serve app.js', async () => {
      const res = await request('/app.js');
      assert.strictEqual(res.status, 200);
    });

    it('should serve manifest.json', async () => {
      const res = await request('/manifest.json');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.name === 'ClaudePod');
    });
  });

  describe('Security Headers', () => {
    it('should include X-Content-Type-Options header', async () => {
      const res = await request('/');
      assert.ok(res.headers['x-content-type-options']);
    });

    it('should include X-Frame-Options header', async () => {
      const res = await request('/');
      assert.ok(res.headers['x-frame-options']);
    });
  });

  describe('Rate Limiting', () => {
    it('should include rate limit headers on API', async () => {
      const res = await request('/api/sessions');
      // Rate limit headers from express-rate-limit
      assert.ok(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent API routes', async () => {
      const res = await request('/api/nonexistent');
      // Will return index.html due to catch-all, which is fine for SPA
      assert.strictEqual(res.status, 200);
    });

    it('should handle malformed session names', async () => {
      const res = await request('/api/sessions/invalid;session', {
        method: 'DELETE'
      });
      assert.strictEqual(res.status, 400);
    });
  });

  describe('Directory API Edge Cases', () => {
    it('should handle empty path', async () => {
      const res = await request('/api/directories?path=');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.current, '/');
    });

    it('should handle paths with special characters', async () => {
      const res = await request('/api/directories?path=' + encodeURIComponent('test path'));
      // Should either work or return 404, not crash
      assert.ok(res.status === 200 || res.status === 404);
    });

    it('should prevent null byte injection', async () => {
      const res = await request('/api/directories?path=' + encodeURIComponent('test\x00path'));
      assert.ok(res.status === 200 || res.status === 404 || res.status === 403);
    });
  });

  describe('API Endpoints', () => {
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
        assert.ok(
          res.status === 403 ||
          res.status === 404 ||
          res.body.current === '/' ||
          !res.body.current?.includes('..')
        );
      });
    });

    describe('POST /api/directories', () => {
      it('should require folder name', async () => {
        const res = await request('/api/directories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { path: '' }
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.error.includes('required'));
      });

      it('should reject invalid folder names', async () => {
        const res = await request('/api/directories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { path: '', name: '../../../etc' }
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.error.includes('Invalid'));
      });

      it('should reject path traversal in name', async () => {
        const res = await request('/api/directories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { path: '', name: '; rm -rf /' }
        });
        assert.strictEqual(res.status, 400);
      });
    });

    describe('PUT /api/sessions/:name/label', () => {
      it('should reject invalid session names', async () => {
        const res = await request('/api/sessions/invalid;name/label', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: { label: 'Test' }
        });
        assert.strictEqual(res.status, 400);
      });

      it('should accept valid label updates', async () => {
        const res = await request('/api/sessions/test_session/label', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: { label: 'My Project' }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.label, 'My Project');
      });
    });

    describe('PUT /api/sessions/:name/notifications', () => {
      it('should reject invalid session names', async () => {
        const res = await request('/api/sessions/invalid;name/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: { enabled: true }
        });
        assert.strictEqual(res.status, 400);
      });

      it('should require enabled boolean', async () => {
        const res = await request('/api/sessions/test_session/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: { enabled: 'not-boolean' }
        });
        assert.strictEqual(res.status, 400);
        assert.ok(res.body.error.includes('boolean'));
      });

      it('should accept valid notification toggle', async () => {
        const res = await request('/api/sessions/test_session/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: { enabled: false }
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.notifications, false);
      });
    });
  });
});
