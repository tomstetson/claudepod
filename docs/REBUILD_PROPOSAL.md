# ClaudePod Mobile Rebuild: Comprehensive Assessment & Proposal

## Executive Summary

ClaudePod's current implementation has fundamental architectural limitations that create a "buggy" experience on iPhone Safari/PWA. After thorough analysis of 15+ competing solutions (Happy Coder, Termly, AgentOS, Termius, Blink Shell, La Terminal, and others), I recommend a **ground-up rebuild** with a native-first touch architecture that positions ClaudePod as the **only open-source, self-hosted, privacy-first PWA for Claude Code mobile access**.

### Competitive Positioning

> **ClaudePod** is the only open-source, self-hosted PWA for monitoring and controlling Claude Code from your iPhone. Unlike relay-based solutions (Happy, Termly) that route your code through third-party servers, ClaudePod runs entirely on your infrastructure via Tailscale. It's the privacy-conscious choice for developers who want mobile access to their AI coding agents without compromising on security or control.

**Tagline: "Your AI, Your Infrastructure, Your Privacy"**

---

## Part 1: Current State Assessment

### Critical iOS Safari/PWA Issues Identified

#### 1. **xterm.js Mobile Limitations** (CRITICAL)
- xterm.js has [limited touch support on mobile devices](https://github.com/xtermjs/xterm.js/issues/5377) - the core library lacks dedicated touch event handling
- Copy/paste doesn't work correctly on touch devices ([Issue #3727](https://github.com/xtermjs/xterm.js/issues/3727))
- iOS keyboard arrow keys don't fire proper events on Smart Keyboard
- `term.onData` event buffering causes input lag on iOS vs Android
- No native touch gesture processing in CoreBrowserTerminal

#### 2. **iOS Safari PWA Keyboard Bug** (CRITICAL)
- Well-documented iOS Safari bug where keyboard stops appearing in PWAs
- When two PWAs are open simultaneously, keyboard may display "off screen"
- Only workaround is restarting the device or cycling through Safari
- This affects ALL PWAs on the device once triggered

#### 3. **visualViewport API Limitations**
Current code at `app.js:303-343`:
```javascript
window.visualViewport.addEventListener('resize', () => {
  const heightDiff = this.viewportHeight - currentHeight;
  this.keyboardVisible = heightDiff > 150;
  // ...
});
```
**Problems:**
- 150px threshold is arbitrary and fails on different device sizes
- Race conditions between keyboard animation and resize events
- Scroll position restoration is inconsistent during keyboard transitions
- `visualViewport` reports incorrect values during orientation changes

#### 4. **Input Architecture Flaws**
Current approach uses both:
- Direct xterm.js input (`terminal.onData`)
- Separate textarea composer (`#input-composer`)

**Problems:**
- Dual input paths create focus management conflicts
- iOS auto-correct/autocomplete doesn't integrate with xterm properly
- Predictive text gets buffered and sent incorrectly ([Issue #2403](https://github.com/xtermjs/xterm.js/issues/2403))
- D-pad buttons fight with keyboard for focus

#### 5. **Gesture Conflicts**
At `app.js:1259-1292`, Hammer.js is configured with `touchAction: 'pan-y'`:
```javascript
hammer.get('swipe').set({
  direction: Hammer.DIRECTION_HORIZONTAL,
  threshold: 50,
  velocity: 0.5
});
```
**Problems:**
- Conflicts with iOS native swipe-back gesture
- Interferes with text selection
- Threshold values don't adapt to device DPI
- No support for pinch-to-zoom (accessibility issue)

#### 6. **Performance Issues**
- Full DOM terminal renders 50,000+ lines in memory
- No virtualization of terminal output
- Service worker cache strategy causes stale UI after updates
- No battery/thermal throttling awareness beyond basic checks

### Secondary Issues

| Issue | Location | Impact |
|-------|----------|--------|
| Double-tap zoom prevention breaks accessibility | `app.js:683-689` | Medium |
| `prompt()` dialogs don't work in PWA mode | Multiple locations | High |
| Menu detection regex is fragile | `app.js:2168-2230` | Medium |
| No haptic feedback on iOS (different API) | `app.js:1218-1231` | Low |
| localStorage quota exceeded on heavy use | Draft persistence | Medium |
| No offline queue for input during disconnection | Connection layer | High |

---

## Part 2: Competitive Landscape Analysis

### Direct Competitors (Claude Code Mobile Access)

| Solution | Architecture | Setup | Self-Hosted | Voice | Encryption |
|----------|-------------|-------|-------------|-------|------------|
| **[Happy Coder](https://github.com/slopus/happy)** | React Native + Relay | `happy` instead of `claude` | No (relay) | Yes | E2E |
| **[Termly](https://termly.dev/)** | CLI + Relay | QR code scan | No (relay) | Yes | AES-256-GCM |
| **[AgentOS](https://github.com/saadnvd1/agent-os)** | Next.js + tmux | npm install + run | Yes | No | Local only |
| **ClaudePod** | Express + PWA | Self-hosted | Yes | Planned | Tailscale |

**Key Insight:** Happy and Termly require relay servers. AgentOS is web-only (no mobile app feel). ClaudePod is uniquely positioned as self-hosted + PWA.

### Premium Mobile SSH Terminals

| App | Key Innovation | Price | Open Source |
|-----|----------------|-------|-------------|
| **[Termius](https://termius.com/)** | Cross-platform sync, AI agent auto-start | Subscription | No |
| **[Blink Shell](https://blink.sh/)** | Mosh (survives reboot), VS Code integration | $20 | Yes |
| **[La Terminal](https://la-terminal.net/)** | El Preservador (server-side proxy), AI copilot | Freemium | No |
| **[Prompt 3](https://panic.com/prompt/)** | GPU acceleration (10x faster), Vision Pro | $20/yr | No |
| **[ShellFish](https://secureshellfish.app/)** | iOS Files app integration, built-in tmux | Freemium | No |

### Local Terminal Emulators

| App | Environment | Use Case |
|-----|-------------|----------|
| **[a-Shell](https://holzschu.github.io/a-Shell_iOS/)** | Python, JS, C locally | Offline coding on iOS |
| **[iSH](https://ish.app/)** | x86 Linux emulation | Full Alpine Linux |
| **[Termux](https://termux.dev/)** | Debian-based Linux | Android power users |
| **[NewTerm 3](https://github.com/hbang/NewTerm)** | 120fps, iTerm2 integration | Jailbreak only |

### Key Patterns from Industry Leaders

**From Blink Shell:**
- Mosh support is game-changing (connections survive device sleep/reboot)
- Open source can compete with commercial quality

**From La Terminal:**
- El Preservador: Server-side proxy that buffers when iOS suspends app
- Native touch > HTML-based terminals

**From NewTerm 3:**
- 120fps on ProMotion with tunable fallback (15/30/60fps)
- Low Power Mode awareness automatic
- iTerm2 Shell Integration for directory awareness

**From Happy Coder:**
- Voice input for hands-free interaction
- "Replace command" approach (`happy` instead of `claude`) is frictionless
- Bidirectional real-time sync is expected

**From AgentOS:**
- Multi-pane (4 AI agents simultaneously) is powerful
- MCP conductor/worker model for orchestration
- Git integration UI removes CLI dependency

### Identified Market Gaps

| Gap | Description | Opportunity |
|-----|-------------|-------------|
| **No open-source, self-hosted, AI-focused PWA** | Happy/Termly use relays; AgentOS is web-only | ClaudePod fills this gap |
| **No voice + self-hosted combination** | Voice exists (Happy, Termly) OR self-hosted (AgentOS), not both | Add Web Speech API |
| **No offline input queue for AI agents** | Mosh has connection persistence, but no input queuing | IndexedDB queue |
| **No session transfer / Handoff** | Can't seamlessly continue session on desktop | Apple Handoff integration |
| **No multi-agent orchestration on mobile** | AgentOS has 4-pane but web-only | 2-pane split view |
| **No PWA with native-quality touch** | PWAs seen as "lesser" than native | Prove it can be done |

---

## Part 2.5: ClaudePod Competitive Advantages

Based on comprehensive competitive analysis, ClaudePod should differentiate with these unique features:

### 1. "Zero-Infrastructure AI Terminal" (PRIMARY DIFFERENTIATOR)
Unlike Happy/Termly that require relay servers:
- **Your Mac runs the server** (not a third-party relay)
- **Tailscale provides secure access** (encrypted tunnel, no port forwarding)
- **No subscription, no data leaves your network**
- **Full privacy** - code never touches external servers

### 2. "Session Consciousness" (UNIQUE FEATURE)
Build awareness of Claude Code's state into the terminal:
- Detect when Claude is **thinking** vs. **waiting for input**
- **Smart notification timing** (notify on question, not on typing)
- **Progress indicators** for long-running tasks
- Visual distinction between Claude output and terminal output
- **No competitor has AI-state-aware terminal UI**

### 3. "Offline-First Input Architecture" (FROM MOSH)
Implement input queuing that survives disconnection:
- Type commands while offline
- Queue persists to IndexedDB
- Replay on reconnection with conflict resolution
- Visual indicator showing queued inputs
- **No competitor offers this for AI agent sessions**

### 4. "PWA That Feels Native" (PROVE THE SKEPTICS WRONG)
Build the definitive PWA terminal experience:
- Custom canvas renderer (not xterm.js)
- iOS keyboard handling that actually works
- Platform-specific gesture adapters
- 60fps scrolling on iPhone 12+
- **Reference implementation for web terminals**

### 5. "tmux-Native Multi-Session" (FROM AGENTUS)
Leverage existing tmux sessions:
- See all tmux sessions on your Mac
- Switch between Claude instances instantly
- Create/destroy sessions from phone
- **Unlike Happy which wraps `claude`, we attach to real tmux**

### 6. "Ambient Monitoring Mode" (NEW CONCEPT)
For users who want to monitor, not interact:
- **Read-only view** optimized for glancing
- Large status indicators visible at arm's length
- Notification summary without full terminal
- **Low battery mode** (15fps, minimal updates)
- **No competitor offers a dedicated "check in" mode**

### 7. "Voice-to-Terminal Bridge" (CATCH-UP FEATURE)
Add voice input to match Happy/Termly:
- Use Web Speech API (works in Safari PWA)
- Voice-to-text for input composer
- Optional: Voice commands ("approve", "cancel", "scroll up")
- **Table stakes for 2025 mobile terminal**

---

## Part 3: Ground-Up Rebuild Proposal

### Architecture: "ClaudePod 2.0"

```
┌────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                           │
├────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ TouchCanvas │  │ InputZone   │  │ GestureHub  │  │ StatusBar │ │
│  │ (WebGL)     │  │ (Composer)  │  │ (Unified)   │  │           │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
├─────────┼────────────────┼────────────────┼────────────────┼──────┤
│         │                │                │                │       │
│  ┌──────▼────────────────▼────────────────▼────────────────▼─────┐│
│  │                    TERMINAL CORE                               ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ ││
│  │  │ VirtualGrid  │  │ ANSIParser   │  │ SelectionManager     │ ││
│  │  │ (windowed)   │  │ (streaming)  │  │ (touch-aware)        │ ││
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ ││
│  └───────────────────────────────────────────────────────────────┘│
├────────────────────────────────────────────────────────────────────┤
│                       CONNECTION LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ WSConnection │  │ OfflineQueue │  │ StateSynchronizer        │ │
│  │ (resilient)  │  │ (IndexedDB)  │  │ (CRDT-inspired)          │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
├────────────────────────────────────────────────────────────────────┤
│                        PLATFORM LAYER                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ iOSAdapter   │  │ AndroidAdapt │  │ DesktopAdapter           │ │
│  │ - keyboard   │  │ - keyboard   │  │ - keyboard               │ │
│  │ - gestures   │  │ - gestures   │  │ - mouse                  │ │
│  │ - haptics    │  │ - haptics    │  │                          │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Touch-First, Not Touch-Adapted**
   - Design for finger input as primary, keyboard as enhancement
   - Larger hit targets (48px minimum, Apple HIG compliant)
   - Gesture vocabulary designed for terminal operations

2. **Platform-Specific Adapters**
   - Abstract platform differences at low level
   - iOS-specific keyboard handling that works with Safari's quirks
   - Android-specific input composition handling

3. **Virtual Rendering**
   - Only render visible lines to DOM
   - WebGL/Canvas for smooth 60fps+ scrolling
   - Lazy loading of history from server

4. **Resilient Connectivity**
   - Offline input queue persisted to IndexedDB
   - Optimistic UI updates
   - Server authoritative with client reconciliation

---

## Part 4: Detailed Technical Specification

### 4.1 Custom Terminal Renderer

Replace xterm.js with a purpose-built renderer:

```typescript
// Conceptual structure
interface TerminalRenderer {
  // Virtual grid - only instantiate visible cells
  grid: VirtualGrid<Cell>;

  // Canvas-based rendering for performance
  canvas: OffscreenCanvas;
  ctx: CanvasRenderingContext2D | WebGL2RenderingContext;

  // Touch-aware selection
  selection: TouchSelection;

  // Render methods
  render(viewport: Viewport): void;
  scrollTo(line: number, smooth?: boolean): void;

  // Input handling
  handleTouchStart(e: TouchEvent): void;
  handleTouchMove(e: TouchEvent): void;
  handleTouchEnd(e: TouchEvent): void;
}
```

**Key Features:**
- **VirtualGrid**: Only allocate memory for visible rows + buffer
- **Cell pooling**: Reuse cell objects to reduce GC pressure
- **Dirty tracking**: Only repaint changed regions
- **Font atlas**: Pre-render character glyphs for fast blitting

### 4.2 iOS Keyboard Manager

Dedicated iOS keyboard handling:

```typescript
interface iOSKeyboardManager {
  // Track keyboard state without relying on visualViewport
  state: 'hidden' | 'appearing' | 'visible' | 'disappearing';

  // Measured keyboard height (not estimated)
  measuredHeight: number;

  // Handle iOS-specific quirks
  handleFocusIn(input: HTMLElement): void;
  handleFocusOut(input: HTMLElement): void;

  // Workaround for PWA keyboard bug
  forceKeyboardRecovery(): Promise<void>;

  // Coordinate with scroll position
  preserveScrollDuringKeyboard(terminal: TerminalRenderer): void;
}
```

**Implementation Strategy:**
1. Use `IntersectionObserver` on input elements as secondary keyboard detection
2. Measure actual keyboard height from input.getBoundingClientRect() changes
3. Animation-frame-synced scroll position preservation
4. Fallback to invisible iframe trick for keyboard recovery

### 4.3 Unified Input System

Single input path that handles all modalities:

```typescript
interface InputSystem {
  // Single text input (always in DOM, position varies)
  composer: InputComposer;

  // Virtual keyboard for special keys
  specialKeyboard: SpecialKeyboard;

  // Gesture recognizer
  gestures: GestureRecognizer;

  // Process and normalize all input
  processInput(event: InputEvent | GestureEvent | KeyEvent): TerminalInput;

  // Queue for offline
  queue: OfflineQueue;
}
```

**Composer Design:**
- Always mounted in DOM (prevents iOS focus bugs)
- Positioned absolutely based on keyboard state
- Handles autocomplete/autocorrect properly
- Broadcasts to terminal via unified event stream

### 4.4 Gesture System

Purpose-built gestures for terminal operations:

| Gesture | Action | Configuration |
|---------|--------|---------------|
| Tap | Position cursor / focus input | Single finger |
| Long press | Text selection start | 500ms threshold |
| Drag (vertical) | Scroll history | Pan-y enabled |
| Drag (horizontal) | Text selection | After long press |
| Swipe left/right | Session switch | Edge-initiated only |
| Pinch | Font size adjust | Two finger |
| Two-finger tap | Context menu | Quick actions |

**Key Difference from Current:**
- Gestures are edge-initiated to avoid conflicts with scrolling
- Selection mode is explicit (long press enters, tap exits)
- Pinch-to-zoom for accessibility

### 4.5 Offline Queue System

```typescript
interface OfflineQueue {
  // IndexedDB-backed queue
  db: IDBDatabase;

  // Queue input when offline
  enqueue(input: TerminalInput): Promise<void>;

  // Replay on reconnection
  replay(connection: WSConnection): Promise<void>;

  // Conflict resolution
  reconcile(serverState: BufferState, localQueue: TerminalInput[]): void;
}
```

**Behavior:**
1. All input goes through queue (hot path optimization for online)
2. When offline, inputs are persisted to IndexedDB
3. On reconnect, queue replays with timestamps
4. Server reconciles based on timestamps (last-write-wins for most operations)

### 4.6 Session Management Redesign

```typescript
interface SessionManager {
  // Active sessions with local state
  sessions: Map<string, SessionState>;

  // Quick switch with state preservation
  switchSession(name: string): Promise<void>;

  // Background polling for session list
  pollInterval: number;

  // Multi-session view (future: split panes)
  layout: SessionLayout;
}

interface SessionState {
  name: string;
  label?: string;
  buffer: VirtualBuffer;
  scrollPosition: number;
  cursorPosition: Position;
  lastActivity: Date;
  notifications: boolean;
}
```

---

## Part 5: Implementation Roadmap (Competitive-Adjusted)

### Phase 1: Foundation - "PWA That Works"
**Goal:** Reliable iOS keyboard and basic terminal

| Task | Priority | Competitive Impact |
|------|----------|-------------------|
| iOS keyboard manager with recovery | P0 | Parity with native apps |
| Custom canvas terminal renderer | P0 | Replace buggy xterm.js |
| Basic ANSI parsing | P0 | Core functionality |
| WebSocket connection (reuse server) | P0 | No changes needed |
| Touch scrolling with momentum | P1 | Match native feel |

### Phase 2: Differentiation - "Zero-Infrastructure"
**Goal:** Emphasize self-hosted advantage

| Task | Priority | Competitive Impact |
|------|----------|-------------------|
| tmux session switching | P0 | Unique vs Happy/Termly |
| Push notifications on Claude prompt | P0 | Parity with Happy |
| Session state indicator (thinking/waiting) | P1 | **Unique feature** |
| Tailscale-aware connection handling | P1 | Smooth reconnection |

### Phase 3: Reliability - "Offline-First"
**Goal:** Input queuing that survives disconnection

| Task | Priority | Competitive Impact |
|------|----------|-------------------|
| IndexedDB offline queue | P0 | **Unique feature** |
| Optimistic UI updates | P1 | Better UX |
| Queue replay on reconnection | P0 | Complete the feature |
| Visual indicator for queued inputs | P1 | User confidence |

### Phase 4: Catch-Up - "Voice & Gestures"
**Goal:** Match Happy/Termly voice, add gestures

| Task | Priority | Competitive Impact |
|------|----------|-------------------|
| Web Speech API voice input | P0 | Parity with competitors |
| Edge-swipe session switching | P1 | Gesture vocabulary |
| Pinch-to-zoom font | P2 | Accessibility |
| Context menu (two-finger tap) | P2 | Power users |

### Phase 5: Innovation - "Ambient Mode"
**Goal:** Differentiate with monitoring-focused view

| Task | Priority | Competitive Impact |
|------|----------|-------------------|
| Read-only ambient monitoring mode | P1 | **Unique feature** |
| Large status indicators | P1 | Glanceable |
| Low battery mode (15fps) | P2 | NewTerm 3 pattern |
| Notification summary view | P2 | Quick check-in |

### Phase 6: Advanced - "Multi-Agent"
**Goal:** AgentOS-level power on mobile

| Task | Priority | Competitive Impact |
|------|----------|-------------------|
| 2-pane split view | P1 | AgentOS for mobile |
| Quick action customization | P2 | Power users |
| Theme system overhaul | P2 | Polish |
| Performance profiling (60fps target) | P1 | Quality bar |

### Priority Summary

**Must-Have (Phases 1-2):**
1. iOS keyboard that works 100%
2. Custom canvas renderer
3. tmux session switching
4. Push notifications
5. Session state awareness

**Should-Have (Phases 3-4):**
6. Offline input queue
7. Voice input
8. Gesture system
9. Queue replay

**Nice-to-Have (Phases 5-6):**
10. Ambient monitoring mode
11. 2-pane split view
12. Theme system
13. Performance optimization

---

## Part 6: Technology Choices

### Keep from Current Implementation
- **Express.js server** - solid, no issues
- **node-pty + tmux** - reliable session management
- **WebSocket protocol** - efficient, works well
- **RingBuffer for server-side history** - good pattern
- **Service Worker for PWA** - keep but improve cache strategy

### Replace
| Current | Replacement | Reason |
|---------|-------------|--------|
| xterm.js | Custom Canvas renderer | Mobile touch support |
| Hammer.js | Custom GestureRecognizer | Terminal-specific needs |
| localStorage for drafts | IndexedDB | Larger quota, structured data |
| CSS-based keyboard detection | Platform adapters | More reliable |
| prompt() dialogs | Custom modal system | PWA compatibility |

### Add New
- **Web Workers** for ANSI parsing off main thread
- **IndexedDB** for offline queue and large data
- **Pointer Events API** for unified touch/mouse
- **ResizeObserver** (already partial) for layout
- **Performance Observer** for FPS monitoring

---

## Part 7: Migration Strategy

### Parallel Development
1. Build new terminal as separate module
2. Test independently with mock data
3. Integrate with existing server
4. A/B test with power users
5. Gradual rollout

### Data Migration
- Server-side buffer format unchanged
- Client-side localStorage preferences migrate to IndexedDB
- Session metadata format unchanged

### Backwards Compatibility
- Keep old UI accessible at `/legacy` during transition
- Same WebSocket protocol (no server changes initially)
- Same API endpoints

---

## Part 8: Success Metrics

### Performance Targets
- 60fps scrolling on iPhone 12+
- <100ms input latency
- <2s cold start to interactive
- <50MB memory footprint

### Reliability Targets
- Keyboard appears 100% of time when input focused
- Zero dropped inputs (online or offline)
- Automatic recovery from all connection failures

### Usability Targets
- Single-hand operation possible
- No accidental gesture triggers
- Accessible with VoiceOver

---

## Conclusion

The current ClaudePod has a solid server architecture but fundamental client-side limitations rooted in xterm.js's desktop-first design. After analyzing 15+ competing solutions, a clear opportunity emerges:

**ClaudePod can be the definitive open-source, self-hosted, privacy-first mobile terminal for Claude Code.**

### Why ClaudePod Will Win

| Advantage | vs Happy/Termly | vs AgentOS | vs Termius/Blink |
|-----------|----------------|------------|------------------|
| **Self-hosted** | No relay servers | Same | N/A (different use case) |
| **PWA** | Same | Yes (web-only) | Native only |
| **AI-aware** | Planned | Similar | No |
| **Offline queue** | Unique | No | Mosh only |
| **Open source** | Same | Same | No (mostly) |
| **Privacy** | Better (no relay) | Same | Varies |

### Target User

> A developer who runs Claude Code on their Mac and wants to monitor/approve it from their iPhone while away from their desk. They're privacy-conscious, technical enough to self-host, and don't want their code routing through third-party servers.

### Non-Target Users (Better Served Elsewhere)

- **General SSH users:** Use Termius, Blink Shell, or Prompt 3
- **Local terminal users:** Use a-Shell or iSH
- **Relay-accepting users:** Happy Coder is easier to set up
- **Android users:** Not supported yet

### Final Recommendation

1. **Rebuild the client** with custom canvas renderer and iOS keyboard handling
2. **Keep the server** - it's solid and differentiated (tmux-native)
3. **Add competitive features** - voice, offline queue, session awareness
4. **Own the niche** - "self-hosted Claude Code mobile"

The result would be a genuinely production-quality mobile terminal that proves PWAs can compete with native apps, while serving the privacy-conscious developer community.

---

## Appendix: Reference Links

### Direct Competitors
- [Happy Coder](https://github.com/slopus/happy) - MIT licensed Claude Code mobile client
- [Termly](https://termly.dev/) - Voice interface for terminal AI tools
- [AgentOS](https://github.com/saadnvd1/agent-os) - Multi-pane AI session management

### Premium SSH Terminals
- [Termius](https://termius.com/) - Cross-platform SSH with AI integration
- [Blink Shell](https://blink.sh/) - Mosh + VS Code on iOS
- [La Terminal](https://la-terminal.net/) - Native touch SSH with AI copilot
- [Prompt 3](https://panic.com/prompt/) - Panic's GPU-accelerated terminal
- [Secure ShellFish](https://secureshellfish.app/) - iOS Files app integration

### Local Terminals
- [a-Shell](https://holzschu.github.io/a-Shell_iOS/) - Python/JS/C locally on iOS
- [iSH](https://ish.app/) - x86 Linux emulation
- [NewTerm 3](https://github.com/hbang/NewTerm) - 120fps jailbreak terminal
- [Termux](https://termux.dev/) - Full Linux on Android

### Technical References
- [xterm.js Mobile Touch Issues](https://github.com/xtermjs/xterm.js/issues/5377)
- [iOS Safari PWA Keyboard Bug](https://discussions.apple.com/thread/253685039)
- [Mobile UX Best Practices 2025](https://uxcam.com/blog/mobile-ux/)
