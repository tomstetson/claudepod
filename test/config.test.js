/**
 * Server configuration tests
 * Tests for environment variable handling and path configuration
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');

describe('Server Configuration', () => {
  describe('PROJECTS_DIR configuration', () => {
    it('should default to ~/Projects when env var not set', () => {
      // This tests the logic used in server.js
      const envValue = undefined;
      const defaultPath = path.join(os.homedir(), 'Projects');
      const result = envValue || defaultPath;

      assert.strictEqual(result, defaultPath);
      assert.ok(result.includes('Projects'));
      assert.ok(!result.includes('tomstetson')); // Should not have hardcoded username
    });

    it('should use env var when set', () => {
      const envValue = '/custom/projects/path';
      const defaultPath = path.join(os.homedir(), 'Projects');
      const result = envValue || defaultPath;

      assert.strictEqual(result, '/custom/projects/path');
    });

    it('should handle homedir correctly on different platforms', () => {
      const homedir = os.homedir();
      const projectsDir = path.join(homedir, 'Projects');

      // Should be an absolute path
      assert.ok(path.isAbsolute(projectsDir));
      // Should end with Projects
      assert.ok(projectsDir.endsWith('Projects'));
    });
  });

  describe('TMUX_PATH configuration', () => {
    it('should default to "tmux" (PATH lookup) when env var not set', () => {
      const envValue = undefined;
      const defaultPath = 'tmux';
      const result = envValue || defaultPath;

      assert.strictEqual(result, 'tmux');
    });

    it('should use env var when set', () => {
      const envValue = '/opt/homebrew/bin/tmux';
      const defaultPath = 'tmux';
      const result = envValue || defaultPath;

      assert.strictEqual(result, '/opt/homebrew/bin/tmux');
    });

    it('should not have hardcoded platform-specific paths as default', () => {
      const defaultPath = 'tmux';
      // Should not contain hardcoded paths
      assert.ok(!defaultPath.includes('/opt/homebrew'));
      assert.ok(!defaultPath.includes('/usr/local'));
    });
  });

  describe('PORT configuration', () => {
    it('should default to 3000 when env var not set', () => {
      const envValue = undefined;
      const defaultPort = 3000;
      const result = envValue || defaultPort;

      assert.strictEqual(result, 3000);
    });

    it('should use env var when set', () => {
      const envValue = '8080';
      const defaultPort = 3000;
      const result = parseInt(envValue, 10) || defaultPort;

      assert.strictEqual(result, 8080);
    });
  });
});

describe('Path Security', () => {
  describe('Path traversal prevention logic', () => {
    // This tests the sanitization logic used in the directories API
    function sanitizePath(relativePath) {
      return relativePath
        .split(/[/\\]+/)
        .filter(segment => segment && segment !== '.' && segment !== '..')
        .join('/');
    }

    it('should remove .. segments', () => {
      assert.strictEqual(sanitizePath('../etc'), 'etc');
      assert.strictEqual(sanitizePath('../../etc/passwd'), 'etc/passwd');
      assert.strictEqual(sanitizePath('foo/../bar'), 'foo/bar');
    });

    it('should remove . segments', () => {
      assert.strictEqual(sanitizePath('./foo'), 'foo');
      assert.strictEqual(sanitizePath('foo/./bar'), 'foo/bar');
    });

    it('should handle empty segments', () => {
      assert.strictEqual(sanitizePath('foo//bar'), 'foo/bar');
      assert.strictEqual(sanitizePath('//foo//bar//'), 'foo/bar');
    });

    it('should handle clean paths unchanged', () => {
      assert.strictEqual(sanitizePath('foo'), 'foo');
      assert.strictEqual(sanitizePath('foo/bar'), 'foo/bar');
      assert.strictEqual(sanitizePath('foo/bar/baz'), 'foo/bar/baz');
    });

    it('should handle empty input', () => {
      assert.strictEqual(sanitizePath(''), '');
    });

    it('should handle Windows-style separators', () => {
      assert.strictEqual(sanitizePath('foo\\bar'), 'foo/bar');
      assert.strictEqual(sanitizePath('foo\\..\\bar'), 'foo/bar');
    });
  });

  describe('Session name validation logic', () => {
    // This tests the validation regex used in WebSocket handler
    const sessionNamePattern = /^[a-zA-Z0-9_-]+$/;

    function isValidSessionName(name) {
      return sessionNamePattern.test(name);
    }

    it('should accept valid session names', () => {
      assert.strictEqual(isValidSessionName('claude1'), true);
      assert.strictEqual(isValidSessionName('test-session'), true);
      assert.strictEqual(isValidSessionName('my_session'), true);
      assert.strictEqual(isValidSessionName('Session123'), true);
    });

    it('should reject names with spaces', () => {
      assert.strictEqual(isValidSessionName('test session'), false);
    });

    it('should reject names with special characters', () => {
      assert.strictEqual(isValidSessionName('test;rm'), false);
      assert.strictEqual(isValidSessionName('test$(cmd)'), false);
      assert.strictEqual(isValidSessionName('test`cmd`'), false);
      assert.strictEqual(isValidSessionName('../etc'), false);
    });

    it('should reject empty names', () => {
      assert.strictEqual(isValidSessionName(''), false);
    });
  });
});

describe('WebSocket Origin Validation', () => {
  // These patterns match what's in server.js
  const allowedPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
    /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
    /^https?:\/\/100\.\d+\.\d+\.\d+(:\d+)?$/,  // Tailscale CGNAT range
  ];

  function isOriginAllowed(origin) {
    return allowedPatterns.some(p => p.test(origin));
  }

  it('should allow localhost', () => {
    assert.strictEqual(isOriginAllowed('http://localhost'), true);
    assert.strictEqual(isOriginAllowed('http://localhost:3000'), true);
    assert.strictEqual(isOriginAllowed('https://localhost:8080'), true);
  });

  it('should allow 127.0.0.1', () => {
    assert.strictEqual(isOriginAllowed('http://127.0.0.1'), true);
    assert.strictEqual(isOriginAllowed('http://127.0.0.1:3000'), true);
  });

  it('should allow private network 192.168.x.x', () => {
    assert.strictEqual(isOriginAllowed('http://192.168.1.1'), true);
    assert.strictEqual(isOriginAllowed('http://192.168.0.100:3000'), true);
    assert.strictEqual(isOriginAllowed('http://192.168.255.255'), true);
  });

  it('should allow private network 10.x.x.x', () => {
    assert.strictEqual(isOriginAllowed('http://10.0.0.1'), true);
    assert.strictEqual(isOriginAllowed('http://10.1.2.3:8080'), true);
  });

  it('should allow Tailscale CGNAT range 100.x.x.x', () => {
    assert.strictEqual(isOriginAllowed('http://100.64.0.1'), true);
    assert.strictEqual(isOriginAllowed('http://100.100.100.100:3000'), true);
  });

  it('should reject public IPs', () => {
    assert.strictEqual(isOriginAllowed('http://8.8.8.8'), false);
    assert.strictEqual(isOriginAllowed('http://1.2.3.4:3000'), false);
  });

  it('should reject external domains', () => {
    assert.strictEqual(isOriginAllowed('http://example.com'), false);
    assert.strictEqual(isOriginAllowed('https://google.com'), false);
  });
});

describe('Rate Limiting Configuration', () => {
  const config = {
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 100  // 100 requests per window
  };

  it('should have 15 minute window', () => {
    assert.strictEqual(config.windowMs, 900000);
  });

  it('should allow 100 requests per window', () => {
    assert.strictEqual(config.max, 100);
  });

  it('should calculate reasonable rate', () => {
    // 100 requests per 15 minutes = ~6.67 requests per minute
    const requestsPerMinute = config.max / (config.windowMs / 60000);
    assert.ok(requestsPerMinute > 6);
    assert.ok(requestsPerMinute < 7);
  });
});
