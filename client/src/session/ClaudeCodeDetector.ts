/**
 * ClaudeCodeDetector - Analyzes terminal output for Claude Code states
 *
 * Detects:
 * - Yes/No prompts
 * - Numbered choice menus
 * - Slash command suggestions
 * - Permission requests
 * - Thinking/processing states
 * - File operation confirmations
 * - Tool approval requests
 */

import { EventEmitter } from '../utils/EventEmitter';

export type ClaudePromptType =
  | 'yes_no'
  | 'choice_menu'
  | 'text_input'
  | 'permission'
  | 'file_confirm'
  | 'tool_approval'
  | 'slash_command'
  | 'none';

export interface ChoiceOption {
  number: number;
  text: string;
  key?: string;  // Single-key shortcut if available
}

export interface ClaudePrompt {
  type: ClaudePromptType;
  message: string;
  choices?: ChoiceOption[];
  defaultChoice?: number | string;
  allowCustom?: boolean;
}

export type ClaudeActivity =
  | 'idle'
  | 'thinking'
  | 'writing'
  | 'reading'
  | 'searching'
  | 'executing'
  | 'waiting';

interface ClaudeCodeDetectorEvents {
  promptDetected: ClaudePrompt;
  activityChanged: ClaudeActivity;
  slashCommandSuggested: string[];
}

export class ClaudeCodeDetector extends EventEmitter<ClaudeCodeDetectorEvents> {
  private outputBuffer = '';
  private maxBufferSize = 10000;
  private currentActivity: ClaudeActivity = 'idle';
  private currentPrompt: ClaudePrompt | null = null;
  private lastPromptTime = 0;

  // Patterns for Claude Code detection
  private patterns = {
    // Yes/No prompts
    yesNo: [
      /\[Y\/n\]/i,
      /\[y\/N\]/i,
      /\(yes\/no\)/i,
      /\(y\/n\)/i,
      /Continue\? \[Y\/n\]/i,
      /Proceed\? \[Y\/n\]/i,
      /Allow\? \[Y\/n\]/i,
      /Do you want to/i,
      /Would you like to/i,
    ],

    // Numbered choice menus
    choiceMenu: [
      /^\s*(\d+)\.\s+(.+)$/gm,  // "1. Option text"
      /^\s*\[(\d+)\]\s+(.+)$/gm,  // "[1] Option text"
      /^\s*(\d+)\)\s+(.+)$/gm,  // "1) Option text"
    ],

    // Choice selection prompts
    choicePrompt: [
      /Enter your choice/i,
      /Select an option/i,
      /Choose \[/i,
      /Enter number/i,
      /Selection:/i,
    ],

    // Permission/approval requests
    permission: [
      /Allow .+ to/i,
      /Permission to/i,
      /Approve this action/i,
      /Grant access/i,
    ],

    // File operation confirmations
    fileConfirm: [
      /Create file/i,
      /Overwrite/i,
      /Delete file/i,
      /Replace/i,
      /Write to/i,
      /Modify/i,
    ],

    // Tool approval
    toolApproval: [
      /Run this command/i,
      /Execute:/i,
      /Allow tool:/i,
      /Run bash command/i,
      /Allow read/i,
      /Allow write/i,
      /Allow edit/i,
    ],

    // Activity states
    thinking: [
      /⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧|⠇|⠏/,  // Spinner characters
      /Thinking\.{0,3}$/m,
      /Processing\.{0,3}$/m,
      /Analyzing\.{0,3}$/m,
    ],

    writing: [
      /Writing .+\.\.\./i,
      /Creating .+\.\.\./i,
      /Editing .+\.\.\./i,
      /Generating/i,
    ],

    reading: [
      /Reading .+\.\.\./i,
      /Loading .+\.\.\./i,
      /Fetching/i,
    ],

    searching: [
      /Searching/i,
      /Looking for/i,
      /Scanning/i,
      /Finding/i,
    ],

    executing: [
      /Running/i,
      /Executing/i,
      /Starting/i,
    ],

    // Shell/input prompt (idle waiting state)
    shellPrompt: [
      /\$ $/m,
      /> $/m,
      /% $/m,
      /❯ $/m,
      /→ $/m,
    ],

    // Slash command patterns
    slashCommand: [
      /^\/\w+/m,  // Starts with /word
      /Available commands:/i,
      /Type \/ to see/i,
    ],
  };

  constructor() {
    super();
  }

  /**
   * Process new terminal output
   */
  processOutput(data: string): void {
    // Add to buffer
    this.outputBuffer += data;

    // Trim buffer if too large
    if (this.outputBuffer.length > this.maxBufferSize) {
      this.outputBuffer = this.outputBuffer.slice(-this.maxBufferSize);
    }

    // Analyze the recent output
    this.analyzeOutput();
  }

  /**
   * Analyze buffered output
   */
  private analyzeOutput(): void {
    // Get last ~2000 chars for analysis
    const recent = this.outputBuffer.slice(-2000);

    // Detect activity state
    this.detectActivity(recent);

    // Detect prompts
    this.detectPrompt(recent);
  }

  /**
   * Detect current activity state
   */
  private detectActivity(text: string): void {
    let newActivity: ClaudeActivity = 'idle';

    // Check patterns in priority order
    if (this.matchesAny(text, this.patterns.thinking)) {
      newActivity = 'thinking';
    } else if (this.matchesAny(text, this.patterns.writing)) {
      newActivity = 'writing';
    } else if (this.matchesAny(text, this.patterns.reading)) {
      newActivity = 'reading';
    } else if (this.matchesAny(text, this.patterns.searching)) {
      newActivity = 'searching';
    } else if (this.matchesAny(text, this.patterns.executing)) {
      newActivity = 'executing';
    } else if (this.matchesAny(text, this.patterns.shellPrompt)) {
      newActivity = 'waiting';
    }

    if (newActivity !== this.currentActivity) {
      this.currentActivity = newActivity;
      this.emit('activityChanged', newActivity);
    }
  }

  /**
   * Detect Claude Code prompts
   */
  private detectPrompt(text: string): void {
    // Debounce prompt detection
    const now = Date.now();
    if (now - this.lastPromptTime < 100) return;

    let prompt: ClaudePrompt | null = null;

    // Check for Yes/No prompt
    if (this.matchesAny(text, this.patterns.yesNo)) {
      const match = text.match(/([^\n]+\[Y\/n\]|\[y\/N\]|yes\/no)[^\n]*/i);
      prompt = {
        type: 'yes_no',
        message: match ? match[0].trim() : 'Confirm?',
        choices: [
          { number: 1, text: 'Yes', key: 'y' },
          { number: 2, text: 'No', key: 'n' }
        ],
        defaultChoice: text.includes('[Y/n]') ? 'y' : 'n'
      };
    }

    // Check for numbered choice menu
    if (!prompt && this.matchesAny(text, this.patterns.choicePrompt)) {
      const choices = this.extractChoices(text);
      if (choices.length > 0) {
        prompt = {
          type: 'choice_menu',
          message: 'Select an option:',
          choices,
          allowCustom: true
        };
      }
    }

    // Check for tool approval
    if (!prompt && this.matchesAny(text, this.patterns.toolApproval)) {
      const match = text.match(/(Allow|Run|Execute)[^\n]+/i);
      prompt = {
        type: 'tool_approval',
        message: match ? match[0].trim() : 'Approve action?',
        choices: [
          { number: 1, text: 'Allow', key: 'y' },
          { number: 2, text: 'Deny', key: 'n' },
          { number: 3, text: 'Allow All', key: 'a' }
        ]
      };
    }

    // Check for permission request
    if (!prompt && this.matchesAny(text, this.patterns.permission)) {
      const match = text.match(/(Permission|Allow|Grant)[^\n]+/i);
      prompt = {
        type: 'permission',
        message: match ? match[0].trim() : 'Grant permission?',
        choices: [
          { number: 1, text: 'Allow', key: 'y' },
          { number: 2, text: 'Deny', key: 'n' }
        ]
      };
    }

    // Check for file confirmation
    if (!prompt && this.matchesAny(text, this.patterns.fileConfirm)) {
      const match = text.match(/(Create|Overwrite|Delete|Write|Modify)[^\n]+/i);
      prompt = {
        type: 'file_confirm',
        message: match ? match[0].trim() : 'Confirm file operation?',
        choices: [
          { number: 1, text: 'Yes', key: 'y' },
          { number: 2, text: 'No', key: 'n' }
        ]
      };
    }

    // Emit if prompt changed
    if (prompt && (!this.currentPrompt || prompt.type !== this.currentPrompt.type)) {
      this.currentPrompt = prompt;
      this.lastPromptTime = now;
      this.emit('promptDetected', prompt);
    } else if (!prompt && this.currentPrompt) {
      // Clear prompt when none detected
      this.currentPrompt = null;
    }
  }

  /**
   * Extract numbered choices from text
   */
  private extractChoices(text: string): ChoiceOption[] {
    const choices: ChoiceOption[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      // Match "1. Option" or "[1] Option" or "1) Option"
      const match = line.match(/^\s*(?:\[?(\d+)\]?[\.\)]\s+)(.+)$/);
      if (match) {
        choices.push({
          number: parseInt(match[1], 10),
          text: match[2].trim()
        });
      }
    }

    return choices;
  }

  /**
   * Check if text matches any pattern in array
   */
  private matchesAny(text: string, patterns: RegExp[]): boolean {
    return patterns.some(p => p.test(text));
  }

  /**
   * Get current prompt
   */
  getCurrentPrompt(): ClaudePrompt | null {
    return this.currentPrompt;
  }

  /**
   * Get current activity
   */
  getCurrentActivity(): ClaudeActivity {
    return this.currentActivity;
  }

  /**
   * Get activity label for display
   */
  getActivityLabel(activity: ClaudeActivity): string {
    switch (activity) {
      case 'idle': return '';
      case 'thinking': return 'Thinking...';
      case 'writing': return 'Writing...';
      case 'reading': return 'Reading...';
      case 'searching': return 'Searching...';
      case 'executing': return 'Executing...';
      case 'waiting': return 'Ready';
    }
  }

  /**
   * Get activity color for UI
   */
  getActivityColor(activity: ClaudeActivity): string {
    switch (activity) {
      case 'idle': return '#666';
      case 'thinking': return '#ffaa00';
      case 'writing': return '#00aaff';
      case 'reading': return '#aa00ff';
      case 'searching': return '#ff00aa';
      case 'executing': return '#ff6600';
      case 'waiting': return '#00ff00';
    }
  }

  /**
   * Get suggested quick actions based on current state
   */
  getSuggestedActions(): { label: string; input: string; key?: string }[] {
    const actions: { label: string; input: string; key?: string }[] = [];

    if (this.currentPrompt) {
      switch (this.currentPrompt.type) {
        case 'yes_no':
          actions.push({ label: 'Yes', input: 'y\n', key: 'y' });
          actions.push({ label: 'No', input: 'n\n', key: 'n' });
          break;

        case 'tool_approval':
          actions.push({ label: 'Allow', input: 'y\n', key: 'y' });
          actions.push({ label: 'Deny', input: 'n\n', key: 'n' });
          actions.push({ label: 'Allow All', input: 'a\n', key: 'a' });
          break;

        case 'permission':
        case 'file_confirm':
          actions.push({ label: 'Allow', input: 'y\n', key: 'y' });
          actions.push({ label: 'Deny', input: 'n\n', key: 'n' });
          break;

        case 'choice_menu':
          if (this.currentPrompt.choices) {
            for (const choice of this.currentPrompt.choices.slice(0, 4)) {
              actions.push({
                label: `${choice.number}`,
                input: `${choice.number}\n`,
                key: choice.key
              });
            }
          }
          break;
      }
    }

    // Always include common actions
    if (actions.length === 0) {
      actions.push({ label: 'Enter', input: '\r' });
    }
    actions.push({ label: 'Esc', input: '\x1b' });
    actions.push({ label: '^C', input: '\x03' });

    return actions;
  }

  /**
   * Clear buffer (e.g., on session switch)
   */
  clearBuffer(): void {
    this.outputBuffer = '';
    this.currentActivity = 'idle';
    this.currentPrompt = null;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clearBuffer();
    this.removeAllListeners();
  }
}
