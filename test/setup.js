/**
 * Test setup and utilities
 */
const { spawn, execSync } = require('child_process');
const http = require('http');

const TEST_PORT = 3099;
let serverProcess = null;

/**
 * Kill any process on the test port
 */
function cleanupPort() {
  try {
    // Try multiple methods to ensure port is free
    execSync(`lsof -ti:${TEST_PORT} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore' });
    // Also try fuser as backup
    execSync(`fuser -k ${TEST_PORT}/tcp 2>/dev/null || true`, { stdio: 'ignore' });
  } catch {
    // Port might already be free
  }
  // Give OS time to release the port
  try {
    execSync('sleep 0.5', { stdio: 'ignore' });
  } catch {
    // Ignore
  }
}

/**
 * Start the server for integration tests
 */
async function startServer() {
  cleanupPort();

  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['server.js'], {
      env: { ...process.env, PORT: TEST_PORT },
      stdio: 'pipe',
      cwd: process.cwd()
    });

    serverProcess.stdout.on('data', (data) => {
      if (data.toString().includes('ClaudePod running')) {
        resolve(`http://localhost:${TEST_PORT}`);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      // Ignore tmux "no server" messages
      if (!msg.includes('no server running')) {
        console.error('Server error:', msg);
      }
    });

    serverProcess.on('error', (err) => {
      reject(new Error(`Failed to start server: ${err.message}`));
    });

    setTimeout(() => reject(new Error('Server start timeout')), 15000);
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
