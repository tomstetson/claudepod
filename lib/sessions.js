/**
 * Session metadata management
 * Stores labels and other metadata for tmux sessions
 */
const fs = require('fs');
const path = require('path');

const SESSIONS_FILE = path.join(__dirname, '../.sessions.json');

/**
 * Load session metadata from disk
 */
function loadMeta() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('Failed to load session metadata:', err.message);
  }
  return {};
}

/**
 * Save session metadata to disk
 */
function saveMeta(meta) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(meta, null, 2));
  } catch (err) {
    console.error('Failed to save session metadata:', err.message);
  }
}

/**
 * Set a label for a session
 */
function setLabel(sessionName, label) {
  const meta = loadMeta();
  if (!meta[sessionName]) {
    meta[sessionName] = {};
  }
  meta[sessionName].label = label;
  meta[sessionName].updatedAt = new Date().toISOString();
  saveMeta(meta);
}

/**
 * Get the label for a session
 */
function getLabel(sessionName) {
  const meta = loadMeta();
  return meta[sessionName]?.label || null;
}

/**
 * Get all metadata for a session
 */
function getMeta(sessionName) {
  const meta = loadMeta();
  return meta[sessionName] || null;
}

/**
 * Get all session metadata
 */
function getAllMeta() {
  return loadMeta();
}

/**
 * Delete metadata for a session
 */
function deleteMeta(sessionName) {
  const meta = loadMeta();
  if (meta[sessionName]) {
    delete meta[sessionName];
    saveMeta(meta);
  }
}

/**
 * Clean up metadata for sessions that no longer exist
 */
function cleanup(existingSessions) {
  const meta = loadMeta();
  const existingNames = new Set(existingSessions.map(s => s.name));
  let changed = false;

  for (const name of Object.keys(meta)) {
    if (!existingNames.has(name)) {
      delete meta[name];
      changed = true;
    }
  }

  if (changed) {
    saveMeta(meta);
  }
}

module.exports = {
  setLabel,
  getLabel,
  getMeta,
  getAllMeta,
  deleteMeta,
  cleanup
};
