/**
 * QuickActions - Adaptive action buttons for Claude Code interaction
 *
 * Shows contextual buttons based on:
 * - Current Claude Code prompt type (Y/N, choices, etc.)
 * - Terminal activity state
 * - User preferences
 */

import { EventEmitter } from '../utils/EventEmitter';
import { ClaudePrompt, ClaudeActivity } from '../session/ClaudeCodeDetector';

export interface QuickAction {
  id: string;
  label: string;
  input: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'danger';
  visible?: boolean;
}

interface QuickActionsEvents {
  action: { id: string; input: string };
}

// Default actions when no prompt detected
const DEFAULT_ACTIONS: QuickAction[] = [
  { id: 'enter', label: '↵', input: '\r', variant: 'primary' },
  { id: 'esc', label: 'Esc', input: '\x1b' },
  { id: 'ctrl-c', label: '^C', input: '\x03', variant: 'danger' },
  { id: 'tab', label: 'Tab', input: '\t' },
  { id: 'up', label: '↑', input: '\x1b[A' },
  { id: 'down', label: '↓', input: '\x1b[B' },
];

// Yes/No prompt actions
const YES_NO_ACTIONS: QuickAction[] = [
  { id: 'yes', label: 'Yes', input: 'y\n', variant: 'primary' },
  { id: 'no', label: 'No', input: 'n\n' },
  { id: 'esc', label: 'Esc', input: '\x1b' },
  { id: 'ctrl-c', label: '^C', input: '\x03', variant: 'danger' },
];

// Tool approval actions
const TOOL_APPROVAL_ACTIONS: QuickAction[] = [
  { id: 'allow', label: 'Allow', input: 'y\n', variant: 'primary' },
  { id: 'deny', label: 'Deny', input: 'n\n' },
  { id: 'allow-all', label: 'All', input: 'a\n' },
  { id: 'esc', label: 'Esc', input: '\x1b' },
  { id: 'ctrl-c', label: '^C', input: '\x03', variant: 'danger' },
];

// Navigation actions for menus (reserved for future use)
const _MENU_ACTIONS: QuickAction[] = [
  { id: 'up', label: '↑', input: '\x1b[A' },
  { id: 'down', label: '↓', input: '\x1b[B' },
  { id: 'enter', label: '↵', input: '\r', variant: 'primary' },
  { id: 'esc', label: 'Esc', input: '\x1b' },
  { id: 'ctrl-c', label: '^C', input: '\x03', variant: 'danger' },
];
void _MENU_ACTIONS; // Suppress unused warning

export class QuickActions extends EventEmitter<QuickActionsEvents> {
  private container: HTMLElement;
  private actions: QuickAction[] = DEFAULT_ACTIONS;
  private _currentPrompt: ClaudePrompt | null = null;

  constructor(container: HTMLElement) {
    super();
    this.container = container;
    this.render();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-action-id]') as HTMLElement;
      if (button) {
        const id = button.dataset.actionId;
        const action = this.actions.find(a => a.id === id);
        if (action) {
          this.emit('action', { id: action.id, input: action.input });
        }
      }
    });
  }

  /**
   * Update actions based on Claude prompt
   */
  updateForPrompt(prompt: ClaudePrompt | null): void {
    this._currentPrompt = prompt;

    if (!prompt) {
      this.actions = DEFAULT_ACTIONS;
    } else {
      switch (prompt.type) {
        case 'yes_no':
          this.actions = YES_NO_ACTIONS;
          break;

        case 'tool_approval':
        case 'permission':
          this.actions = TOOL_APPROVAL_ACTIONS;
          break;

        case 'file_confirm':
          this.actions = YES_NO_ACTIONS;
          break;

        case 'choice_menu':
          this.actions = this.buildChoiceActions(prompt);
          break;

        default:
          this.actions = DEFAULT_ACTIONS;
      }
    }

    this.render();
  }

  /**
   * Build actions for choice menu
   */
  private buildChoiceActions(prompt: ClaudePrompt): QuickAction[] {
    const actions: QuickAction[] = [];

    if (prompt.choices) {
      // Add first 4 choices as buttons
      for (const choice of prompt.choices.slice(0, 4)) {
        actions.push({
          id: `choice-${choice.number}`,
          label: `${choice.number}`,
          input: `${choice.number}\n`,
          variant: choice.number === 1 ? 'primary' : 'default'
        });
      }
    }

    // Add navigation
    actions.push({ id: 'up', label: '↑', input: '\x1b[A' });
    actions.push({ id: 'down', label: '↓', input: '\x1b[B' });
    actions.push({ id: 'enter', label: '↵', input: '\r' });
    actions.push({ id: 'esc', label: 'Esc', input: '\x1b' });

    return actions;
  }

  /**
   * Update actions based on activity state
   */
  updateForActivity(activity: ClaudeActivity): void {
    // If thinking, show interrupt options prominently
    if (activity === 'thinking' || activity === 'executing') {
      // Keep current actions but maybe highlight ^C
      const ctrlC = this.actions.find(a => a.id === 'ctrl-c');
      if (ctrlC) {
        ctrlC.variant = 'danger';
      }
    }

    this.render();
  }

  /**
   * Render actions to container
   */
  private render(): void {
    this.container.innerHTML = this.actions.map(action => {
      if (action.visible === false) return '';

      const variantClass = action.variant ? `quick-btn-${action.variant}` : '';

      return `
        <button
          class="quick-btn ${variantClass}"
          data-action-id="${action.id}"
          aria-label="${action.label}"
        >
          ${action.icon || action.label}
        </button>
      `;
    }).join('');
  }

  /**
   * Set custom actions
   */
  setActions(actions: QuickAction[]): void {
    this.actions = actions;
    this.render();
  }

  /**
   * Reset to default actions
   */
  reset(): void {
    this._currentPrompt = null;
    this.actions = DEFAULT_ACTIONS;
    this.render();
  }

  /**
   * Get current actions
   */
  getActions(): QuickAction[] {
    return [...this.actions];
  }
}
