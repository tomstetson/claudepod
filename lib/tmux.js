const { execSync, exec } = require('child_process');

// Full path to tmux (Homebrew on Apple Silicon)
const TMUX = process.env.TMUX_PATH || '/opt/homebrew/bin/tmux';

/**
 * List all tmux sessions
 * @returns {Array<{name: string, attached: boolean}>}
 */
function listSessions() {
  try {
    const output = execSync(`${TMUX} list-sessions -F "#{session_name}:#{session_attached}"`, {
      encoding: 'utf8',
      timeout: 5000
    });

    return output.trim().split('\n').filter(Boolean).map(line => {
      const [name, attached] = line.split(':');
      return { name, attached: attached === '1' };
    });
  } catch (err) {
    // No tmux server running or no sessions
    if (err.message.includes('no server running') ||
        err.message.includes('no sessions') ||
        err.message.includes('No such file or directory') ||
        err.message.includes('error connecting')) {
      return [];
    }
    throw err;
  }
}

/**
 * Check if a session exists
 * @param {string} name
 * @returns {boolean}
 */
function sessionExists(name) {
  try {
    execSync(`${TMUX} has-session -t ${escapeSessionName(name)}`, {
      encoding: 'utf8',
      timeout: 5000
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the next available session name (claude1, claude2, etc.)
 * @returns {string}
 */
function nextSessionName() {
  const sessions = listSessions();
  const existingNumbers = sessions
    .map(s => s.name.match(/^claude(\d+)$/))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10));

  let num = 1;
  while (existingNumbers.includes(num)) {
    num++;
  }
  return `claude${num}`;
}

/**
 * Create a new tmux session running Claude
 * @param {string} [name] - Session name, auto-generated if omitted
 * @param {string} [directory] - Directory path relative to PROJECTS_DIR
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.skipPermissions] - Run claude with --dangerously-skip-permissions
 * @returns {string} The session name
 */
function createSession(name, directory, options = {}) {
  const sessionName = name || nextSessionName();

  if (sessionExists(sessionName)) {
    throw new Error(`Session "${sessionName}" already exists`);
  }

  // Determine working directory
  const baseDir = process.env.CLAUDEPOD_PROJECTS_DIR || process.env.HOME;
  let workingDir = baseDir;

  if (directory) {
    const path = require('path');
    const fs = require('fs');

    // Strict sanitization - remove any path traversal attempts
    const cleanDir = directory
      .split(/[/\\]+/)
      .filter(segment => segment && segment !== '.' && segment !== '..')
      .join('/');

    const fullPath = path.resolve(baseDir, cleanDir);

    // Verify within base directory and exists
    if (fullPath.startsWith(path.resolve(baseDir)) && fs.existsSync(fullPath)) {
      workingDir = fullPath;
    }
  }

  // Build claude command with optional flags
  let claudeCmd = 'claude';
  if (options.skipPermissions) {
    claudeCmd = 'claude --dangerously-skip-permissions';
  }

  // Create detached session running claude
  execSync(`${TMUX} new-session -d -s ${escapeSessionName(sessionName)} -c "${workingDir}" '${claudeCmd}'`, {
    encoding: 'utf8',
    timeout: 10000
  });

  return sessionName;
}

/**
 * Kill a tmux session
 * @param {string} name
 */
function killSession(name) {
  execSync(`${TMUX} kill-session -t ${escapeSessionName(name)}`, {
    encoding: 'utf8',
    timeout: 5000
  });
}

/**
 * Escape session name for shell commands
 * @param {string} name
 * @returns {string}
 */
function escapeSessionName(name) {
  // Only allow alphanumeric, dash, underscore
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error('Invalid session name. Use only letters, numbers, dashes, and underscores.');
  }
  return name;
}

module.exports = {
  listSessions,
  sessionExists,
  nextSessionName,
  createSession,
  killSession,
  escapeSessionName
};
