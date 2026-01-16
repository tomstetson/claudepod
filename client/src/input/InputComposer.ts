/**
 * InputComposer - Smart input handling for Claude Code
 *
 * Features:
 * - Slash command detection and autocomplete
 * - Multi-line input support
 * - iOS keyboard handling
 * - History navigation
 * - Draft persistence
 */

import { EventEmitter } from '../utils/EventEmitter';

interface InputComposerEvents {
  submit: string;
  input: string;
  slashCommand: string;
  cancel: void;
  historyUp: void;
  historyDown: void;
}

// Common Claude Code slash commands
const SLASH_COMMANDS = [
  { command: '/help', description: 'Show help' },
  { command: '/clear', description: 'Clear conversation' },
  { command: '/compact', description: 'Toggle compact mode' },
  { command: '/config', description: 'Configuration' },
  { command: '/cost', description: 'Show cost' },
  { command: '/doctor', description: 'Run diagnostics' },
  { command: '/init', description: 'Initialize project' },
  { command: '/login', description: 'Login to Anthropic' },
  { command: '/logout', description: 'Logout' },
  { command: '/memory', description: 'Memory management' },
  { command: '/permissions', description: 'Manage permissions' },
  { command: '/pr-comments', description: 'PR comments' },
  { command: '/review', description: 'Code review' },
  { command: '/status', description: 'Show status' },
  { command: '/terminal-setup', description: 'Terminal setup' },
  { command: '/vim', description: 'Vim mode' },
];

export class InputComposer extends EventEmitter<InputComposerEvents> {
  private element: HTMLTextAreaElement;
  private suggestionsEl: HTMLElement | null = null;
  private history: string[] = [];
  private historyIndex = -1;
  private maxHistory = 100;
  private currentDraft = '';

  // Slash command state
  private showingSuggestions = false;
  private filteredCommands: typeof SLASH_COMMANDS = [];
  private selectedSuggestion = 0;

  constructor(element: HTMLTextAreaElement) {
    super();
    this.element = element;
    this.setupEventListeners();
    this.loadHistory();
    this.createSuggestionsElement();
  }

  private setupEventListeners(): void {
    // Input event for text changes
    this.element.addEventListener('input', this.handleInput.bind(this));

    // Keydown for special keys
    this.element.addEventListener('keydown', this.handleKeyDown.bind(this));

    // Focus/blur
    this.element.addEventListener('focus', this.handleFocus.bind(this));
    this.element.addEventListener('blur', this.handleBlur.bind(this));
  }

  private handleInput(): void {
    const value = this.element.value;
    this.emit('input', value);

    // Check for slash command
    if (value.startsWith('/')) {
      this.showSlashSuggestions(value);
    } else {
      this.hideSuggestions();
    }

    // Auto-resize
    this.autoResize();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Handle suggestion navigation
    if (this.showingSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateSuggestion(1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateSuggestion(-1);
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (this.filteredCommands.length > 0) {
          e.preventDefault();
          this.selectSuggestion(this.selectedSuggestion);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.hideSuggestions();
        return;
      }
    }

    // Submit on Enter (without shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.submit();
      return;
    }

    // History navigation
    if (e.key === 'ArrowUp' && this.element.selectionStart === 0) {
      e.preventDefault();
      this.navigateHistory(-1);
      return;
    }
    if (e.key === 'ArrowDown' && this.element.selectionStart === this.element.value.length) {
      e.preventDefault();
      this.navigateHistory(1);
      return;
    }

    // Cancel
    if (e.key === 'Escape') {
      this.clear();
      this.emit('cancel');
      return;
    }
  }

  private handleFocus(): void {
    // Restore draft if any
    if (this.currentDraft && !this.element.value) {
      this.element.value = this.currentDraft;
      this.autoResize();
    }
  }

  private handleBlur(): void {
    // Save draft
    if (this.element.value) {
      this.currentDraft = this.element.value;
    }

    // Hide suggestions after delay (allow click)
    setTimeout(() => {
      this.hideSuggestions();
    }, 200);
  }

  /**
   * Submit the current input
   */
  submit(): void {
    const value = this.element.value.trim();
    if (!value) return;

    // Check for slash command
    if (value.startsWith('/')) {
      this.emit('slashCommand', value);
    } else {
      this.emit('submit', value);
    }

    // Add to history
    this.addToHistory(value);

    // Clear
    this.clear();
    this.currentDraft = '';
    this.historyIndex = -1;
  }

  /**
   * Clear the input
   */
  clear(): void {
    this.element.value = '';
    this.hideSuggestions();
    this.autoResize();
  }

  /**
   * Set input value
   */
  setValue(value: string): void {
    this.element.value = value;
    this.autoResize();

    // Check for slash command
    if (value.startsWith('/')) {
      this.showSlashSuggestions(value);
    }
  }

  /**
   * Get current value
   */
  getValue(): string {
    return this.element.value;
  }

  /**
   * Focus the input
   */
  focus(): void {
    this.element.focus();
  }

  /**
   * Blur the input
   */
  blur(): void {
    this.element.blur();
  }

  /**
   * Auto-resize textarea to fit content
   */
  private autoResize(): void {
    this.element.style.height = 'auto';
    const maxHeight = 120; // Max 3 lines roughly
    this.element.style.height = Math.min(this.element.scrollHeight, maxHeight) + 'px';
  }

  // Slash command suggestions

  private createSuggestionsElement(): void {
    this.suggestionsEl = document.createElement('div');
    this.suggestionsEl.className = 'slash-suggestions';
    this.suggestionsEl.style.cssText = `
      position: absolute;
      bottom: 100%;
      left: 0;
      right: 0;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      max-height: 200px;
      overflow-y: auto;
      display: none;
      z-index: 100;
    `;
    this.element.parentElement?.appendChild(this.suggestionsEl);
  }

  private showSlashSuggestions(input: string): void {
    const query = input.slice(1).toLowerCase();

    // Filter commands
    this.filteredCommands = SLASH_COMMANDS.filter(cmd =>
      cmd.command.slice(1).toLowerCase().startsWith(query)
    );

    if (this.filteredCommands.length === 0) {
      this.hideSuggestions();
      return;
    }

    // Reset selection
    this.selectedSuggestion = 0;
    this.showingSuggestions = true;

    // Render
    this.renderSuggestions();

    if (this.suggestionsEl) {
      this.suggestionsEl.style.display = 'block';
    }
  }

  private hideSuggestions(): void {
    this.showingSuggestions = false;
    this.filteredCommands = [];
    if (this.suggestionsEl) {
      this.suggestionsEl.style.display = 'none';
    }
  }

  private renderSuggestions(): void {
    if (!this.suggestionsEl) return;

    this.suggestionsEl.innerHTML = this.filteredCommands.map((cmd, i) => `
      <div
        class="slash-suggestion ${i === this.selectedSuggestion ? 'selected' : ''}"
        data-index="${i}"
        style="
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          ${i === this.selectedSuggestion ? 'background: #333;' : ''}
        "
      >
        <span style="font-family: monospace; color: #00aaff;">${cmd.command}</span>
        <span style="color: #888; font-size: 12px;">${cmd.description}</span>
      </div>
    `).join('');

    // Add click handlers
    this.suggestionsEl.querySelectorAll('.slash-suggestion').forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.getAttribute('data-index') || '0', 10);
        this.selectSuggestion(index);
      });
    });
  }

  private navigateSuggestion(delta: number): void {
    this.selectedSuggestion = Math.max(
      0,
      Math.min(this.filteredCommands.length - 1, this.selectedSuggestion + delta)
    );
    this.renderSuggestions();
  }

  private selectSuggestion(index: number): void {
    if (index < 0 || index >= this.filteredCommands.length) return;

    const cmd = this.filteredCommands[index];
    this.element.value = cmd.command + ' ';
    this.hideSuggestions();
    this.autoResize();
    this.element.focus();
  }

  // History

  private addToHistory(value: string): void {
    // Don't add duplicates of the last entry
    if (this.history[0] === value) return;

    this.history.unshift(value);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }
    this.saveHistory();
  }

  private navigateHistory(delta: number): void {
    const newIndex = this.historyIndex + delta;

    if (newIndex < -1) return;
    if (newIndex >= this.history.length) return;

    // Save current as draft when going into history
    if (this.historyIndex === -1 && delta > 0) {
      this.currentDraft = this.element.value;
    }

    this.historyIndex = newIndex;

    if (this.historyIndex === -1) {
      this.element.value = this.currentDraft;
    } else {
      this.element.value = this.history[this.historyIndex];
    }

    this.autoResize();

    // Move cursor to end
    this.element.selectionStart = this.element.value.length;
    this.element.selectionEnd = this.element.value.length;
  }

  private loadHistory(): void {
    try {
      const saved = localStorage.getItem('claudepod-input-history');
      if (saved) {
        this.history = JSON.parse(saved);
      }
    } catch {
      this.history = [];
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem('claudepod-input-history', JSON.stringify(this.history));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.suggestionsEl?.remove();
    this.removeAllListeners();
  }
}
