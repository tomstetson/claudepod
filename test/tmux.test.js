const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const tmux = require('../lib/tmux');

// Check if tmux is available
function isTmuxAvailable() {
  try {
    execSync('which tmux', { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const TMUX_AVAILABLE = isTmuxAvailable();

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

describe('tmux.nextSessionName', { skip: !TMUX_AVAILABLE && 'tmux not available' }, () => {
  it('should return claude followed by number', () => {
    const name = tmux.nextSessionName();
    assert.match(name, /^claude\d+$/);
  });
});

describe('tmux.sessionExists', { skip: !TMUX_AVAILABLE && 'tmux not available' }, () => {
  it('should return false for non-existent session', () => {
    const exists = tmux.sessionExists('definitely-not-a-real-session-12345');
    assert.strictEqual(exists, false);
  });
});

describe('tmux.listSessions', { skip: !TMUX_AVAILABLE && 'tmux not available' }, () => {
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
