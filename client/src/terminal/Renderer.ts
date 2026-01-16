/**
 * Canvas-based Terminal Renderer
 *
 * High-performance terminal rendering using HTML5 Canvas.
 * Features:
 * - Dirty region tracking for minimal repaints
 * - Font measurement and caching
 * - Device pixel ratio awareness for crisp text
 * - Theme support with 256-color palette
 */

import { VirtualGrid, Cell, CellAttrs, DEFAULT_FG, DEFAULT_BG } from './VirtualGrid';
import { ANSI_COLORS } from './ANSIParser';
import { EventEmitter } from '../utils/EventEmitter';

export interface TerminalTheme {
  name: string;
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const DEFAULT_THEME: TerminalTheme = {
  name: 'default',
  background: '#0a0a0a',
  foreground: '#e0e0e0',
  cursor: '#ffffff',
  cursorAccent: '#000000',
  selection: 'rgba(255, 255, 255, 0.3)',
  black: '#000000',
  red: '#cd0000',
  green: '#00cd00',
  yellow: '#cdcd00',
  blue: '#0000ee',
  magenta: '#cd00cd',
  cyan: '#00cdcd',
  white: '#e5e5e5',
  brightBlack: '#7f7f7f',
  brightRed: '#ff0000',
  brightGreen: '#00ff00',
  brightYellow: '#ffff00',
  brightBlue: '#5c5cff',
  brightMagenta: '#ff00ff',
  brightCyan: '#00ffff',
  brightWhite: '#ffffff',
};

export interface RendererOptions {
  container: HTMLElement;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  theme?: TerminalTheme;
}

interface RendererEvents {
  resize: { cols: number; rows: number };
  click: { col: number; row: number; x: number; y: number };
}

export class Renderer extends EventEmitter<RendererEvents> {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private fontFamily: string;
  private fontSize: number;
  private lineHeight: number;
  private theme: TerminalTheme;

  // Calculated dimensions
  cellWidth = 0;
  cellHeight = 0;
  cols = 0;
  rows = 0;

  // Device pixel ratio for crisp rendering
  private dpr = 1;

  // Dirty tracking
  private dirtyLines = new Set<number>();
  private fullRepaint = true;

  // Cursor state
  private cursorVisible = true;
  private cursorBlink = false;
  private cursorBlinkInterval: number | null = null;

  // Selection state
  private selectionStart: { col: number; row: number } | null = null;
  private selectionEnd: { col: number; row: number } | null = null;

  // Color cache
  private colorCache = new Map<number, string>();

  // Scroll offset (for scrollback viewing)
  scrollOffset = 0;

  constructor(options: RendererOptions) {
    super();

    this.container = options.container;
    this.fontFamily = options.fontFamily ?? 'JetBrains Mono, Menlo, Monaco, monospace';
    this.fontSize = options.fontSize ?? 14;
    this.lineHeight = options.lineHeight ?? 1.2;
    this.theme = options.theme ?? DEFAULT_THEME;

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);

    // Get context
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }
    this.ctx = ctx;

    // Initialize
    this.measureFont();
    this.setupResizeObserver();
    this.setupEventListeners();
    this.buildColorCache();
  }

  /**
   * Measure font dimensions
   */
  private measureFont(): void {
    this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    const metrics = this.ctx.measureText('M');

    this.cellWidth = Math.ceil(metrics.width);
    this.cellHeight = Math.ceil(this.fontSize * this.lineHeight);

    // Update DPR
    this.dpr = window.devicePixelRatio || 1;
  }

  /**
   * Build color cache from theme
   */
  private buildColorCache(): void {
    this.colorCache.clear();

    // Standard 16 colors from theme
    const themeColors = [
      this.theme.black,
      this.theme.red,
      this.theme.green,
      this.theme.yellow,
      this.theme.blue,
      this.theme.magenta,
      this.theme.cyan,
      this.theme.white,
      this.theme.brightBlack,
      this.theme.brightRed,
      this.theme.brightGreen,
      this.theme.brightYellow,
      this.theme.brightBlue,
      this.theme.brightMagenta,
      this.theme.brightCyan,
      this.theme.brightWhite,
    ];

    for (let i = 0; i < 16; i++) {
      this.colorCache.set(i, themeColors[i]);
    }

    // 216 color cube (colors 16-231)
    for (let r = 0; r < 6; r++) {
      for (let g = 0; g < 6; g++) {
        for (let b = 0; b < 6; b++) {
          const index = 16 + r * 36 + g * 6 + b;
          const red = r ? r * 40 + 55 : 0;
          const green = g ? g * 40 + 55 : 0;
          const blue = b ? b * 40 + 55 : 0;
          this.colorCache.set(index, `rgb(${red},${green},${blue})`);
        }
      }
    }

    // Grayscale (colors 232-255)
    for (let i = 0; i < 24; i++) {
      const gray = i * 10 + 8;
      this.colorCache.set(232 + i, `rgb(${gray},${gray},${gray})`);
    }
  }

  /**
   * Get color string from color code
   */
  private getColor(code: number, isBackground: boolean): string {
    // Default color
    if (code === -1 || code === DEFAULT_FG || code === DEFAULT_BG) {
      return isBackground ? this.theme.background : this.theme.foreground;
    }

    // Cached 256 colors
    const cached = this.colorCache.get(code);
    if (cached) return cached;

    // 24-bit color (256 + RGB value)
    if (code >= 256) {
      const rgb = code - 256;
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = rgb & 0xff;
      return `rgb(${r},${g},${b})`;
    }

    return isBackground ? this.theme.background : this.theme.foreground;
  }

  /**
   * Setup resize observer
   */
  private setupResizeObserver(): void {
    const observer = new ResizeObserver(() => {
      this.handleResize();
    });
    observer.observe(this.container);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.canvas.addEventListener('click', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const col = Math.floor(x / this.cellWidth);
      const row = Math.floor(y / this.cellHeight);
      this.emit('click', { col, row, x, y });
    });
  }

  /**
   * Handle container resize
   */
  private handleResize(): void {
    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Calculate grid size
    const newCols = Math.floor(width / this.cellWidth);
    const newRows = Math.floor(height / this.cellHeight);

    if (newCols !== this.cols || newRows !== this.rows) {
      this.cols = newCols;
      this.rows = newRows;

      // Resize canvas
      this.canvas.width = width * this.dpr;
      this.canvas.height = height * this.dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;

      // Scale context for DPR
      this.ctx.scale(this.dpr, this.dpr);

      // Re-measure font after scale
      this.measureFont();

      // Mark full repaint needed
      this.fullRepaint = true;

      // Emit resize event
      this.emit('resize', { cols: this.cols, rows: this.rows });
    }
  }

  /**
   * Mark a line as dirty (needs repaint)
   */
  markDirty(row: number): void {
    this.dirtyLines.add(row);
  }

  /**
   * Mark all lines as dirty
   */
  markAllDirty(): void {
    this.fullRepaint = true;
  }

  /**
   * Render the terminal
   */
  render(grid: VirtualGrid): void {
    // Check if we need to render
    if (!this.fullRepaint && this.dirtyLines.size === 0) {
      return;
    }

    const ctx = this.ctx;

    if (this.fullRepaint) {
      // Clear entire canvas
      ctx.fillStyle = this.theme.background;
      ctx.fillRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);

      // Render all lines
      for (let row = 0; row < this.rows; row++) {
        this.renderLine(grid, row);
      }

      this.fullRepaint = false;
      this.dirtyLines.clear();
    } else {
      // Render only dirty lines
      for (const row of this.dirtyLines) {
        this.renderLine(grid, row);
      }
      this.dirtyLines.clear();
    }

    // Render cursor
    if (this.cursorVisible && this.scrollOffset === 0) {
      this.renderCursor(grid.cursorX, grid.cursorY);
    }

    // Render selection
    if (this.selectionStart && this.selectionEnd) {
      this.renderSelection();
    }
  }

  /**
   * Render a single line
   */
  private renderLine(grid: VirtualGrid, row: number): void {
    const ctx = this.ctx;
    const y = row * this.cellHeight;
    const adjustedRow = row + this.scrollOffset;

    // Clear line background
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(0, y, this.cols * this.cellWidth, this.cellHeight);

    // Get line data
    const line = adjustedRow >= 0 ? grid.getLine(adjustedRow) : null;

    if (!line) return;

    // Set font
    ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    ctx.textBaseline = 'top';

    // Render each cell
    for (let col = 0; col < this.cols && col < line.length; col++) {
      const cell = line[col];
      const x = col * this.cellWidth;

      // Render background if not default
      let bgColor = this.getColor(cell.bg, true);
      let fgColor = this.getColor(cell.fg, false);

      // Handle inverse
      if (cell.attrs.inverse) {
        [bgColor, fgColor] = [fgColor, bgColor];
      }

      // Render background
      if (bgColor !== this.theme.background) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, this.cellWidth, this.cellHeight);
      }

      // Skip empty cells
      if (cell.char === ' ' || cell.char === '') continue;

      // Apply attributes
      let fontWeight = 'normal';
      let fontStyle = 'normal';

      if (cell.attrs.bold) fontWeight = 'bold';
      if (cell.attrs.italic) fontStyle = 'italic';

      ctx.font = `${fontStyle} ${fontWeight} ${this.fontSize}px ${this.fontFamily}`;

      // Apply dim
      if (cell.attrs.dim) {
        ctx.globalAlpha = 0.5;
      }

      // Render character
      ctx.fillStyle = fgColor;
      ctx.fillText(cell.char, x, y + (this.cellHeight - this.fontSize) / 2);

      // Reset alpha
      ctx.globalAlpha = 1;

      // Render underline
      if (cell.attrs.underline) {
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + this.cellHeight - 2);
        ctx.lineTo(x + this.cellWidth, y + this.cellHeight - 2);
        ctx.stroke();
      }

      // Render strikethrough
      if (cell.attrs.strikethrough) {
        ctx.strokeStyle = fgColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + this.cellHeight / 2);
        ctx.lineTo(x + this.cellWidth, y + this.cellHeight / 2);
        ctx.stroke();
      }
    }
  }

  /**
   * Render cursor
   */
  private renderCursor(col: number, row: number): void {
    const ctx = this.ctx;
    const x = col * this.cellWidth;
    const y = row * this.cellHeight;

    ctx.fillStyle = this.theme.cursor;

    // Block cursor
    ctx.fillRect(x, y, this.cellWidth, this.cellHeight);
  }

  /**
   * Render selection highlight
   */
  private renderSelection(): void {
    if (!this.selectionStart || !this.selectionEnd) return;

    const ctx = this.ctx;
    ctx.fillStyle = this.theme.selection;

    // Normalize selection (start should be before end)
    let startRow = this.selectionStart.row;
    let startCol = this.selectionStart.col;
    let endRow = this.selectionEnd.row;
    let endCol = this.selectionEnd.col;

    if (startRow > endRow || (startRow === endRow && startCol > endCol)) {
      [startRow, endRow] = [endRow, startRow];
      [startCol, endCol] = [endCol, startCol];
    }

    for (let row = startRow; row <= endRow; row++) {
      const y = row * this.cellHeight;
      let xStart = 0;
      let xEnd = this.cols * this.cellWidth;

      if (row === startRow) {
        xStart = startCol * this.cellWidth;
      }
      if (row === endRow) {
        xEnd = (endCol + 1) * this.cellWidth;
      }

      ctx.fillRect(xStart, y, xEnd - xStart, this.cellHeight);
    }
  }

  /**
   * Set selection range
   */
  setSelection(
    start: { col: number; row: number } | null,
    end: { col: number; row: number } | null
  ): void {
    this.selectionStart = start;
    this.selectionEnd = end;
    this.markAllDirty();
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectionStart = null;
    this.selectionEnd = null;
    this.markAllDirty();
  }

  /**
   * Get selected text from grid
   */
  getSelectedText(grid: VirtualGrid): string {
    if (!this.selectionStart || !this.selectionEnd) return '';

    let startRow = this.selectionStart.row;
    let startCol = this.selectionStart.col;
    let endRow = this.selectionEnd.row;
    let endCol = this.selectionEnd.col;

    if (startRow > endRow || (startRow === endRow && startCol > endCol)) {
      [startRow, endRow] = [endRow, startRow];
      [startCol, endCol] = [endCol, startCol];
    }

    const lines: string[] = [];

    for (let row = startRow; row <= endRow; row++) {
      const line = grid.getLine(row);
      if (!line) {
        lines.push('');
        continue;
      }

      const colStart = row === startRow ? startCol : 0;
      const colEnd = row === endRow ? endCol + 1 : this.cols;

      let text = '';
      for (let col = colStart; col < colEnd && col < line.length; col++) {
        text += line[col].char;
      }
      lines.push(text.trimEnd());
    }

    return lines.join('\n');
  }

  /**
   * Start cursor blinking
   */
  startCursorBlink(): void {
    if (this.cursorBlinkInterval) return;

    this.cursorBlink = true;
    this.cursorBlinkInterval = window.setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
      this.markAllDirty();
    }, 530);
  }

  /**
   * Stop cursor blinking
   */
  stopCursorBlink(): void {
    if (this.cursorBlinkInterval) {
      clearInterval(this.cursorBlinkInterval);
      this.cursorBlinkInterval = null;
    }
    this.cursorVisible = true;
    this.cursorBlink = false;
  }

  /**
   * Set font size
   */
  setFontSize(size: number): void {
    this.fontSize = size;
    this.measureFont();
    this.handleResize();
    this.markAllDirty();
  }

  /**
   * Set theme
   */
  setTheme(theme: TerminalTheme): void {
    this.theme = theme;
    this.buildColorCache();
    this.markAllDirty();
  }

  /**
   * Get cell position from pixel coordinates
   */
  getCellFromPoint(x: number, y: number): { col: number; row: number } {
    return {
      col: Math.floor(x / this.cellWidth),
      row: Math.floor(y / this.cellHeight)
    };
  }

  /**
   * Scroll to show scrollback
   */
  setScrollOffset(offset: number): void {
    this.scrollOffset = Math.max(0, offset);
    this.markAllDirty();
  }

  /**
   * Destroy renderer
   */
  destroy(): void {
    this.stopCursorBlink();
    this.canvas.remove();
    this.removeAllListeners();
  }
}
