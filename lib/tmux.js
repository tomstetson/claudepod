const { execSync, exec } = require('child_process');

/**
 * List all tmux sessions
 * @returns {Array<{name: string, attached: boolean}>}
 */
function listSessions() {
  try {
    const output = execSync('tmux list-sessions -F "#{session_name}:#{session_attached}"', {
      encoding: 'utf8',
      timeout: 5000
    });

    return output.trim().split('\n').filter(Boolean).map(line => {
      const [name, attached] = line.split(':');
      return { name, attached: attached === '1' };
    });
  } catch (err) {
    // No tmux server running or no sessions
    if (err.message.includes('no server running') || err.message.includes('no sessions')) {
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
    execSync(`tmux has-session -t ${escapeSessionName(name)}`, {
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
 * @returns {string} The session name
 */
function createSession(name) {
  const sessionName = name || nextSessionName();

  if (sessionExists(sessionName)) {
    throw new Error(`Session "${sessionName}" already exists`);
  }

  // Create detached session running claude
  execSync(`tmux new-session -d -s ${escapeSessionName(sessionName)} 'claude'`, {
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
  execSync(`tmux kill-session -t ${escapeSessionName(name)}`, {
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
