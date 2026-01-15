# ClaudePod v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance ClaudePod with improved security, comprehensive testing, polished UI/UX, and full PWA capabilities.

**Architecture:** Modular Node.js backend with Express + WebSocket, security hardening via helmet and rate limiting, comprehensive test suite using Node's built-in test runner, and enhanced PWA features including offline support and install prompts.

**Tech Stack:** Node.js 20+, Express 4.x, ws, node-pty, helmet, express-rate-limit, Node test runner, Playwright (e2e)

---

## Phase 1: Security Hardening

### Task 1.1: Add Security Headers with Helmet

**Files:**
- Modify: `server.js:1-20`
- Modify: `package.json`

**Step 1: Add helmet dependency**

Run: `npm install helmet`

**Step 2: Add helmet import and middleware to server.js**

Add after line 1:
```javascript
const helmet = require('helmet');
```

Add after `const app = express();` (around line 15):
```javascript
// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      connectSrc: ["'self'", "ws:", "wss:"],
      imgSrc: ["'self'", "data:"],
    },
  },
}));
```

**Step 3: Verify server starts**

Run: `npm run dev`
Expected: Server starts without errors

**Step 4: Commit**

```bash
git add package.json package-lock.json server.js
git commit -m "feat: add helmet for security headers"
```

---

### Task 1.2: Add Rate Limiting

**Files:**
- Modify: `server.js:15-30`
- Modify: `package.json`

**Step 1: Add express-rate-limit dependency**

Run: `npm install express-rate-limit`

**Step 2: Add rate limiting to server.js**

Add import after helmet:
```javascript
const rateLimit = require('express-rate-limit');
```

Add after helmet middleware:
```javascript
// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);
```

**Step 3: Verify rate limiting works**

Run: `npm run dev`
Test: Make >100 requests quickly and verify 429 response

**Step 4: Commit**

```bash
git add package.json package-lock.json server.js
git commit -m "feat: add rate limiting to API endpoints"
```

---

### Task 1.3: Add WebSocket Origin Validation

**Files:**
- Modify: `server.js:107-130`

**Step 1: Add origin validation to WebSocket connection**

Modify the `wss.on('connection', ...)` handler. Add after `const sessionName = match[1];`:

```javascript
  // Validate origin (allow local network and Tailscale)
  const origin = req.headers.origin;
  const host = req.headers.host;

  // Allow connections from same host, localhost, or Tailscale IPs
  const allowedPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
    /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
    /^https?:\/\/100\.\d+\.\d+\.\d+(:\d+)?$/,  // Tailscale CGNAT range
  ];

  if (origin && !allowedPatterns.some(p => p.test(origin))) {
    console.warn(`Rejected WebSocket from origin: ${origin}`);
    ws.close(4003, 'Invalid origin');
    return;
  }
```

**Step 2: Test WebSocket connection still works**

Run: `npm run dev`
Test: Connect from browser on localhost

**Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add WebSocket origin validation"
```

---

### Task 1.4: Strengthen Directory Traversal Protection

**Files:**
- Modify: `server.js:49-93`
- Modify: `lib/tmux.js:82-94`

**Step 1: Improve sanitization in server.js /api/directories**

Replace the path sanitization logic:
```javascript
// API: List directories
app.get('/api/directories', (req, res) => {
  try {
    const relativePath = req.query.path || '';

    // Strict sanitization - remove any path traversal attempts
    const cleanPath = relativePath
      .split(/[/\\]+/)
      .filter(segment => segment && segment !== '.' && segment !== '..')
      .join('/');

    const fullPath = path.resolve(PROJECTS_DIR, cleanPath);

    // Double-check we're still within PROJECTS_DIR
    if (!fullPath.startsWith(path.resolve(PROJECTS_DIR))) {
      return res.status(403).json({ error: 'Access denied' });
    }
```

**Step 2: Improve sanitization in lib/tmux.js createSession**

Replace the directory handling:
```javascript
  if (directory) {
    // Strict sanitization
    const cleanDir = directory
      .split(/[/\\]+/)
      .filter(segment => segment && segment !== '.' && segment !== '..')
      .join('/');

    const fullPath = path.resolve(baseDir, cleanDir);

    // Verify within base directory
    if (fullPath.startsWith(path.resolve(baseDir)) && require('fs').existsSync(fullPath)) {
      workingDir = fullPath;
    }
  }
```

**Step 3: Test directory listing still works**

Run: `npm run dev`
Test: Browse directories via API

**Step 4: Commit**

```bash
git add server.js lib/tmux.js
git commit -m "fix: strengthen directory traversal protection"
```

---

### Task 1.5: Add Health Check Endpoint

**Files:**
- Modify: `server.js`

**Step 1: Add health endpoint before catch-all route**

Add before `app.get('*', ...)`:
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});
```

**Step 2: Verify endpoint works**

Run: `curl http://localhost:3000/health`
Expected: JSON with status "healthy"

**Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add health check endpoint"
```

---

## Phase 2: Testing Infrastructure

### Task 2.1: Set Up Test Framework

**Files:**
- Modify: `package.json`
- Create: `test/setup.js`

**Step 1: Update package.json test script**

Replace test script:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test test/**/*.test.js",
    "test:watch": "node --test --watch test/**/*.test.js",
    "test:pty": "node test/pty-test.js"
  }
}
```

**Step 2: Create test setup file**

Create `test/setup.js`:
```javascript
/**
 * Test setup and utilities
 */
const { spawn } = require('child_process');
const http = require('http');

const TEST_PORT = 3099;
let serverProcess = null;

/**
 * Start the server for integration tests
 */
async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], {
      env: { ...process.env, PORT: TEST_PORT },
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('ClaudePod running')) {
        resolve(`http://localhost:${TEST_PORT}`);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    setTimeout(() => reject(new Error('Server start timeout')), 10000);
  });
}

/**
 * Stop the test server
 */
function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

/**
 * Make HTTP request to test server
 */
async function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://localhost:${TEST_PORT}`);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data)
          });
        } catch {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

module.exports = {
  TEST_PORT,
  startServer,
  stopServer,
  request
};
```

**Step 3: Commit**

```bash
git add package.json test/setup.js
git commit -m "chore: set up Node.js test framework"
```

---

### Task 2.2: Add Unit Tests for tmux.js

**Files:**
- Create: `test/tmux.test.js`

**Step 1: Create tmux unit tests**

Create `test/tmux.test.js`:
```javascript
const { describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');
const tmux = require('../lib/tmux');

describe('tmux.escapeSessionName', () => {
  it('should accept valid session names', () => {
    assert.strictEqual(tmux.escapeSessionName('claude1'), 'claude1');
    assert.strictEqual(tmux.escapeSessionName('test-session'), 'test-session');
    assert.strictEqual(tmux.escapeSessionName('my_session_123'), 'my_session_123');
  });

  it('should reject invalid characters', () => {
    assert.throws(() => tmux.escapeSessionName('test session'), /Invalid session name/);
    assert.throws(() => tmux.escapeSessionName('test;rm -rf'), /Invalid session name/);
    assert.throws(() => tmux.escapeSessionName('../etc/passwd'), /Invalid session name/);
    assert.throws(() => tmux.escapeSessionName('test$(cmd)'), /Invalid session name/);
  });

  it('should reject empty names', () => {
    assert.throws(() => tmux.escapeSessionName(''), /Invalid session name/);
  });
});

describe('tmux.nextSessionName', () => {
  it('should return claude1 when no sessions exist', () => {
    // This test depends on actual tmux state
    // Will return claude1 if no claude sessions exist
    const name = tmux.nextSessionName();
    assert.match(name, /^claude\d+$/);
  });
});

describe('tmux.sessionExists', () => {
  it('should return false for non-existent session', () => {
    const exists = tmux.sessionExists('definitely-not-a-real-session-12345');
    assert.strictEqual(exists, false);
  });
});

describe('tmux.listSessions', () => {
  it('should return an array', () => {
    const sessions = tmux.listSessions();
    assert.ok(Array.isArray(sessions));
  });

  it('should have correct shape for each session', () => {
    const sessions = tmux.listSessions();
    for (const session of sessions) {
      assert.ok(typeof session.name === 'string');
      assert.ok(typeof session.attached === 'boolean');
    }
  });
});
```

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add test/tmux.test.js
git commit -m "test: add unit tests for tmux.js"
```

---

### Task 2.3: Add Unit Tests for notifications.js

**Files:**
- Create: `test/notifications.test.js`

**Step 1: Create notifications unit tests**

Create `test/notifications.test.js`:
```javascript
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const notifications = require('../lib/notifications');

describe('notifications.containsPrompt', () => {
  it('should detect [Y/n] prompts', () => {
    assert.strictEqual(notifications.containsPrompt('Continue? [Y/n]'), true);
    assert.strictEqual(notifications.containsPrompt('Proceed [y/N]'), true);
  });

  it('should detect question mark prompts', () => {
    assert.strictEqual(notifications.containsPrompt('What should I do? '), true);
  });

  it('should detect common Claude prompts', () => {
    assert.strictEqual(notifications.containsPrompt('Do you want to proceed with this change?'), true);
    assert.strictEqual(notifications.containsPrompt('Would you like me to continue?'), true);
    assert.strictEqual(notifications.containsPrompt('Should I apply the fix?'), true);
  });

  it('should not detect regular output', () => {
    assert.strictEqual(notifications.containsPrompt('Building project...'), false);
    assert.strictEqual(notifications.containsPrompt('Compiling 42 files'), false);
    assert.strictEqual(notifications.containsPrompt('Done!'), false);
  });

  it('should detect Press Enter prompts', () => {
    assert.strictEqual(notifications.containsPrompt('Press Enter to continue'), true);
  });
});

describe('notifications.clearDebounce', () => {
  it('should not throw for non-existent session', () => {
    assert.doesNotThrow(() => {
      notifications.clearDebounce('non-existent-session');
    });
  });
});

describe('notifications.checkAndNotify', () => {
  it('should return false when session is active', async () => {
    const result = await notifications.checkAndNotify('test', 'Continue? [Y/n]', true);
    assert.strictEqual(result, false);
  });

  it('should return false when no prompt detected', async () => {
    const result = await notifications.checkAndNotify('test', 'Building...', false);
    assert.strictEqual(result, false);
  });
});
```

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add test/notifications.test.js
git commit -m "test: add unit tests for notifications.js"
```

---

### Task 2.4: Add API Integration Tests

**Files:**
- Create: `test/api.test.js`

**Step 1: Create API integration tests**

Create `test/api.test.js`:
```javascript
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
      // Should either return 403 or sanitize to safe path
      assert.ok(res.status === 403 || res.body.current === '/');
    });
  });

  describe('POST /api/sessions', () => {
    it('should reject invalid session names', async () => {
      const res = await request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { name: 'invalid;session' }
      });
      assert.strictEqual(res.status, 400);
    });
  });
});
```

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass (may skip some based on server state)

**Step 3: Commit**

```bash
git add test/api.test.js
git commit -m "test: add API integration tests"
```

---

## Phase 3: Complete Directory Browser

### Task 3.1: Add Directory Browser JavaScript

**Files:**
- Modify: `public/app.js`

**Step 1: Add directory browser state and methods**

Add after `this.resizeTimeout = null;` in constructor:
```javascript
    this.currentDirPath = '';
```

Add method `setupDirModal()` after `setupModal()`:
```javascript
  setupDirModal() {
    const modal = document.getElementById('dir-modal');
    const cancelBtn = document.getElementById('dir-cancel');
    const selectBtn = document.getElementById('dir-select');
    const dirList = document.getElementById('dir-list');

    cancelBtn.addEventListener('click', () => this.hideDirModal());
    selectBtn.addEventListener('click', () => this.createSessionInDir());

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hideDirModal();
      }
    });

    // Handle directory clicks via delegation
    dirList.addEventListener('click', (e) => {
      const item = e.target.closest('.dir-item');
      if (!item) return;

      const path = item.dataset.path;
      if (path === '..') {
        this.loadDirectories(this.currentDirPath.split('/').slice(0, -1).join('/'));
      } else if (path !== undefined) {
        this.loadDirectories(path);
      }
    });
  }

  showDirModal() {
    const modal = document.getElementById('dir-modal');
    modal.classList.add('visible');
    this.loadDirectories('');
  }

  hideDirModal() {
    const modal = document.getElementById('dir-modal');
    modal.classList.remove('visible');
  }

  async loadDirectories(path) {
    const dirList = document.getElementById('dir-list');
    const pathDisplay = document.getElementById('dir-current-path');

    dirList.innerHTML = '<div class="dir-loading">Loading...</div>';

    try {
      const response = await fetch(`/api/directories?path=${encodeURIComponent(path)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load directories');
      }

      this.currentDirPath = data.current === '/' ? '' : data.current;
      pathDisplay.textContent = data.base + (data.current === '/' ? '' : '/' + data.current);

      this.renderDirectories(data);
    } catch (err) {
      dirList.innerHTML = `<div class="dir-empty">Error: ${err.message}</div>`;
    }
  }

  renderDirectories(data) {
    const dirList = document.getElementById('dir-list');

    let html = '';

    // Parent directory link
    if (data.parent !== null) {
      html += `
        <div class="dir-item dir-item-back" data-path="..">
          <span class="dir-item-icon">&#8592;</span>
          <span class="dir-item-name">..</span>
        </div>
      `;
    }

    // Directory entries
    if (data.directories.length === 0 && data.parent === null) {
      html += '<div class="dir-empty">No subdirectories</div>';
    } else {
      for (const dir of data.directories) {
        html += `
          <div class="dir-item" data-path="${dir.path}">
            <span class="dir-item-icon">&#128193;</span>
            <span class="dir-item-name">${dir.name}</span>
          </div>
        `;
      }
    }

    dirList.innerHTML = html;
  }

  async createSessionInDir() {
    this.hideDirModal();

    try {
      this.showStatus('Creating session...', 'info');

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: this.currentDirPath })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create session');
      }

      const data = await response.json();
      this.showStatus(`Created ${data.name}`, 'success');

      await this.loadSessions();
      this.connectToSession(data.name);
    } catch (err) {
      console.error('Failed to create session:', err);
      this.showStatus(err.message, 'error');
    }
  }
```

**Step 2: Update init() to call setupDirModal()**

Modify `init()` to add after `this.setupModal();`:
```javascript
    this.setupDirModal();
```

**Step 3: Update createNewSession() to show directory browser**

Replace `createNewSession()` method:
```javascript
  async createNewSession() {
    this.showDirModal();
  }
```

**Step 4: Verify directory browser works**

Run: `npm run dev`
Test: Click "+ New" and browse directories

**Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: complete directory browser for session creation"
```

---

## Phase 4: UI/UX Enhancements

### Task 4.1: Add Loading States

**Files:**
- Modify: `public/style.css`
- Modify: `public/app.js`

**Step 1: Add loading spinner CSS**

Add to style.css before utilities section:
```css
/* ============ LOADING STATES ============ */
.btn-loading {
  position: relative;
  color: transparent !important;
  pointer-events: none;
}

.btn-loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  top: 50%;
  left: 50%;
  margin: -8px 0 0 -8px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.action-btn.loading {
  opacity: 0.6;
  pointer-events: none;
}
```

**Step 2: Add setLoading helper to app.js**

Add method after `showStatus()`:
```javascript
  setButtonLoading(btn, loading) {
    if (loading) {
      btn.classList.add('btn-loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('btn-loading');
      btn.disabled = false;
    }
  }
```

**Step 3: Commit**

```bash
git add public/style.css public/app.js
git commit -m "feat: add loading states for buttons"
```

---

### Task 4.2: Add Connection Status Indicator

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

**Step 1: Add status indicator to HTML header**

Add after the logo span in index.html:
```html
        <span id="connection-status" class="connection-status" title="Disconnected">
          <span class="status-dot"></span>
        </span>
```

**Step 2: Add CSS for connection status**

Add to style.css after header styles:
```css
/* Connection status indicator */
.connection-status {
  display: flex;
  align-items: center;
  padding: 4px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: background 0.3s ease;
}

.connection-status.connected .status-dot {
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
}

.connection-status.connecting .status-dot {
  background: var(--warning);
  animation: pulse 1s ease-in-out infinite;
}

.connection-status.error .status-dot {
  background: var(--error);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
```

**Step 3: Add status update methods to app.js**

Add method:
```javascript
  setConnectionStatus(status) {
    const indicator = document.getElementById('connection-status');
    indicator.className = 'connection-status ' + status;
    indicator.title = status.charAt(0).toUpperCase() + status.slice(1);
  }
```

Update `connectToSession()` socket handlers:
- In `socket.onopen`: add `this.setConnectionStatus('connected');`
- In `socket.onclose`: add `this.setConnectionStatus('disconnected');`
- In `socket.onerror`: add `this.setConnectionStatus('error');`
- Before creating socket: add `this.setConnectionStatus('connecting');`

**Step 4: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: add connection status indicator"
```

---

### Task 4.3: Add Keyboard Shortcuts

**Files:**
- Modify: `public/app.js`

**Step 1: Add keyboard shortcuts handler**

Add in `setupEventListeners()`:
```javascript
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only handle when terminal is focused or no input is focused
      const activeEl = document.activeElement;
      const isInputFocused = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT';

      if (isInputFocused) return;

      // Ctrl/Cmd + Shift + N: New session
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        this.createNewSession();
      }

      // Ctrl/Cmd + Shift + K: Kill session
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        this.showKillModal();
      }
    });
```

**Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: add keyboard shortcuts for session management"
```

---

### Task 4.4: Add Session Auto-Refresh

**Files:**
- Modify: `public/app.js`

**Step 1: Add periodic session refresh**

Add in constructor:
```javascript
    this.refreshInterval = null;
```

Add method:
```javascript
  startSessionRefresh() {
    // Refresh session list every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadSessions();
    }, 30000);
  }

  stopSessionRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
```

Call in `init()` after `loadSessions()`:
```javascript
    this.startSessionRefresh();
```

Add visibility handling to refresh when returning to app:
```javascript
    // In setupEventListeners or existing visibilitychange handler
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.loadSessions(); // Refresh immediately when returning
      }
    });
```

**Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: add automatic session list refresh"
```

---

## Phase 5: PWA Enhancements

### Task 5.1: Add Install Prompt Handling

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

**Step 1: Add install button to HTML**

Add after the new session button:
```html
        <button id="install-btn" class="btn btn-ghost" style="display: none;" aria-label="Install app">Install</button>
```

**Step 2: Add install handling to app.js**

Add in constructor:
```javascript
    this.deferredPrompt = null;
```

Add in `init()`:
```javascript
    this.setupInstallPrompt();
```

Add method:
```javascript
  setupInstallPrompt() {
    const installBtn = document.getElementById('install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      installBtn.style.display = 'inline-flex';
    });

    installBtn.addEventListener('click', async () => {
      if (!this.deferredPrompt) return;

      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        this.showStatus('App installed!', 'success');
      }

      this.deferredPrompt = null;
      installBtn.style.display = 'none';
    });

    window.addEventListener('appinstalled', () => {
      this.showStatus('ClaudePod installed!', 'success');
      installBtn.style.display = 'none';
    });
  }
```

**Step 3: Commit**

```bash
git add public/index.html public/app.js
git commit -m "feat: add PWA install prompt handling"
```

---

### Task 5.2: Update Service Worker Cache Version

**Files:**
- Modify: `public/sw.js`

**Step 1: Bump cache version and add version tracking**

Update sw.js:
```javascript
// ClaudePod Service Worker v2
const CACHE_VERSION = 2;
const CACHE_NAME = `claudepod-v${CACHE_VERSION}`;
```

**Step 2: Add Google Fonts to CDN cache**

Add to CDN_ASSETS:
```javascript
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css',
  'https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js',
  'https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js',
  'https://cdn.jsdelivr.net/npm/xterm-addon-web-links@0.9.0/lib/xterm-addon-web-links.min.js',
  'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap'
];
```

**Step 3: Commit**

```bash
git add public/sw.js
git commit -m "chore: update service worker cache version"
```

---

### Task 5.3: Add Offline Indicator

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

**Step 1: Add offline banner to HTML**

Add after the header:
```html
    <!-- Offline banner -->
    <div id="offline-banner" class="offline-banner" role="alert">
      You're offline. Some features may be unavailable.
    </div>
```

**Step 2: Add CSS for offline banner**

Add to style.css:
```css
/* Offline banner */
.offline-banner {
  display: none;
  padding: 8px 16px;
  background: var(--warning);
  color: #000;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
}

.offline-banner.visible {
  display: block;
}
```

**Step 3: Add offline detection to app.js**

Add in `init()`:
```javascript
    this.setupOfflineDetection();
```

Add method:
```javascript
  setupOfflineDetection() {
    const banner = document.getElementById('offline-banner');

    const updateOnlineStatus = () => {
      if (navigator.onLine) {
        banner.classList.remove('visible');
      } else {
        banner.classList.add('visible');
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  }
```

**Step 4: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: add offline indicator banner"
```

---

## Phase 6: Final Cleanup

### Task 6.1: Remove Unused Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Remove sharp (icons already generated)**

Run: `npm uninstall sharp`

**Step 2: Verify app still works**

Run: `npm run dev`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused sharp dependency"
```

---

### Task 6.2: Add Graceful Shutdown

**Files:**
- Modify: `server.js`

**Step 1: Add shutdown handlers at end of server.js**

Add before `server.listen()`:
```javascript
// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Close WebSocket connections
  wss.clients.forEach(client => {
    client.close(1001, 'Server shutting down');
  });

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

**Step 2: Commit**

```bash
git add server.js
git commit -m "feat: add graceful shutdown handling"
```

---

### Task 6.3: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_MAP.md`

**Step 1: Update README with new features**

Add to README.md features section:
- Security headers with helmet
- Rate limiting
- WebSocket origin validation
- Health check endpoint
- Directory browser for session creation
- Connection status indicator
- Keyboard shortcuts
- PWA install prompt
- Offline indicator

**Step 2: Update PROJECT_MAP.md**

Update the features checklist with all new features.

**Step 3: Commit**

```bash
git add README.md PROJECT_MAP.md
git commit -m "docs: update documentation for v2 features"
```

---

### Task 6.4: Push to GitHub

**Step 1: Ensure all changes are committed**

Run: `git status`
Expected: Clean working directory

**Step 2: Push to remote**

Run: `git push origin main`

---

## Summary

This plan covers:

1. **Security (5 tasks):** Helmet, rate limiting, WebSocket origin validation, path traversal hardening, health endpoint
2. **Testing (4 tasks):** Test framework setup, tmux tests, notifications tests, API tests
3. **Directory Browser (1 task):** Complete the JavaScript implementation
4. **UI/UX (4 tasks):** Loading states, connection indicator, keyboard shortcuts, auto-refresh
5. **PWA (3 tasks):** Install prompt, cache update, offline indicator
6. **Cleanup (4 tasks):** Remove unused deps, graceful shutdown, docs, push

Total: 21 bite-sized tasks following TDD principles with frequent commits.
