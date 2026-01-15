const { describe, it } = require('node:test');
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

  it('should detect Claude tool approval prompts', () => {
    assert.strictEqual(notifications.containsPrompt('Allow this action?'), true);
    assert.strictEqual(notifications.containsPrompt('Run this command?'), true);
    assert.strictEqual(notifications.containsPrompt('Proceed with the changes?'), true);
  });

  it('should detect selection prompts', () => {
    assert.strictEqual(notifications.containsPrompt('Select an option:'), true);
    assert.strictEqual(notifications.containsPrompt('Which file would you like to edit?'), true);
  });

  it('should detect permission prompts', () => {
    assert.strictEqual(notifications.containsPrompt('Permission to write file'), true);
    assert.strictEqual(notifications.containsPrompt('Can I create this directory?'), true);
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
