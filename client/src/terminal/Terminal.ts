/**
 * Terminal - Main terminal component
 *
 * Combines VirtualGrid, ANSIParser, and Renderer into a cohesive terminal
 * with touch support, scroll handling, and connection management.
 */

import { VirtualGrid, VirtualGridOptions } from './VirtualGrid';
import { ANSIParser } from './ANSIParser';
import { Renderer, RendererOptions, TerminalTheme, DEFAULT_THEME } from './Renderer';
import { EventEmitter } from '../utils/EventEmitter';

export interface TerminalOptions {
  container: HTMLElement;
  cols?: number;
  rows?: number;
  scrollback?: number;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  theme?: TerminalTheme;
}

interface TerminalEvents {
  data: string;           // User input data
  resize: { cols: number; rows: number };
  title: string;          // Terminal title changed
  bell: void;             // Bell/alert
  scroll: number;         // Scroll offset changed
}

export class Terminal extends EventEmitter<TerminalEvents> {
  private grid: VirtualGrid;
  private parser: ANSIParser;
  private renderer: Renderer;

  // Animation frame for rendering
  private rafId: number | null = null;
  private needsRender = false;

  // Touch handling
  private touchState: {
    startX: number;
    startY: number;
    startTime: number;
    lastY: number;
    velocity: number;
    isScrolling: boolean;
  } | null = null;

  // Momentum scrolling
  private momentumId: number | null = null;

  constructor(options: TerminalOptions) {
    super();

    // Initialize grid with default or specified dimensions
    const gridOptions: VirtualGridOptions = {
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      scrollback: options.scrollback ?? 10000
    };

    this.grid = new VirtualGrid(gridOptions);
    this.parser = new ANSIParser(this.grid);

    // Initialize renderer
    const rendererOptions: RendererOptions = {
      container: options.container,
      fontFamily: options.fontFamily,
      fontSize: options.fontSize,
      lineHeight: options.lineHeight,
      theme: options.theme
    };

    this.renderer = new Renderer(rendererOptions);

    // Handle renderer resize
    this.renderer.on('resize', ({ cols, rows }) => {
      this.grid.resize(cols, rows);
      this.emit('resize', { cols, rows });
      this.scheduleRender();
    });

    // Setup touch handling
    this.setupTouchHandling(options.container);

    // Setup keyboard handling
    this.setupKeyboardHandling(options.container);

    // Start render loop
    this.startRenderLoop();
  }

  /**
   * Write data to terminal
   */
  write(data: string): void {
    this.parser.parse(data);
    this.scheduleRender();
  }

  /**
   * Schedule a render on next animation frame
   */
  private scheduleRender(): void {
    this.needsRender = true;
  }

  /**
   * Start render loop
   */
  private startRenderLoop(): void {
    const loop = () => {
      if (this.needsRender) {
        this.renderer.render(this.grid);
        this.needsRender = false;
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Setup touch handling for scrolling
   */
  private setupTouchHandling(container: HTMLElement): void {
    container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    container.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    container.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: true });

    // Mouse wheel for desktop
    container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length !== 1) return;

    // Stop any momentum scrolling
    this.stopMomentum();

    const touch = e.touches[0];
    this.touchState = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      lastY: touch.clientY,
      velocity: 0,
      isScrolling: false
    };
  }

  private handleTouchMove(e: TouchEvent): void {
    if (!this.touchState || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaY = this.touchState.lastY - touch.clientY;
    const deltaX = touch.clientX - this.touchState.startX;

    // Determine if scrolling vertically
    if (!this.touchState.isScrolling) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
        this.touchState.isScrolling = true;
      }
    }

    if (this.touchState.isScrolling) {
      e.preventDefault();

      // Calculate velocity
      const now = Date.now();
      const dt = now - this.touchState.startTime;
      if (dt > 0) {
        this.touchState.velocity = deltaY / dt * 16; // Approximate velocity per frame
      }

      // Scroll
      const lines = deltaY / this.renderer.cellHeight;
      this.scroll(lines);

      this.touchState.lastY = touch.clientY;
      this.touchState.startTime = now;
    }
  }

  private handleTouchEnd(_e: TouchEvent): void {
    if (!this.touchState) return;

    if (this.touchState.isScrolling && Math.abs(this.touchState.velocity) > 0.5) {
      // Start momentum scrolling
      this.startMomentum(this.touchState.velocity);
    }

    this.touchState = null;
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();

    // Normalize delta
    let delta = e.deltaY;
    if (e.deltaMode === 1) { // Line mode
      delta *= this.renderer.cellHeight;
    } else if (e.deltaMode === 2) { // Page mode
      delta *= this.renderer.rows * this.renderer.cellHeight;
    }

    const lines = delta / this.renderer.cellHeight;
    this.scroll(lines);
  }

  /**
   * Scroll by lines (positive = down/back in history, negative = up/forward)
   */
  scroll(lines: number): void {
    const maxScroll = this.grid.getScrollbackSize();
    const newOffset = Math.max(0, Math.min(maxScroll, this.renderer.scrollOffset + lines));

    if (newOffset !== this.renderer.scrollOffset) {
      this.renderer.setScrollOffset(newOffset);
      this.emit('scroll', newOffset);
      this.scheduleRender();
    }
  }

  /**
   * Scroll to bottom (live view)
   */
  scrollToBottom(): void {
    this.renderer.setScrollOffset(0);
    this.emit('scroll', 0);
    this.scheduleRender();
  }

  /**
   * Scroll to top (oldest history)
   */
  scrollToTop(): void {
    const maxScroll = this.grid.getScrollbackSize();
    this.renderer.setScrollOffset(maxScroll);
    this.emit('scroll', maxScroll);
    this.scheduleRender();
  }

  /**
   * Start momentum scrolling
   */
  private startMomentum(initialVelocity: number): void {
    this.stopMomentum();

    let velocity = initialVelocity;
    const friction = 0.95;

    const animate = () => {
      if (Math.abs(velocity) < 0.1) {
        this.momentumId = null;
        return;
      }

      this.scroll(velocity);
      velocity *= friction;

      this.momentumId = requestAnimationFrame(animate);
    };

    this.momentumId = requestAnimationFrame(animate);
  }

  /**
   * Stop momentum scrolling
   */
  private stopMomentum(): void {
    if (this.momentumId !== null) {
      cancelAnimationFrame(this.momentumId);
      this.momentumId = null;
    }
  }

  /**
   * Setup keyboard handling
   */
  private setupKeyboardHandling(container: HTMLElement): void {
    // Make container focusable
    container.tabIndex = 0;
    container.style.outline = 'none';

    container.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Scroll to bottom on any key press
    if (this.renderer.scrollOffset > 0) {
      this.scrollToBottom();
    }

    let data = '';

    // Handle special keys
    if (e.key === 'Enter') {
      data = '\r';
    } else if (e.key === 'Backspace') {
      data = '\x7f';
    } else if (e.key === 'Tab') {
      data = '\t';
      e.preventDefault();
    } else if (e.key === 'Escape') {
      data = '\x1b';
    } else if (e.key === 'ArrowUp') {
      data = '\x1b[A';
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      data = '\x1b[B';
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      data = '\x1b[C';
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      data = '\x1b[D';
      e.preventDefault();
    } else if (e.key === 'Home') {
      data = '\x1b[H';
      e.preventDefault();
    } else if (e.key === 'End') {
      data = '\x1b[F';
      e.preventDefault();
    } else if (e.key === 'PageUp') {
      if (e.shiftKey) {
        // Scroll back in history
        this.scroll(this.renderer.rows);
        e.preventDefault();
        return;
      }
      data = '\x1b[5~';
      e.preventDefault();
    } else if (e.key === 'PageDown') {
      if (e.shiftKey) {
        // Scroll forward in history
        this.scroll(-this.renderer.rows);
        e.preventDefault();
        return;
      }
      data = '\x1b[6~';
      e.preventDefault();
    } else if (e.key === 'Delete') {
      data = '\x1b[3~';
    } else if (e.key === 'Insert') {
      data = '\x1b[2~';
    } else if (e.ctrlKey && e.key.length === 1) {
      // Ctrl + letter
      const code = e.key.toUpperCase().charCodeAt(0);
      if (code >= 65 && code <= 90) {
        data = String.fromCharCode(code - 64);
        e.preventDefault();
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Regular character
      data = e.key;
    }

    if (data) {
      this.emit('data', data);
    }
  }

  /**
   * Input data (for external input like touch keyboard)
   */
  input(data: string): void {
    // Scroll to bottom
    if (this.renderer.scrollOffset > 0) {
      this.scrollToBottom();
    }

    this.emit('data', data);
  }

  /**
   * Get terminal dimensions
   */
  getDimensions(): { cols: number; rows: number } {
    return {
      cols: this.grid.cols,
      rows: this.grid.rows
    };
  }

  /**
   * Get current scroll position
   */
  getScrollInfo(): { offset: number; max: number } {
    return {
      offset: this.renderer.scrollOffset,
      max: this.grid.getScrollbackSize()
    };
  }

  /**
   * Set font size
   */
  setFontSize(size: number): void {
    this.renderer.setFontSize(size);
  }

  /**
   * Set theme
   */
  setTheme(theme: TerminalTheme): void {
    this.renderer.setTheme(theme);
    this.scheduleRender();
  }

  /**
   * Clear terminal
   */
  clear(): void {
    this.grid.eraseScreen();
    this.grid.moveCursor(0, 0);
    this.scheduleRender();
  }

  /**
   * Reset terminal
   */
  reset(): void {
    this.grid.eraseScreen();
    this.grid.moveCursor(0, 0);
    this.grid.resetAttributes();
    this.grid.resetScrollRegion();
    this.renderer.setScrollOffset(0);
    this.scheduleRender();
  }

  /**
   * Focus terminal
   */
  focus(): void {
    this.renderer['canvas'].parentElement?.focus();
  }

  /**
   * Resize terminal
   */
  resize(cols: number, rows: number): void {
    this.grid.resize(cols, rows);
    this.scheduleRender();
    this.emit('resize', { cols, rows });
  }

  /**
   * Get cursor position
   */
  getCursorPosition(): { x: number; y: number } {
    return { x: this.grid.cursorX, y: this.grid.cursorY };
  }

  /**
   * Get visible text content
   */
  getVisibleText(): string {
    const lines: string[] = [];
    for (let row = 0; row < this.grid.rows; row++) {
      const line = this.grid.getLine(row);
      if (line) {
        let text = '';
        for (const cell of line) {
          text += cell.char;
        }
        lines.push(text.trimEnd());
      } else {
        lines.push('');
      }
    }
    return lines.join('\n');
  }

  /**
   * Destroy terminal
   */
  destroy(): void {
    this.stopMomentum();

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.renderer.destroy();
    this.removeAllListeners();
  }
}

// Re-export types
export { TerminalTheme, DEFAULT_THEME };
