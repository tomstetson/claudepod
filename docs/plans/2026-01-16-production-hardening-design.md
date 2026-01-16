# ClaudePod Production Hardening Design

**Date:** 2026-01-16
**Status:** ✅ Implemented
**Goal:** Make ClaudePod production-ready with reliable scrolling, connection stability, and mobile performance

## Implementation Summary

All four phases have been implemented:

| Phase | Status | Key Deliverables |
|-------|--------|------------------|
| 1. Server Buffer | ✅ | `lib/buffer.js`, `lib/session-store.js` |
| 2. Connection Reliability | ✅ | `public/lib/connection.js` |
| 3. Scroll Performance | ✅ | `public/lib/scroll.js`, `public/lib/performance.js` |
| 4. Polish | ✅ | Loading indicators, error handling, recovery |

**Commits:**
- `6bef1e1` feat: add server-side scrollback buffer (Phase 1)
- `e38e993` feat: add ConnectionManager with auto-reconnection (Phase 2)
- `34820cb` feat: add scroll controller and performance monitoring (Phase 3)
- (Phase 4 in current branch)

## Background

ClaudePod currently serves as a mobile-first PWA for monitoring Claude Code sessions via tmux. The goal is to evolve it toward a production-grade terminal application comparable to Termius, starting with foundational reliability improvements.

### Current Pain Points
- Scrollback buffer limited to 5000 lines, content lost on refresh
- Laggy scrolling on mobile devices
- WebSocket disconnections without graceful recovery
- No session state persistence

### Success Criteria
- Unlimited practical scrollback (50,000+ lines)
- 60fps scroll performance on iPhone 12+
- Automatic reconnection with state sync
- Session output survives browser refresh

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  ┌───────────────────────────────────────────────────┐ │
│  │  xterm.js (viewport only, ~500 lines)             │ │
│  │  - Renders visible content + small buffer         │ │
│  │  - Requests historical content on scroll          │ │
│  │  - Managed by ScrollController                    │ │
│  └───────────────────────────────────────────────────┘ │
│                          ↕                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │  ConnectionManager                                │ │
│  │  - WebSocket lifecycle                            │ │
│  │  - Reconnection with exponential backoff          │ │
│  │  - State synchronization                          │ │
│  └───────────────────────────────────────────────────┘ │
│                          ↕ WebSocket                    │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                      Server                             │
│  ┌───────────────────────────────────────────────────┐ │
│  │  SessionManager                                   │ │
│  │  - Manages all active sessions                    │ │
│  │  - Handles multiple clients per session           │ │
│  │  - Coordinates PTY and buffer                     │ │
│  └───────────────────────────────────────────────────┘ │
│           │                           │                 │
│  ┌────────┴───────┐        ┌─────────┴────────┐       │
│  │  RingBuffer    │        │  SessionStore    │       │
│  │  - 50K lines   │        │  - Disk persist  │       │
│  │  - In-memory   │        │  - Metadata      │       │
│  └────────────────┘        └──────────────────┘       │
│                                                         │
│  Storage: ~/.claudepod/sessions/{name}/                │
│           ├── buffer.log    (terminal output)          │
│           └── meta.json     (session metadata)         │
└─────────────────────────────────────────────────────────┘
```

---

## Component Designs

### 1. Server-Side Ring Buffer (`lib/buffer.js`)

**Purpose:** Store session output with efficient memory usage and disk overflow.

```javascript
class RingBuffer {
  constructor(options = {}) {
    this.maxLines = options.maxLines || 50000;
    this.lines = [];
    this.totalLinesWritten = 0;  // For line numbering
    this.diskPath = options.diskPath;
  }

  // Write new terminal output
  write(data) {
    const newLines = data.split('\n');
    this.lines.push(...newLines);
    this.totalLinesWritten += newLines.length;

    // Trim to max size
    if (this.lines.length > this.maxLines) {
      const overflow = this.lines.splice(0, this.lines.length - this.maxLines);
      if (this.diskPath) this.appendToDisk(overflow);
    }
  }

  // Get lines by absolute line number
  getRange(startLine, count) {
    const bufferStart = this.totalLinesWritten - this.lines.length;
    const relativeStart = Math.max(0, startLine - bufferStart);
    return this.lines.slice(relativeStart, relativeStart + count);
  }

  // Get current buffer state for sync
  getState() {
    return {
      oldestLine: this.totalLinesWritten - this.lines.length,
      newestLine: this.totalLinesWritten,
      lineCount: this.lines.length
    };
  }
}
```

**Memory Budget:**
- 50,000 lines × ~100 bytes avg = ~5MB per session
- Support up to 10 concurrent sessions = ~50MB total

### 2. Session Store (`lib/session-store.js`)

**Purpose:** Persist session metadata and enable recovery after server restart.

```javascript
class SessionStore {
  constructor(baseDir = '~/.claudepod/sessions') {
    this.baseDir = path.resolve(baseDir.replace('~', os.homedir()));
  }

  async save(session) {
    const dir = path.join(this.baseDir, session.name);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(
      path.join(dir, 'meta.json'),
      JSON.stringify({
        name: session.name,
        label: session.label,
        created: session.created,
        lastActivity: Date.now(),
        terminalSize: session.terminalSize,
        notifications: session.notifications
      })
    );
  }

  async appendBuffer(sessionName, data) {
    const bufferPath = path.join(this.baseDir, sessionName, 'buffer.log');
    await fs.appendFile(bufferPath, data);
  }

  async loadBuffer(sessionName, fromLine, count) {
    // Read from disk for historical content
    // Implementation uses line-by-line reading for efficiency
  }
}
```

### 3. WebSocket Protocol (`lib/protocol.js`)

**Message Types:**

| Type | Direction | Payload | Purpose |
|------|-----------|---------|---------|
| `input` | C→S | `{ data: string }` | Terminal input |
| `output` | S→C | `{ data: string, line: number }` | Terminal output with line reference |
| `resize` | C→S | `{ cols, rows }` | Terminal resize |
| `sync_request` | C→S | `{ fromLine: number, count: number }` | Request historical content |
| `sync_response` | S→C | `{ lines: string[], startLine: number, bufferState }` | Historical content |
| `state_sync` | S→C | `{ cursorPos, bufferState, terminalSize }` | Full state on reconnect |
| `ping` | C→S | `{ timestamp }` | Latency measurement |
| `pong` | S→C | `{ timestamp }` | Latency response |
| `pty_exit` | S→C | `{ code, canReconnect }` | PTY process exited |
| `error` | S→C | `{ message, recoverable }` | Error notification |

### 4. Connection Manager (Client)

**Purpose:** Manage WebSocket lifecycle with automatic reconnection and state sync.

```javascript
class ConnectionManager {
  constructor(options = {}) {
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 30000;

    this.socket = null;
    this.reconnectAttempts = 0;
    this.lastReceivedLine = 0;
    this.intentionalClose = false;
  }

  connect(sessionName) {
    this.sessionName = sessionName;
    this.intentionalClose = false;
    this.createSocket();
  }

  createSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${location.host}/terminal/${this.sessionName}`);

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected');

      // Request sync if reconnecting
      if (this.lastReceivedLine > 0) {
        this.send({
          type: 'sync_request',
          fromLine: this.lastReceivedLine,
          count: 1000
        });
      }
    };

    this.socket.onclose = (event) => {
      if (!this.intentionalClose && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('reconnect_failed');
      return;
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay
    );

    this.reconnectAttempts++;
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });

    setTimeout(() => this.createSocket(), delay);
  }

  disconnect() {
    this.intentionalClose = true;
    this.socket?.close(1000, 'User disconnect');
  }
}
```

### 5. Scroll Controller (Client)

**Purpose:** Manage virtual scrolling with on-demand history fetch.

```javascript
class ScrollController {
  constructor(terminal, connection) {
    this.terminal = terminal;
    this.connection = connection;
    this.bufferState = null;
    this.loadedRange = { start: 0, end: 0 };
    this.loading = false;

    this.setupScrollListener();
  }

  setupScrollListener() {
    const viewport = this.terminal.element.querySelector('.xterm-viewport');

    viewport.addEventListener('scroll', throttle(() => {
      if (this.loading) return;

      // Check if near top and have more history
      if (viewport.scrollTop < 200 && this.hasMoreHistory()) {
        this.loadMoreHistory();
      }
    }, 100));
  }

  hasMoreHistory() {
    return this.bufferState && this.loadedRange.start > this.bufferState.oldestLine;
  }

  async loadMoreHistory() {
    this.loading = true;
    const count = 500;
    const fromLine = Math.max(
      this.bufferState.oldestLine,
      this.loadedRange.start - count
    );

    this.connection.send({
      type: 'sync_request',
      fromLine,
      count
    });
  }

  handleSyncResponse(data) {
    this.loading = false;

    // Prepend history without scroll jump
    const viewport = this.terminal.element.querySelector('.xterm-viewport');
    const oldScrollHeight = viewport.scrollHeight;
    const oldScrollTop = viewport.scrollTop;

    // Write historical content at buffer start
    this.prependToTerminal(data.lines);

    // Restore scroll position
    const newScrollHeight = viewport.scrollHeight;
    viewport.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);

    this.loadedRange.start = data.startLine;
  }
}
```

---

## Mobile Performance Optimizations

### Terminal Configuration

```javascript
const mobileConfig = {
  scrollback: 500,           // Reduced local buffer
  fastScrollModifier: 'alt',
  smoothScrollDuration: 80,  // Faster transitions
  rendererType: 'canvas',    // Better than DOM renderer

  theme: {
    // ... existing theme
  }
};

// Use canvas addon for better performance
import { CanvasAddon } from 'xterm-addon-canvas';
terminal.loadAddon(new CanvasAddon());
```

### Touch Scrolling CSS

```css
.xterm-viewport {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  overscroll-behavior: contain;
}

/* Prevent rubber-banding on iOS */
.xterm-screen {
  touch-action: pan-y;
}
```

### Keyboard Handling

```javascript
// Save scroll position when keyboard opens
let savedScrollPosition = null;

window.visualViewport?.addEventListener('resize', () => {
  const keyboardHeight = window.innerHeight - window.visualViewport.height;

  if (keyboardHeight > 150) {
    // Keyboard opening
    savedScrollPosition = viewport.scrollTop;
  } else if (savedScrollPosition !== null) {
    // Keyboard closing - restore position
    viewport.scrollTop = savedScrollPosition;
    savedScrollPosition = null;
  }
});
```

### Performance Monitoring

```javascript
class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
  }

  tick() {
    this.frameCount++;
    const now = performance.now();

    if (now - this.lastTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastTime = now;

      // Degrade quality if FPS drops
      if (this.fps < 30) {
        this.reduceQuality();
      }
    }
  }

  reduceQuality() {
    // Reduce scrollback buffer
    terminal.options.scrollback = 200;

    // Disable smooth scrolling
    viewport.style.scrollBehavior = 'auto';
  }
}
```

---

## Implementation Phases

### Phase 1: Server-Side Buffer (Foundation)

**Files to Create/Modify:**
- `lib/buffer.js` - New: Ring buffer implementation
- `lib/session-store.js` - New: Disk persistence
- `server.js` - Modify: Integrate buffer with WebSocket handler

**Tasks:**
1. Implement RingBuffer class with tests
2. Implement SessionStore class with tests
3. Modify WebSocket handler to use buffer
4. Add `sync_request`/`sync_response` message handling
5. Add line numbers to output messages

**Testing:**
- Unit tests for RingBuffer edge cases
- Integration test: Write 100K lines, verify retrieval
- Memory profiling under load

### Phase 2: Connection Reliability

**Files to Create/Modify:**
- `lib/protocol.js` - New: Message type definitions
- `public/lib/connection.js` - New: ConnectionManager class
- `public/app.js` - Modify: Use ConnectionManager
- `server.js` - Modify: Multi-client support, state sync

**Tasks:**
1. Implement ConnectionManager with reconnection
2. Add state synchronization protocol
3. Support multiple clients per session
4. Implement visibility-aware connection management
5. Add network quality detection

**Testing:**
- Test reconnection with various failure modes
- Test multi-client synchronization
- Test state sync after reconnect

### Phase 3: Client Scroll Performance

**Files to Create/Modify:**
- `public/lib/scroll.js` - New: ScrollController class
- `public/lib/performance.js` - New: Performance monitoring
- `public/app.js` - Modify: Integrate scroll controller
- `public/style.css` - Modify: Touch scrolling CSS

**Tasks:**
1. Implement ScrollController with history fetch
2. Add canvas renderer for better performance
3. Implement touch-optimized CSS
4. Add keyboard position handling
5. Implement adaptive quality degradation

**Testing:**
- Performance testing on target devices
- Test infinite scroll with 50K+ lines
- Test keyboard open/close scroll preservation

### Phase 4: Polish & Edge Cases

**Tasks:**
1. Handle offline/online transitions gracefully
2. Add loading indicators for history fetch
3. Handle session recovery after server restart
4. Improve error messages and recovery flows
5. Add telemetry for performance monitoring
6. Documentation and README updates

**Testing:**
- End-to-end tests with Playwright
- Stress testing with large sessions
- iOS/Android device testing

---

## Data Formats

### Session Metadata (`meta.json`)

```json
{
  "name": "claude-abc123",
  "label": "API Refactor",
  "created": "2026-01-16T10:30:00Z",
  "lastActivity": "2026-01-16T14:22:00Z",
  "terminalSize": { "cols": 80, "rows": 24 },
  "notifications": true,
  "bufferStats": {
    "totalLines": 15234,
    "diskLines": 5234,
    "memoryLines": 10000
  }
}
```

### Buffer File Format (`buffer.log`)

Plain text, one terminal output chunk per line with metadata prefix:

```
[1705407000000] Terminal output line 1
[1705407000001] Terminal output line 2
```

Timestamp enables efficient seeking for time-based queries.

---

## Migration Path

### From Current to Phase 1

1. Add buffer.js without modifying existing behavior
2. Add session-store.js for new sessions only
3. Modify WebSocket handler to populate buffer
4. Add sync_request handling (returns empty for old sessions)
5. Gradually migrate existing sessions

### Rollback Plan

Each phase can be rolled back independently:
- Phase 1: Remove buffer integration, fall back to direct PTY output
- Phase 2: Disable ConnectionManager, use simple WebSocket
- Phase 3: Disable ScrollController, use default xterm scrolling

---

## Future Enhancements (Post-MVP)

After completing the foundation, these features become feasible:

1. **SSH Support** - Connection manager can handle multiple protocol types
2. **Split View** - Buffer architecture supports multiple terminal views
3. **Snippets** - Session store can persist user snippets
4. **Cloud Sync** - Session metadata ready for remote storage
5. **Search in History** - Disk buffer enables full-text search

---

## Appendix: Termius Feature Comparison

| Feature | Termius | ClaudePod (Current) | ClaudePod (After) |
|---------|---------|---------------------|-------------------|
| Scrollback | Unlimited | 5000 lines | 50,000+ lines |
| Persistence | Yes | No | Yes |
| Reconnection | Automatic | Basic | Full sync |
| Multi-client | Yes | No | Yes |
| Mobile scroll | Native | Laggy | 60fps target |
| SSH | Yes | No | Future |
| SFTP | Yes | No | Future |
| Snippets | Yes | Basic palette | Future |

---

## Sources

- [Termius Features - G2 Reviews](https://www.g2.com/products/termius/reviews)
- [Termius Desktop Changelog](https://termius.com/changelog/desktop-changelog)
- [Termius Mobile App](https://play.google.com/store/apps/details?id=com.server.auditor.ssh.client)
