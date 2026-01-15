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
      stdio: 'pipe',
      cwd: process.cwd()
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
