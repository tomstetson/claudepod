# ClaudePod v3 - The Complete Mobile Claude Code Experience

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform ClaudePod from a basic terminal viewer into a polished, mobile-first Claude Code companion that makes on-the-go development productive and enjoyable.

**Architecture:** Enhanced frontend with gesture support, smart UI components, improved state management, and better notification patterns. Backend additions for session metadata and command shortcuts.

**Tech Stack:** Vanilla JS (no framework bloat for mobile performance), Hammer.js for gestures, Web Vibration API for haptics, localStorage for preferences

---

## Design Philosophy

1. **Mobile-First Interactions** - Every feature designed for thumb-friendly one-handed use
2. **Reduce Typing** - Command palette, quick responses, voice-to-text consideration
3. **Glanceable Information** - See session status, progress, and context at a glance
4. **Speed** - Minimal latency, smart caching, optimistic UI updates
5. **Reliability** - Graceful degradation, offline resilience, auto-reconnect

---

## Phase 1: Input Experience Overhaul

### Task 1.1: Add Text Input Composer

Replace awkward terminal keyboard with a dedicated input field for composing messages.

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

**Implementation:**

Add input bar above quick actions:
```html
<div class="input-bar">
  <textarea id="input-composer" placeholder="Type a message..." rows="1"></textarea>
  <button id="send-btn" class="btn btn-primary" aria-label="Send">
    <span class="send-icon">↑</span>
  </button>
</div>
```

CSS for auto-expanding textarea:
```css
.input-bar {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
}

#input-composer {
  flex: 1;
  resize: none;
  min-height: 40px;
  max-height: 120px;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  line-height: 1.4;
}

#send-btn {
  width: 44px;
  height: 44px;
  padding: 0;
  flex-shrink: 0;
}
```

JS for send functionality:
```javascript
setupInputComposer() {
  const composer = document.getElementById('input-composer');
  const sendBtn = document.getElementById('send-btn');

  // Auto-resize textarea
  composer.addEventListener('input', () => {
    composer.style.height = 'auto';
    composer.style.height = Math.min(composer.scrollHeight, 120) + 'px';
  });

  // Send on button click
  sendBtn.addEventListener('click', () => this.sendComposerInput());

  // Send on Enter (Shift+Enter for newline)
  composer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendComposerInput();
    }
  });
}

sendComposerInput() {
  const composer = document.getElementById('input-composer');
  const text = composer.value.trim();
  if (!text) return;

  this.sendInput(text + '\n');
  composer.value = '';
  composer.style.height = 'auto';
  this.terminal.focus();
}
```

---

### Task 1.2: Add Command Palette

Quick access to common Claude commands without typing.

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

**Implementation:**

Add palette trigger button and modal:
```html
<button id="palette-btn" class="action-btn" aria-label="Commands">/</button>

<!-- Command palette modal -->
<div id="palette-modal" class="modal-overlay">
  <div class="modal palette-modal">
    <div class="palette-search">
      <input type="text" id="palette-search" placeholder="Search commands..." autocomplete="off">
    </div>
    <div class="palette-list" id="palette-list"></div>
  </div>
</div>
```

Commands to include:
```javascript
const CLAUDE_COMMANDS = [
  { cmd: '/help', desc: 'Show help', category: 'General' },
  { cmd: '/compact', desc: 'Compact conversation', category: 'General' },
  { cmd: '/clear', desc: 'Clear conversation', category: 'General' },
  { cmd: '/status', desc: 'Show status', category: 'General' },
  { cmd: 'y', desc: 'Yes/Confirm', category: 'Quick' },
  { cmd: 'n', desc: 'No/Decline', category: 'Quick' },
  { cmd: '\x03', desc: 'Cancel (Ctrl+C)', category: 'Control' },
  { cmd: '\x1b', desc: 'Escape', category: 'Control' },
  { cmd: 'git status', desc: 'Git status', category: 'Git' },
  { cmd: 'git diff', desc: 'Git diff', category: 'Git' },
  { cmd: 'git log --oneline -10', desc: 'Recent commits', category: 'Git' },
  { cmd: 'npm test', desc: 'Run tests', category: 'Dev' },
  { cmd: 'npm run build', desc: 'Build project', category: 'Dev' },
];
```

---

### Task 1.3: Add Command History

Remember and recall recent commands.

**Files:**
- Modify: `public/app.js`

**Implementation:**

Store in localStorage:
```javascript
addToHistory(cmd) {
  const history = JSON.parse(localStorage.getItem('claudepod_history') || '[]');
  // Remove duplicates and add to front
  const filtered = history.filter(h => h !== cmd);
  filtered.unshift(cmd);
  // Keep last 50
  localStorage.setItem('claudepod_history', JSON.stringify(filtered.slice(0, 50)));
}

getHistory() {
  return JSON.parse(localStorage.getItem('claudepod_history') || '[]');
}
```

Show in command palette under "Recent" category.

---

## Phase 2: Session Intelligence

### Task 2.1: Add Session Labels/Descriptions

Allow naming sessions for easy identification.

**Files:**
- Modify: `server.js`
- Create: `lib/sessions.js`
- Modify: `public/app.js`

**Implementation:**

Server-side session metadata storage (JSON file):
```javascript
// lib/sessions.js
const fs = require('fs');
const path = require('path');

const SESSIONS_FILE = path.join(__dirname, '../.sessions.json');

function loadMeta() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveMeta(meta) {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(meta, null, 2));
}

function setLabel(sessionName, label) {
  const meta = loadMeta();
  meta[sessionName] = { ...meta[sessionName], label };
  saveMeta(meta);
}

function getLabel(sessionName) {
  const meta = loadMeta();
  return meta[sessionName]?.label || sessionName;
}
```

API endpoint:
```javascript
app.put('/api/sessions/:name/label', (req, res) => {
  const { name } = req.params;
  const { label } = req.body;
  sessions.setLabel(name, label);
  res.json({ success: true });
});
```

---

### Task 2.2: Add Session Status Indicators

Show at-a-glance what each session is doing.

**Files:**
- Modify: `public/style.css`
- Modify: `public/app.js`

**Implementation:**

Track output patterns to determine status:
- 🟢 Idle (waiting at prompt)
- 🟡 Working (processing)
- 🔴 Needs input (prompt detected)
- ⚪ Disconnected

---

### Task 2.3: Smart Session Preview

Show last few lines of output in session dropdown.

**Implementation:**

Store last output snippet per session:
```javascript
this.sessionPreviews = new Map();

// In onmessage handler
if (msg.type === 'output') {
  this.updateSessionPreview(this.currentSession, msg.data);
}

updateSessionPreview(session, data) {
  const current = this.sessionPreviews.get(session) || '';
  const combined = current + data;
  // Keep last 200 chars, clean ANSI
  const clean = combined.replace(/\x1b\[[0-9;]*m/g, '').slice(-200);
  this.sessionPreviews.set(session, clean);
}
```

---

## Phase 3: Navigation & Scrolling

### Task 3.1: Smart Scroll Buttons

Jump to important locations in terminal.

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

**Implementation:**

Add floating scroll controls:
```html
<div class="scroll-controls">
  <button id="scroll-top" class="scroll-btn" aria-label="Scroll to top">↑</button>
  <button id="scroll-prompt" class="scroll-btn" aria-label="Jump to last prompt">⎆</button>
  <button id="scroll-bottom" class="scroll-btn" aria-label="Scroll to bottom">↓</button>
</div>
```

Track prompt positions:
```javascript
this.lastPromptLine = 0;

// Detect prompt patterns in output
if (/(\$|>|#)\s*$/.test(cleanLine) || /\[Y\/n\]/i.test(cleanLine)) {
  this.lastPromptLine = this.terminal.buffer.active.cursorY;
}

scrollToPrompt() {
  this.terminal.scrollToLine(this.lastPromptLine);
}
```

---

### Task 3.2: Terminal Output Search

Find text within terminal history.

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

**Implementation:**

Add search addon to xterm.js:
```html
<script src="https://cdn.jsdelivr.net/npm/xterm-addon-search@0.13.0/lib/xterm-addon-search.min.js"></script>
```

```javascript
this.searchAddon = new SearchAddon.SearchAddon();
this.terminal.loadAddon(this.searchAddon);

searchTerminal(query) {
  this.searchAddon.findNext(query);
}
```

---

## Phase 4: Mobile Polish

### Task 4.1: Haptic Feedback

Add tactile response to button presses.

**Files:**
- Modify: `public/app.js`

**Implementation:**

```javascript
haptic(type = 'light') {
  if (!navigator.vibrate) return;

  const patterns = {
    light: 10,
    medium: 25,
    heavy: 50,
    success: [10, 50, 10],
    error: [50, 100, 50],
  };

  navigator.vibrate(patterns[type] || patterns.light);
}

// Add to button handlers
btn.addEventListener('click', () => {
  this.haptic('light');
  // ... existing logic
});
```

---

### Task 4.2: Gesture Support

Swipe between sessions, pull to refresh.

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

**Implementation:**

Add Hammer.js:
```html
<script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
```

```javascript
setupGestures() {
  const terminal = document.getElementById('terminal');
  const hammer = new Hammer(terminal);

  // Swipe left/right to switch sessions
  hammer.on('swipeleft', () => this.nextSession());
  hammer.on('swiperight', () => this.prevSession());

  // Pull down to refresh
  hammer.get('pan').set({ direction: Hammer.DIRECTION_VERTICAL });
  hammer.on('panend', (e) => {
    if (e.deltaY > 100 && e.direction === Hammer.DIRECTION_DOWN) {
      this.loadSessions();
      this.haptic('medium');
    }
  });
}
```

---

### Task 4.3: Font Size Controls

Adjustable terminal font size.

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

**Implementation:**

Add to settings/header:
```html
<div class="font-controls">
  <button id="font-decrease" class="font-btn">A-</button>
  <button id="font-increase" class="font-btn">A+</button>
</div>
```

```javascript
setFontSize(size) {
  const clamped = Math.min(Math.max(size, 10), 24);
  this.terminal.options.fontSize = clamped;
  localStorage.setItem('claudepod_fontsize', clamped);
  this.fitTerminal();
}

// Load saved preference on init
const savedSize = localStorage.getItem('claudepod_fontsize');
if (savedSize) this.setFontSize(parseInt(savedSize));
```

---

## Phase 5: Notifications & Background

### Task 5.1: Enhanced Notification Patterns

Notify on more than just prompts.

**Files:**
- Modify: `lib/notifications.js`
- Modify: `server.js`

**Implementation:**

Add patterns for:
- Task completion ("Done", "Complete", "Finished")
- Errors ("Error:", "Failed:", "Exception")
- Test results ("passed", "failed")
- Build status ("Build succeeded", "Build failed")

```javascript
const COMPLETION_PATTERNS = [
  /\bdone\b/i,
  /\bcomplete[d]?\b/i,
  /\bfinished\b/i,
  /\bsuccess(fully)?\b/i,
];

const ERROR_PATTERNS = [
  /\berror[:!]/i,
  /\bfailed[:!]/i,
  /\bexception[:!]/i,
  /\bcrash(ed)?[:!]/i,
];
```

---

### Task 5.2: Notification Preferences

User-configurable notification settings.

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`
- Modify: `server.js`

**Implementation:**

Settings stored in localStorage, synced to server for notification decisions:
```javascript
const DEFAULT_PREFS = {
  notifyPrompts: true,
  notifyComplete: true,
  notifyErrors: true,
  notifyTests: false,
};
```

---

## Phase 6: Performance & Reliability

### Task 6.1: Output Virtualization

Handle large outputs without lag.

**Files:**
- Modify: `public/app.js`

**Implementation:**

- Limit scrollback buffer
- Clear old output periodically
- Add "Load more" for history

---

### Task 6.2: Smart Reconnection

Better handling of network changes.

**Files:**
- Modify: `public/app.js`

**Implementation:**

```javascript
setupNetworkHandling() {
  window.addEventListener('online', () => {
    if (this.currentSession && (!this.socket || this.socket.readyState !== WebSocket.OPEN)) {
      this.showStatus('Back online, reconnecting...', 'info');
      this.connectToSession(this.currentSession);
    }
  });

  window.addEventListener('offline', () => {
    this.showStatus('You are offline', 'warning');
  });
}
```

---

### Task 6.3: Optimistic UI Updates

Immediate feedback before server confirmation.

Show sent messages immediately in terminal with pending indicator, confirm when server acknowledges.

---

## Summary

**Phase 1: Input Experience** (3 tasks)
- Text composer with auto-resize
- Command palette with search
- Command history

**Phase 2: Session Intelligence** (3 tasks)
- Session labels
- Status indicators
- Smart preview

**Phase 3: Navigation** (2 tasks)
- Smart scroll buttons
- Terminal search

**Phase 4: Mobile Polish** (3 tasks)
- Haptic feedback
- Gesture support
- Font size controls

**Phase 5: Notifications** (2 tasks)
- Enhanced patterns
- User preferences

**Phase 6: Performance** (3 tasks)
- Output virtualization
- Smart reconnection
- Optimistic UI

**Total: 16 tasks** for a complete mobile Claude Code experience.

---

## Priority Order for Implementation

1. **Text Input Composer** - Biggest pain point
2. **Command Palette** - Reduces typing significantly
3. **Haptic Feedback** - Quick win, big impact
4. **Font Size Controls** - Accessibility
5. **Smart Scroll Buttons** - Navigation essential
6. **Gesture Support** - Session switching
7. **Session Labels** - Organization
8. **Enhanced Notifications** - Awareness
9. **Terminal Search** - Finding things
10. **Command History** - Efficiency
11. **Status Indicators** - At-a-glance info
12. **Smart Preview** - Context
13. **Smart Reconnection** - Reliability
14. **Notification Preferences** - Customization
15. **Output Virtualization** - Performance
16. **Optimistic UI** - Polish
