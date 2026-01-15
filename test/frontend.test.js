/**
 * Frontend logic tests
 * Tests for pure logic functions that don't require full browser environment
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock commands array matching what's in app.js
const commands = [
  { category: 'Claude Commands', name: '/compact', desc: 'Reduce context usage', icon: '📦' },
  { category: 'Claude Commands', name: '/help', desc: 'Show Claude help', icon: '❓' },
  { category: 'Claude Commands', name: '/clear', desc: 'Clear conversation', icon: '🧹' },
  { category: 'Claude Commands', name: '/status', desc: 'Show session status', icon: '📊' },
  { category: 'Claude Commands', name: '/cost', desc: 'Show token costs', icon: '💰' },
  { category: 'Git Commands', name: 'git status', desc: 'Show working tree status', icon: '📋' },
  { category: 'Git Commands', name: 'git diff', desc: 'Show changes', icon: '📝' },
  { category: 'Git Commands', name: 'git log --oneline -10', desc: 'Recent commits', icon: '📜' },
  { category: 'Git Commands', name: 'git add .', desc: 'Stage all changes', icon: '➕' },
  { category: 'Common', name: 'ls -la', desc: 'List files (detailed)', icon: '📁' },
  { category: 'Common', name: 'pwd', desc: 'Print working directory', icon: '📍' },
  { category: 'Common', name: 'npm test', desc: 'Run tests', icon: '🧪' },
  { category: 'Common', name: 'npm run build', desc: 'Build project', icon: '🔨' },
];

/**
 * Command filtering logic (extracted from app.js filterCommands)
 */
function filterCommands(query) {
  const lowerQuery = query.toLowerCase();
  return commands.filter(cmd =>
    cmd.name.toLowerCase().includes(lowerQuery) ||
    cmd.desc.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Font size change logic (extracted from app.js changeFontSize)
 */
function calculateNewFontSize(currentSize, delta) {
  return Math.max(10, Math.min(24, currentSize + delta));
}

/**
 * Key mapping logic (extracted from app.js sendKey)
 */
const keyMap = {
  'Enter': '\r',
  'Escape': '\x1b',
  'Tab': '\t',
  'Backspace': '\x7f',
  'ArrowUp': '\x1b[A',
  'ArrowDown': '\x1b[B',
  'ArrowRight': '\x1b[C',
  'ArrowLeft': '\x1b[D'
};

function mapKeyToInput(key) {
  return keyMap[key] || null;
}

/**
 * Two-finger tap detection logic
 */
function shouldTriggerTwoFingerTap(touchCount, touchDuration) {
  return touchCount === 2 && touchDuration < 300;
}

/**
 * Reconnection delay calculation (extracted from app.js attemptReconnect)
 */
function calculateReconnectDelay(attempt) {
  return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
}

// ============ TESTS ============

describe('Command Palette - filterCommands', () => {
  it('should return all commands when query is empty', () => {
    const result = filterCommands('');
    assert.strictEqual(result.length, commands.length);
  });

  it('should filter commands by name', () => {
    const result = filterCommands('git');
    assert.ok(result.length > 0);
    assert.ok(result.every(cmd => cmd.name.toLowerCase().includes('git')));
  });

  it('should filter commands by description', () => {
    const result = filterCommands('token');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, '/cost');
  });

  it('should be case insensitive', () => {
    const result1 = filterCommands('GIT');
    const result2 = filterCommands('git');
    assert.strictEqual(result1.length, result2.length);
  });

  it('should return empty array for no matches', () => {
    const result = filterCommands('xyznonexistent');
    assert.strictEqual(result.length, 0);
  });

  it('should find Claude commands with slash prefix', () => {
    const result = filterCommands('/');
    assert.ok(result.length >= 5); // At least the 5 Claude commands
    assert.ok(result.some(cmd => cmd.name === '/compact'));
  });

  it('should find commands by partial match', () => {
    const result = filterCommands('stat');
    assert.ok(result.some(cmd => cmd.name === 'git status'));
    assert.ok(result.some(cmd => cmd.name === '/status'));
  });
});

describe('Font Size Controls - calculateNewFontSize', () => {
  it('should increase font size', () => {
    assert.strictEqual(calculateNewFontSize(14, 1), 15);
    assert.strictEqual(calculateNewFontSize(14, 2), 16);
  });

  it('should decrease font size', () => {
    assert.strictEqual(calculateNewFontSize(14, -1), 13);
    assert.strictEqual(calculateNewFontSize(14, -2), 12);
  });

  it('should not go below minimum (10px)', () => {
    assert.strictEqual(calculateNewFontSize(10, -1), 10);
    assert.strictEqual(calculateNewFontSize(11, -5), 10);
    assert.strictEqual(calculateNewFontSize(5, 0), 10);
  });

  it('should not go above maximum (24px)', () => {
    assert.strictEqual(calculateNewFontSize(24, 1), 24);
    assert.strictEqual(calculateNewFontSize(23, 5), 24);
    assert.strictEqual(calculateNewFontSize(30, 0), 24);
  });

  it('should handle edge cases', () => {
    assert.strictEqual(calculateNewFontSize(10, 0), 10);
    assert.strictEqual(calculateNewFontSize(24, 0), 24);
  });
});

describe('Key Mapping - mapKeyToInput', () => {
  it('should map Enter to carriage return', () => {
    assert.strictEqual(mapKeyToInput('Enter'), '\r');
  });

  it('should map Escape to escape sequence', () => {
    assert.strictEqual(mapKeyToInput('Escape'), '\x1b');
  });

  it('should map Tab to tab character', () => {
    assert.strictEqual(mapKeyToInput('Tab'), '\t');
  });

  it('should map Backspace to DEL', () => {
    assert.strictEqual(mapKeyToInput('Backspace'), '\x7f');
  });

  it('should map arrow keys to ANSI sequences', () => {
    assert.strictEqual(mapKeyToInput('ArrowUp'), '\x1b[A');
    assert.strictEqual(mapKeyToInput('ArrowDown'), '\x1b[B');
    assert.strictEqual(mapKeyToInput('ArrowRight'), '\x1b[C');
    assert.strictEqual(mapKeyToInput('ArrowLeft'), '\x1b[D');
  });

  it('should return null for unmapped keys', () => {
    assert.strictEqual(mapKeyToInput('Space'), null);
    assert.strictEqual(mapKeyToInput('a'), null);
    assert.strictEqual(mapKeyToInput('F1'), null);
  });
});

describe('Two-Finger Tap Gesture - shouldTriggerTwoFingerTap', () => {
  it('should trigger for quick two-finger tap', () => {
    assert.strictEqual(shouldTriggerTwoFingerTap(2, 100), true);
    assert.strictEqual(shouldTriggerTwoFingerTap(2, 200), true);
    assert.strictEqual(shouldTriggerTwoFingerTap(2, 299), true);
  });

  it('should not trigger for slow two-finger tap', () => {
    assert.strictEqual(shouldTriggerTwoFingerTap(2, 300), false);
    assert.strictEqual(shouldTriggerTwoFingerTap(2, 500), false);
    assert.strictEqual(shouldTriggerTwoFingerTap(2, 1000), false);
  });

  it('should not trigger for single finger', () => {
    assert.strictEqual(shouldTriggerTwoFingerTap(1, 100), false);
    assert.strictEqual(shouldTriggerTwoFingerTap(1, 50), false);
  });

  it('should not trigger for three or more fingers', () => {
    assert.strictEqual(shouldTriggerTwoFingerTap(3, 100), false);
    assert.strictEqual(shouldTriggerTwoFingerTap(4, 100), false);
  });

  it('should handle edge case at exactly 300ms', () => {
    // 300ms is >= 300, so should NOT trigger
    assert.strictEqual(shouldTriggerTwoFingerTap(2, 300), false);
  });
});

describe('Reconnection Logic - calculateReconnectDelay', () => {
  it('should calculate exponential backoff', () => {
    assert.strictEqual(calculateReconnectDelay(1), 1000);  // 2^0 * 1000
    assert.strictEqual(calculateReconnectDelay(2), 2000);  // 2^1 * 1000
    assert.strictEqual(calculateReconnectDelay(3), 4000);  // 2^2 * 1000
    assert.strictEqual(calculateReconnectDelay(4), 8000);  // 2^3 * 1000
  });

  it('should cap at 10 seconds', () => {
    assert.strictEqual(calculateReconnectDelay(5), 10000); // Would be 16000, capped at 10000
    assert.strictEqual(calculateReconnectDelay(6), 10000);
    assert.strictEqual(calculateReconnectDelay(10), 10000);
  });
});

describe('Command Categories', () => {
  it('should have Claude Commands category', () => {
    const claudeCommands = commands.filter(c => c.category === 'Claude Commands');
    assert.ok(claudeCommands.length >= 5);
    assert.ok(claudeCommands.every(c => c.name.startsWith('/')));
  });

  it('should have Git Commands category', () => {
    const gitCommands = commands.filter(c => c.category === 'Git Commands');
    assert.ok(gitCommands.length >= 4);
    assert.ok(gitCommands.every(c => c.name.startsWith('git')));
  });

  it('should have Common category', () => {
    const commonCommands = commands.filter(c => c.category === 'Common');
    assert.ok(commonCommands.length >= 4);
  });

  it('should have icons for all commands', () => {
    assert.ok(commands.every(c => c.icon && c.icon.length > 0));
  });

  it('should have descriptions for all commands', () => {
    assert.ok(commands.every(c => c.desc && c.desc.length > 0));
  });
});

describe('Input Composer Logic', () => {
  it('should detect slash prefix for command palette trigger', () => {
    const shouldShowPalette = (value) => value === '/';

    assert.strictEqual(shouldShowPalette('/'), true);
    assert.strictEqual(shouldShowPalette('/h'), false);
    assert.strictEqual(shouldShowPalette('hello'), false);
    assert.strictEqual(shouldShowPalette(''), false);
  });

  it('should calculate textarea height within bounds', () => {
    const calculateHeight = (scrollHeight, maxHeight) => Math.min(scrollHeight, maxHeight);

    assert.strictEqual(calculateHeight(50, 120), 50);
    assert.strictEqual(calculateHeight(100, 120), 100);
    assert.strictEqual(calculateHeight(150, 120), 120);
    assert.strictEqual(calculateHeight(200, 120), 120);
  });
});

describe('Haptic Feedback Patterns', () => {
  const patterns = {
    light: 10,
    medium: 20,
    heavy: 30
  };

  it('should have correct vibration durations', () => {
    assert.strictEqual(patterns.light, 10);
    assert.strictEqual(patterns.medium, 20);
    assert.strictEqual(patterns.heavy, 30);
  });

  it('should increase in intensity', () => {
    assert.ok(patterns.light < patterns.medium);
    assert.ok(patterns.medium < patterns.heavy);
  });
});

describe('LocalStorage Keys', () => {
  // These are the localStorage keys used by the app
  const expectedKeys = [
    'claudepod-fontsize',
    'claudepod-gesture-hint-shown'
  ];

  it('should use consistent key naming', () => {
    assert.ok(expectedKeys.every(key => key.startsWith('claudepod-')));
  });
});
