const PUSHOVER_URL = 'https://api.pushover.net/1/messages.json';

// Patterns that indicate Claude is waiting for input
const PROMPT_PATTERNS = [
  // Yes/No prompts
  /\[Y\/n\]/i,
  /\[y\/N\]/i,
  /\[yes\/no\]/i,
  /\(y\/n\)/i,

  // Question patterns
  /\? $/,
  /Do you want to proceed/i,
  /Would you like/i,
  /Should I /i,
  /Can I /i,
  /May I /i,

  // Action prompts
  /Press Enter/i,
  /waiting for input/i,
  /Type .* to continue/i,

  // Claude-specific prompts
  /Allow this action/i,
  /Approve this/i,
  /Run this command/i,
  /Execute this/i,
  /Create this file/i,
  /Edit this file/i,
  /Delete this/i,
  /Proceed with/i,

  // Tool approval patterns
  /Allow .* tool/i,
  /Permission to/i,
  /Grant access/i,

  // Plan mode
  /Ready for plan/i,
  /Approve plan/i,
  /Review the plan/i,

  // Selection prompts
  /Select an option/i,
  /Choose .* option/i,
  /Pick one/i,
  /Which .* would you/i,
];

// Debounce notifications per session
const lastNotification = new Map();
const DEBOUNCE_MS = 30000; // 30 seconds between notifications per session

/**
 * Check if text contains a prompt pattern
 * @param {string} text
 * @returns {boolean}
 */
function containsPrompt(text) {
  return PROMPT_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Send a Pushover notification
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
async function sendNotification(title, message) {
  const appToken = process.env.PUSHOVER_APP_TOKEN;
  const userKey = process.env.PUSHOVER_USER_KEY;

  if (!appToken || !userKey) {
    // Pushover not configured, skip silently
    return false;
  }

  try {
    const response = await fetch(PUSHOVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: appToken,
        user: userKey,
        title,
        message,
        sound: 'pushover',
        priority: 0
      })
    });

    return response.ok;
  } catch (err) {
    console.error('Pushover notification failed:', err.message);
    return false;
  }
}

/**
 * Check terminal output and send notification if prompt detected
 * @param {string} sessionName
 * @param {string} output
 * @param {boolean} isActive - Whether this session is currently being viewed
 * @returns {Promise<boolean>}
 */
async function checkAndNotify(sessionName, output, isActive) {
  // Don't notify if session is being actively viewed
  if (isActive) {
    return false;
  }

  // Check if output contains a prompt
  if (!containsPrompt(output)) {
    return false;
  }

  // Debounce notifications
  const lastTime = lastNotification.get(sessionName) || 0;
  const now = Date.now();
  if (now - lastTime < DEBOUNCE_MS) {
    return false;
  }

  lastNotification.set(sessionName, now);

  return sendNotification(
    `ClaudePod: ${sessionName}`,
    'Claude is waiting for input'
  );
}

/**
 * Clear debounce timer for a session (e.g., when user views it)
 * @param {string} sessionName
 */
function clearDebounce(sessionName) {
  lastNotification.delete(sessionName);
}

module.exports = {
  containsPrompt,
  sendNotification,
  checkAndNotify,
  clearDebounce,
  PROMPT_PATTERNS
};
