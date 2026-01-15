#!/usr/bin/env node
/**
 * Test node-pty functionality
 */

const path = require('path');
const pty = require('node-pty');

const TMUX_PATH = process.env.TMUX_PATH || '/opt/homebrew/bin/tmux';

async function testBasicSpawn() {
  console.log('Test 1: Basic shell spawn');
  return new Promise((resolve, reject) => {
    try {
      const proc = pty.spawn('/bin/sh', ['-c', 'echo "hello from pty"'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24
      });

      let output = '';
      proc.onData(data => { output += data; });
      proc.onExit(({ exitCode }) => {
        if (output.includes('hello from pty')) {
          console.log('  ✓ Basic spawn works');
          resolve(true);
        } else {
          console.log('  ✗ Unexpected output:', output);
          resolve(false);
        }
      });

      setTimeout(() => {
        proc.kill();
        reject(new Error('Timeout'));
      }, 5000);
    } catch (err) {
      console.log('  ✗ Spawn failed:', err.message);
      resolve(false);
    }
  });
}

async function testTmuxExists() {
  console.log('Test 2: tmux binary exists');
  const fs = require('fs');
  try {
    fs.accessSync(TMUX_PATH, fs.constants.X_OK);
    console.log(`  ✓ tmux found at ${TMUX_PATH}`);
    return true;
  } catch {
    console.log(`  ✗ tmux not found at ${TMUX_PATH}`);
    return false;
  }
}

async function testTmuxListSessions() {
  console.log('Test 3: tmux list-sessions');
  return new Promise((resolve) => {
    try {
      const proc = pty.spawn(TMUX_PATH, ['list-sessions'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24
      });

      let output = '';
      proc.onData(data => { output += data; });
      proc.onExit(({ exitCode }) => {
        if (exitCode === 0 || output.includes('no server running') || output.includes('error connecting')) {
          console.log('  ✓ tmux list-sessions works (or no server)');
          console.log('    Sessions:', output.trim() || '(none)');
          resolve(true);
        } else {
          console.log('  ✗ tmux failed with code:', exitCode);
          resolve(false);
        }
      });

      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    } catch (err) {
      console.log('  ✗ Failed:', err.message);
      resolve(false);
    }
  });
}

async function testTmuxAttach() {
  console.log('Test 4: tmux attach (if session exists)');

  // First check if any session exists
  const { execSync } = require('child_process');
  let sessions = [];
  try {
    const out = execSync(`${TMUX_PATH} list-sessions -F "#{session_name}"`, { encoding: 'utf8' });
    sessions = out.trim().split('\n').filter(Boolean);
  } catch {
    console.log('  - Skipped: No tmux sessions');
    return true;
  }

  if (sessions.length === 0) {
    console.log('  - Skipped: No tmux sessions');
    return true;
  }

  const sessionName = sessions[0];
  console.log(`  Attaching to session: ${sessionName}`);

  return new Promise((resolve) => {
    try {
      const proc = pty.spawn(TMUX_PATH, ['attach', '-t', sessionName], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env
      });

      let gotOutput = false;
      proc.onData(data => {
        gotOutput = true;
      });

      setTimeout(() => {
        proc.kill();
        if (gotOutput) {
          console.log('  ✓ tmux attach works');
          resolve(true);
        } else {
          console.log('  ✗ No output from tmux attach');
          resolve(false);
        }
      }, 2000);
    } catch (err) {
      console.log('  ✗ Failed:', err.message);
      resolve(false);
    }
  });
}

async function runTests() {
  console.log('=== node-pty Test Suite ===\n');
  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform}-${process.arch}`);
  console.log(`CWD: ${process.cwd()}`);
  console.log('');

  const results = [];
  results.push(await testBasicSpawn());
  results.push(await testTmuxExists());
  results.push(await testTmuxListSessions());
  results.push(await testTmuxAttach());

  console.log('\n=== Results ===');
  const passed = results.filter(r => r).length;
  console.log(`${passed}/${results.length} tests passed`);

  process.exit(passed === results.length ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
