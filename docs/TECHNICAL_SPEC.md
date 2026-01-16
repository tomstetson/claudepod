# ClaudePod 2.0 Technical Specification

## 1. Project Structure

```
claudepod/
├── server/                      # Backend (largely unchanged)
│   ├── index.js                 # Entry point
│   ├── lib/
│   │   ├── tmux.js
│   │   ├── sessions.js
│   │   ├── buffer.js
│   │   ├── session-store.js
│   │   └── notifications.js
│   └── test/
│
├── client/                      # New frontend
│   ├── src/
│   │   ├── index.ts             # Entry point
│   │   ├── app.ts               # Main application
│   │   │
│   │   ├── terminal/            # Core terminal system
│   │   │   ├── Terminal.ts      # Main terminal class
│   │   │   ├── VirtualGrid.ts   # Virtual cell grid
│   │   │   ├── Renderer.ts      # Canvas/WebGL renderer
│   │   │   ├── ANSIParser.ts    # ANSI escape parser
│   │   │   ├── Buffer.ts        # Client-side buffer
│   │   │   └── Selection.ts     # Touch-aware selection
│   │   │
│   │   ├── input/               # Input system
│   │   │   ├── InputManager.ts  # Unified input coordinator
│   │   │   ├── Composer.ts      # Text input component
│   │   │   ├── SpecialKeys.ts   # Special key panel
│   │   │   └── GestureRecognizer.ts
│   │   │
│   │   ├── platform/            # Platform adapters
│   │   │   ├── PlatformAdapter.ts   # Base interface
│   │   │   ├── iOSAdapter.ts        # iOS-specific
│   │   │   ├── AndroidAdapter.ts    # Android-specific
│   │   │   └── DesktopAdapter.ts    # Desktop fallback
│   │   │
│   │   ├── connection/          # Network layer
│   │   │   ├── WSConnection.ts  # WebSocket manager
│   │   │   ├── OfflineQueue.ts  # IndexedDB queue
│   │   │   └── StateSync.ts     # State reconciliation
│   │   │
│   │   ├── session/             # Session management
│   │   │   ├── SessionManager.ts
│   │   │   ├── SessionState.ts
│   │   │   └── SessionSwitcher.ts
│   │   │
│   │   ├── ui/                  # UI components
│   │   │   ├── Header.ts
│   │   │   ├── StatusBar.ts
│   │   │   ├── QuickActions.ts
│   │   │   ├── Modal.ts
│   │   │   ├── CommandPalette.ts
│   │   │   └── DirectoryBrowser.ts
│   │   │
│   │   └── utils/               # Utilities
│   │       ├── EventEmitter.ts
│   │       ├── db.ts            # IndexedDB helpers
│   │       └── theme.ts
│   │
│   ├── styles/
│   │   ├── main.css
│   │   ├── terminal.css
│   │   └── components/
│   │
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json
│   │   ├── sw.ts               # Service worker
│   │   └── icons/
│   │
│   └── test/
│
├── shared/                      # Shared types/constants
│   └── types.ts
│
└── package.json
```

---

## 2. Core Terminal System

### 2.1 VirtualGrid

```typescript
// client/src/terminal/VirtualGrid.ts

interface Cell {
  char: string;
  fg: number;          // Foreground color index
  bg: number;          // Background color index
  attrs: CellAttrs;    // Bold, italic, underline, etc.
}

interface CellAttrs {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  inverse: boolean;
  blink: boolean;
  dim: boolean;
}

interface VirtualGridOptions {
  cols: number;
  rows: number;
  scrollback: number;  // Max scrollback lines
  poolSize: number;    // Cell pool size
}

class VirtualGrid {
  private lines: Map<number, Cell[]>;  // Sparse line storage
  private linePool: Cell[][];          // Recycled line arrays
  private cellPool: Cell[];            // Recycled cell objects

  // Viewport tracking
  private viewportStart: number;
  private viewportEnd: number;

  // Cursor position
  cursor: { x: number; y: number };

  // Methods
  getLine(index: number): Cell[] | null;
  setCell(x: number, y: number, cell: Partial<Cell>): void;
  scroll(delta: number): void;
  resize(cols: number, rows: number): void;

  // Memory management
  trimScrollback(): void;
  recycleLine(index: number): void;

  // Range access for rendering
  getVisibleLines(start: number, count: number): (Cell[] | null)[];
}
```

**Key Design Decisions:**
- **Sparse storage**: Only allocate memory for lines that have content
- **Object pooling**: Reuse Cell objects to reduce GC
- **Viewport tracking**: Know exactly which lines need rendering

### 2.2 Canvas Renderer

```typescript
// client/src/terminal/Renderer.ts

interface RendererOptions {
  canvas: HTMLCanvasElement;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  theme: TerminalTheme;
  devicePixelRatio: number;
}

class Renderer {
  private ctx: CanvasRenderingContext2D;
  private offscreen: OffscreenCanvas;
  private fontAtlas: FontAtlas;
  private dirty: DirtyTracker;

  // Dimensions
  cellWidth: number;
  cellHeight: number;
  cols: number;
  rows: number;

  // Methods
  render(grid: VirtualGrid): void;
  renderLine(lineIndex: number, cells: Cell[]): void;
  renderCursor(x: number, y: number, style: CursorStyle): void;
  renderSelection(selection: Selection): void;

  // Font management
  measureFont(): { width: number; height: number };
  setFontSize(size: number): void;

  // Lifecycle
  resize(width: number, height: number): void;
  destroy(): void;
}

class FontAtlas {
  private atlas: ImageBitmap;
  private charMap: Map<string, { x: number; y: number }>;

  // Pre-render common characters
  prerender(chars: string): void;

  // Get character position in atlas
  getChar(char: string, attrs: CellAttrs): { x: number; y: number };

  // Draw character from atlas
  drawChar(
    ctx: CanvasRenderingContext2D,
    char: string,
    x: number,
    y: number,
    attrs: CellAttrs
  ): void;
}

class DirtyTracker {
  private dirtyLines: Set<number>;
  private fullRepaint: boolean;

  markLine(index: number): void;
  markAll(): void;
  getDirtyLines(): number[];
  clear(): void;
}
```

**Performance Optimizations:**
- **Font atlas**: Pre-render characters to bitmap, blit instead of drawText
- **Dirty tracking**: Only repaint changed lines
- **Offscreen canvas**: Render to offscreen, then copy to visible
- **Device pixel ratio**: Render at native resolution for crispness

### 2.3 ANSI Parser

```typescript
// client/src/terminal/ANSIParser.ts

interface ParsedSegment {
  type: 'text' | 'csi' | 'osc' | 'escape';
  content: string;
  params?: number[];
}

class ANSIParser {
  private state: ParserState;
  private buffer: string;
  private params: number[];

  // Main parsing method
  parse(data: string): ParsedSegment[];

  // State machine handlers
  private handleGround(char: string): void;
  private handleEscape(char: string): void;
  private handleCSI(char: string): void;
  private handleOSC(char: string): void;

  // Apply parsed commands to grid
  applyToGrid(segments: ParsedSegment[], grid: VirtualGrid): void;

  // CSI command handlers
  private handleCursorUp(n: number): void;
  private handleCursorDown(n: number): void;
  private handleCursorForward(n: number): void;
  private handleCursorBack(n: number): void;
  private handleEraseInLine(n: number): void;
  private handleEraseInDisplay(n: number): void;
  private handleSGR(params: number[]): void;  // Colors/attributes
}
```

**Design Notes:**
- Consider running parser in Web Worker for heavy output
- Streaming design - can process partial ANSI sequences
- Full SGR (Select Graphic Rendition) support for colors

---

## 3. Input System

### 3.1 InputManager

```typescript
// client/src/input/InputManager.ts

type InputEvent =
  | { type: 'char'; char: string }
  | { type: 'key'; key: string; modifiers: Modifiers }
  | { type: 'paste'; text: string }
  | { type: 'gesture'; gesture: GestureEvent };

interface Modifiers {
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
  shift: boolean;
}

class InputManager extends EventEmitter<{
  input: (event: InputEvent) => void;
  focusChange: (focused: boolean) => void;
}> {
  private composer: Composer;
  private specialKeys: SpecialKeys;
  private gestureRecognizer: GestureRecognizer;
  private platform: PlatformAdapter;

  // Unified input processing
  processInput(event: InputEvent): string | null {
    // Convert InputEvent to terminal escape sequence
    // Returns null if event should be ignored
  }

  // Focus management
  focus(): void;
  blur(): void;
  isFocused(): boolean;

  // Keyboard state
  isKeyboardVisible(): boolean;
  showKeyboard(): void;
  hideKeyboard(): void;
}
```

### 3.2 Composer (Text Input)

```typescript
// client/src/input/Composer.ts

interface ComposerOptions {
  element: HTMLTextAreaElement;
  platform: PlatformAdapter;
  multiline: boolean;
  maxLength: number;
}

class Composer extends EventEmitter<{
  submit: (text: string) => void;
  input: (text: string) => void;
  focus: () => void;
  blur: () => void;
}> {
  private element: HTMLTextAreaElement;
  private composing: boolean;  // IME composition in progress

  // Handle composition events (IME, autocomplete)
  private handleCompositionStart(): void;
  private handleCompositionUpdate(data: string): void;
  private handleCompositionEnd(data: string): void;

  // Handle regular input
  private handleInput(e: InputEvent): void;
  private handleKeyDown(e: KeyboardEvent): void;

  // Public API
  getValue(): string;
  setValue(value: string): void;
  clear(): void;
  focus(): void;
  blur(): void;

  // Positioning (for keyboard-aware layout)
  setPosition(rect: DOMRect): void;
}
```

**Critical iOS Fixes:**
- Always keep textarea in DOM (mounting/unmounting causes keyboard issues)
- Use `inputmode` attribute appropriately
- Handle `compositionstart`/`compositionend` for predictive text
- Don't prevent default on input events

### 3.3 GestureRecognizer

```typescript
// client/src/input/GestureRecognizer.ts

type GestureEvent =
  | { type: 'tap'; x: number; y: number }
  | { type: 'longPress'; x: number; y: number }
  | { type: 'pan'; deltaX: number; deltaY: number; velocity: number }
  | { type: 'swipe'; direction: 'left' | 'right' | 'up' | 'down' }
  | { type: 'pinch'; scale: number; center: { x: number; y: number } }
  | { type: 'twoFingerTap'; x: number; y: number };

interface GestureConfig {
  tapTimeout: number;           // Max duration for tap (300ms)
  longPressThreshold: number;   // Duration for long press (500ms)
  swipeThreshold: number;       // Min distance for swipe (50px)
  swipeVelocity: number;        // Min velocity for swipe
  edgeWidth: number;            // Edge zone width for edge swipes (20px)
}

class GestureRecognizer extends EventEmitter<{
  gesture: (event: GestureEvent) => void;
}> {
  private config: GestureConfig;
  private touches: Map<number, TouchState>;
  private state: GestureState;

  // Touch event handlers
  handleTouchStart(e: TouchEvent): void;
  handleTouchMove(e: TouchEvent): void;
  handleTouchEnd(e: TouchEvent): void;
  handleTouchCancel(e: TouchEvent): void;

  // Recognize specific gestures
  private recognizeTap(touch: TouchState): boolean;
  private recognizeLongPress(touch: TouchState): boolean;
  private recognizeSwipe(touch: TouchState): boolean;
  private recognizePinch(touches: TouchState[]): boolean;

  // Edge detection for session switching
  private isEdgeTouch(x: number): 'left' | 'right' | null;
}
```

**Gesture Conflict Resolution:**
- Vertical pan always wins (scrolling is primary)
- Horizontal swipe only from edges
- Long press cancels any pending tap
- Pinch-to-zoom has highest priority when two fingers

---

## 4. Platform Adapters

### 4.1 Base Interface

```typescript
// client/src/platform/PlatformAdapter.ts

interface KeyboardState {
  visible: boolean;
  height: number;
  animating: boolean;
}

interface PlatformAdapter {
  // Platform identification
  readonly platform: 'ios' | 'android' | 'desktop';
  readonly isStandalone: boolean;  // PWA mode
  readonly hasTouchScreen: boolean;

  // Keyboard management
  getKeyboardState(): KeyboardState;
  onKeyboardChange(callback: (state: KeyboardState) => void): () => void;
  forceKeyboardShow(input: HTMLElement): Promise<void>;
  forceKeyboardHide(): Promise<void>;

  // Haptics
  haptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error'): void;

  // Safe areas
  getSafeAreaInsets(): { top: number; bottom: number; left: number; right: number };

  // Scroll behavior
  configureScroll(element: HTMLElement): void;

  // Clipboard
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;

  // Orientation
  getOrientation(): 'portrait' | 'landscape';
  onOrientationChange(callback: (orientation: string) => void): () => void;

  // Power state
  isLowPowerMode(): boolean;
  onLowPowerModeChange(callback: (lowPower: boolean) => void): () => void;
}
```

### 4.2 iOS Adapter

```typescript
// client/src/platform/iOSAdapter.ts

class iOSAdapter implements PlatformAdapter {
  readonly platform = 'ios';
  readonly isStandalone: boolean;
  readonly hasTouchScreen = true;

  private keyboardState: KeyboardState;
  private keyboardObserver: ResizeObserver | null;
  private focusedInput: HTMLElement | null;

  constructor() {
    this.isStandalone = (navigator as any).standalone === true;
    this.keyboardState = { visible: false, height: 0, animating: false };
    this.setupKeyboardDetection();
  }

  private setupKeyboardDetection(): void {
    // Method 1: visualViewport API (when available and working)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this.handleViewportResize);
    }

    // Method 2: Focus tracking as fallback
    document.addEventListener('focusin', this.handleFocusIn);
    document.addEventListener('focusout', this.handleFocusOut);

    // Method 3: Intersection observer on input elements
    // Detects when input scrolls into view (keyboard appearing)
  }

  private handleViewportResize = (): void => {
    // Calculate keyboard height from viewport change
    // Account for URL bar collapse/expand
    // Use requestAnimationFrame to debounce
  };

  async forceKeyboardShow(input: HTMLElement): Promise<void> {
    // iOS PWA keyboard bug workaround
    // 1. Try normal focus
    input.focus();

    // 2. If keyboard doesn't appear, use iframe trick
    await this.waitForKeyboard(500);
    if (!this.keyboardState.visible) {
      await this.iframeKeyboardRecovery(input);
    }
  }

  private async iframeKeyboardRecovery(input: HTMLElement): Promise<void> {
    // Create temporary iframe with input
    // Focus iframe input (forces system keyboard)
    // Transfer focus back to real input
    // Clean up iframe
  }

  haptic(type: HapticType): void {
    // Use navigator.vibrate with iOS-appropriate patterns
    // iOS Safari supports basic vibration
    // Note: More advanced haptics require native app
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30],
        success: [10, 50, 10],
        error: [50, 100, 50]
      };
      navigator.vibrate(patterns[type]);
    }
  }

  configureScroll(element: HTMLElement): void {
    // Enable smooth momentum scrolling
    element.style.webkitOverflowScrolling = 'touch';
    element.style.overscrollBehavior = 'contain';

    // Prevent rubber-banding at edges
    let startY = 0;
    element.addEventListener('touchstart', (e) => {
      startY = e.touches[0].pageY;
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
      const y = e.touches[0].pageY;
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop >= element.scrollHeight - element.clientHeight;

      if ((atTop && y > startY) || (atBottom && y < startY)) {
        e.preventDefault();
      }
    }, { passive: false });
  }
}
```

---

## 5. Connection Layer

### 5.1 WebSocket Connection

```typescript
// client/src/connection/WSConnection.ts

interface WSConnectionOptions {
  url: string;
  reconnect: boolean;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
  pingInterval: number;
}

class WSConnection extends EventEmitter<{
  connected: () => void;
  disconnected: (reason: string, code: number) => void;
  message: (msg: ServerMessage) => void;
  error: (error: Error) => void;
  reconnecting: (attempt: number) => void;
}> {
  private socket: WebSocket | null;
  private options: WSConnectionOptions;
  private reconnectAttempts: number;
  private pingTimer: number | null;
  private state: ConnectionState;

  // Connection management
  connect(): void;
  disconnect(reason?: string): void;
  reconnect(): void;

  // Message sending
  send(msg: ClientMessage): boolean;
  sendInput(data: string): boolean;
  sendResize(cols: number, rows: number): boolean;
  sendPing(): boolean;
  requestHistory(fromLine: number, count: number): boolean;

  // State
  isConnected(): boolean;
  getState(): ConnectionState;
  getLatency(): number | null;
}
```

### 5.2 Offline Queue

```typescript
// client/src/connection/OfflineQueue.ts

interface QueuedInput {
  id: string;
  timestamp: number;
  sessionName: string;
  type: 'input' | 'resize';
  data: string | { cols: number; rows: number };
}

class OfflineQueue {
  private db: IDBDatabase;
  private processing: boolean;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    const request = indexedDB.open('claudepod', 1);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains('queue')) {
        const store = db.createObjectStore('queue', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
        store.createIndex('sessionName', 'sessionName');
      }
    };
  }

  async enqueue(input: Omit<QueuedInput, 'id' | 'timestamp'>): Promise<void> {
    const item: QueuedInput = {
      ...input,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };

    const tx = this.db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    await store.add(item);
  }

  async getQueue(sessionName: string): Promise<QueuedInput[]> {
    const tx = this.db.transaction('queue', 'readonly');
    const store = tx.objectStore('queue');
    const index = store.index('sessionName');
    return await index.getAll(sessionName);
  }

  async clear(sessionName: string): Promise<void> {
    const items = await this.getQueue(sessionName);
    const tx = this.db.transaction('queue', 'readwrite');
    const store = tx.objectStore('queue');
    for (const item of items) {
      await store.delete(item.id);
    }
  }

  async replay(connection: WSConnection, sessionName: string): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const items = await this.getQueue(sessionName);
      items.sort((a, b) => a.timestamp - b.timestamp);

      for (const item of items) {
        if (item.type === 'input') {
          connection.sendInput(item.data as string);
        } else if (item.type === 'resize') {
          const { cols, rows } = item.data as { cols: number; rows: number };
          connection.sendResize(cols, rows);
        }
        // Small delay between replayed inputs
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await this.clear(sessionName);
    } finally {
      this.processing = false;
    }
  }
}
```

---

## 6. UI Components

### 6.1 Quick Actions Panel

```typescript
// client/src/ui/QuickActions.ts

interface QuickAction {
  id: string;
  label: string;
  icon?: string;
  input?: string;      // Direct terminal input
  key?: string;        // Special key
  action?: () => void; // Custom action
}

const DEFAULT_ACTIONS: QuickAction[] = [
  { id: 'y', label: 'Y', input: 'y' },
  { id: 'n', label: 'N', input: 'n' },
  { id: 'enter', label: '↵', key: 'Enter' },
  { id: 'esc', label: 'Esc', key: 'Escape' },
  { id: 'ctrl-c', label: '^C', input: '\x03' },
  { id: 'menu', label: '⋯', action: () => app.showCommandPalette() }
];

class QuickActions {
  private container: HTMLElement;
  private actions: QuickAction[];
  private onAction: (action: QuickAction) => void;

  constructor(container: HTMLElement, onAction: (action: QuickAction) => void) {
    this.container = container;
    this.actions = DEFAULT_ACTIONS;
    this.onAction = onAction;
    this.render();
    this.setupEventListeners();
  }

  render(): void {
    this.container.innerHTML = this.actions.map(action => `
      <button
        class="quick-btn"
        data-action-id="${action.id}"
        aria-label="${action.label}"
      >
        ${action.icon || action.label}
      </button>
    `).join('');
  }

  setActions(actions: QuickAction[]): void {
    this.actions = actions;
    this.render();
  }
}
```

### 6.2 Custom Modal System (No prompt())

```typescript
// client/src/ui/Modal.ts

interface ModalOptions {
  title: string;
  content: string | HTMLElement;
  buttons: ModalButton[];
  onClose?: () => void;
}

interface ModalButton {
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  onClick: () => void | Promise<void>;
}

interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  validate?: (value: string) => string | null; // Return error or null
}

class Modal {
  private overlay: HTMLElement;
  private modal: HTMLElement;

  static async prompt(options: PromptOptions): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'modal-input';
      input.placeholder = options.placeholder || '';
      input.value = options.defaultValue || '';

      const errorEl = document.createElement('div');
      errorEl.className = 'modal-error';

      const content = document.createElement('div');
      if (options.message) {
        const msg = document.createElement('p');
        msg.textContent = options.message;
        content.appendChild(msg);
      }
      content.appendChild(input);
      content.appendChild(errorEl);

      const modal = new Modal({
        title: options.title,
        content,
        buttons: [
          {
            label: 'Cancel',
            variant: 'secondary',
            onClick: () => {
              modal.close();
              resolve(null);
            }
          },
          {
            label: 'OK',
            variant: 'primary',
            onClick: async () => {
              const value = input.value.trim();
              if (options.validate) {
                const error = options.validate(value);
                if (error) {
                  errorEl.textContent = error;
                  input.focus();
                  return;
                }
              }
              modal.close();
              resolve(value);
            }
          }
        ]
      });

      modal.show();
      input.focus();
    });
  }

  static async confirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new Modal({
        title,
        content: message,
        buttons: [
          {
            label: 'Cancel',
            variant: 'secondary',
            onClick: () => {
              modal.close();
              resolve(false);
            }
          },
          {
            label: 'Confirm',
            variant: 'danger',
            onClick: () => {
              modal.close();
              resolve(true);
            }
          }
        ]
      });
      modal.show();
    });
  }

  show(): void {
    document.body.appendChild(this.overlay);
    requestAnimationFrame(() => {
      this.overlay.classList.add('visible');
    });
  }

  close(): void {
    this.overlay.classList.remove('visible');
    setTimeout(() => {
      this.overlay.remove();
    }, 200);
  }
}
```

---

## 7. Service Worker Strategy

```typescript
// client/public/sw.ts

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `claudepod-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `claudepod-dynamic-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/manifest.json'
];

// Install: Pre-cache static assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
  );
  // Don't wait for old SW - take over immediately
  (self as any).skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map(key => caches.delete(key))
      )
    )
  );
  // Take control of all clients
  (self as any).clients.claim();
});

// Fetch: Network-first for API, Cache-first for static
self.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Skip WebSocket and API requests
  if (url.pathname.startsWith('/terminal/') ||
      url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first for HTML (always get fresh)
  if (event.request.mode === 'navigate' ||
      event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// Background sync for offline queue
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'replay-queue') {
    event.waitUntil(replayOfflineQueue());
  }
});

async function replayOfflineQueue(): Promise<void> {
  // Open IndexedDB, get queued inputs, send to server via fetch
  // This runs when connectivity is restored
}
```

---

## 8. Build Configuration

### package.json (client)

```json
{
  "name": "claudepod-client",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vite-plugin-pwa": "^0.17.0",
    "vitest": "^1.0.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0"
  }
}
```

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    target: 'es2020',
    outDir: '../server/public',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          terminal: ['./src/terminal/Terminal.ts', './src/terminal/Renderer.ts'],
          input: ['./src/input/InputManager.ts', './src/input/GestureRecognizer.ts']
        }
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ClaudePod',
        short_name: 'ClaudePod',
        description: 'Mobile terminal for Claude Code',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate'
          }
        ]
      }
    })
  ]
});
```

---

## 9. Testing Strategy

### Unit Tests

```typescript
// client/test/terminal/VirtualGrid.test.ts
import { describe, it, expect } from 'vitest';
import { VirtualGrid } from '../../src/terminal/VirtualGrid';

describe('VirtualGrid', () => {
  it('should allocate cells on demand', () => {
    const grid = new VirtualGrid({ cols: 80, rows: 24, scrollback: 1000 });
    expect(grid.getLine(0)).toBeNull();

    grid.setCell(0, 0, { char: 'A' });
    expect(grid.getLine(0)?.[0].char).toBe('A');
  });

  it('should recycle lines when scrollback exceeded', () => {
    // ...
  });
});
```

### Integration Tests

```typescript
// client/test/integration/terminal.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Terminal } from '../../src/terminal/Terminal';

describe('Terminal Integration', () => {
  let terminal: Terminal;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    terminal = new Terminal({ container });
  });

  it('should render ANSI colored text', () => {
    terminal.write('\x1b[31mRed\x1b[0m Normal');
    // Check canvas output or virtual grid
  });

  it('should handle touch scrolling', async () => {
    // Simulate touch events
    // Verify scroll position
  });
});
```

### E2E Tests

```typescript
// e2e/mobile.spec.ts (Playwright)
import { test, expect, devices } from '@playwright/test';

test.use(devices['iPhone 13']);

test('should show keyboard on input focus', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#input-composer');
  await page.tap('#input-composer');

  // Check that input has focus
  const focused = await page.evaluate(() =>
    document.activeElement?.id === 'input-composer'
  );
  expect(focused).toBe(true);
});

test('should send input to terminal', async ({ page }) => {
  await page.goto('/');
  // Wait for connection
  await page.waitForSelector('.connection-status.connected');

  // Type in composer
  await page.fill('#input-composer', 'echo hello');
  await page.tap('#send-btn');

  // Verify terminal received input
  // ...
});
```

---

## 10. Migration Checklist

### Phase 1: Foundation
- [ ] Set up new client project structure
- [ ] Implement VirtualGrid
- [ ] Implement Canvas Renderer
- [ ] Implement ANSI Parser
- [ ] Basic terminal rendering works

### Phase 2: Input System
- [ ] Implement InputManager
- [ ] Implement Composer with iOS fixes
- [ ] Implement GestureRecognizer
- [ ] Implement SpecialKeys panel
- [ ] Input works reliably on iOS Safari PWA

### Phase 3: Platform Adapters
- [ ] Implement iOSAdapter
- [ ] Implement AndroidAdapter
- [ ] Implement DesktopAdapter
- [ ] Keyboard detection works across platforms

### Phase 4: Connection Layer
- [ ] Port WSConnection from current implementation
- [ ] Implement OfflineQueue with IndexedDB
- [ ] Implement StateSync
- [ ] Connection resilience tested

### Phase 5: UI Components
- [ ] Implement Modal system (replace prompt())
- [ ] Implement CommandPalette
- [ ] Implement DirectoryBrowser
- [ ] Implement QuickActions
- [ ] Implement Header/StatusBar

### Phase 6: Polish
- [ ] Theme system
- [ ] Settings persistence
- [ ] Performance optimization
- [ ] Memory profiling
- [ ] Battery impact testing

### Phase 7: Launch
- [ ] A/B testing with legacy fallback
- [ ] Documentation
- [ ] User migration guide
- [ ] Remove legacy code

---

This specification provides the technical foundation for a ground-up rebuild that addresses the fundamental mobile limitations of the current implementation.
