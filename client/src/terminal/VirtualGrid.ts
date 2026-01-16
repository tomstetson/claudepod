/**
 * VirtualGrid - Sparse storage for terminal cells
 *
 * Only allocates memory for lines that have content, using object pooling
 * to reduce GC pressure. This enables efficient handling of large scrollback
 * buffers without memory bloat.
 */

export interface CellAttrs {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  inverse: boolean;
  blink: boolean;
  dim: boolean;
}

export interface Cell {
  char: string;
  fg: number;      // Foreground color (0-255 or -1 for default)
  bg: number;      // Background color (0-255 or -1 for default)
  attrs: CellAttrs;
}

export const DEFAULT_ATTRS: CellAttrs = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  inverse: false,
  blink: false,
  dim: false
};

export const DEFAULT_FG = -1;  // Use theme default
export const DEFAULT_BG = -1;  // Use theme default

function createDefaultCell(): Cell {
  return {
    char: ' ',
    fg: DEFAULT_FG,
    bg: DEFAULT_BG,
    attrs: { ...DEFAULT_ATTRS }
  };
}

function copyCell(from: Partial<Cell>, to: Cell): void {
  if (from.char !== undefined) to.char = from.char;
  if (from.fg !== undefined) to.fg = from.fg;
  if (from.bg !== undefined) to.bg = from.bg;
  if (from.attrs) {
    to.attrs.bold = from.attrs.bold ?? to.attrs.bold;
    to.attrs.italic = from.attrs.italic ?? to.attrs.italic;
    to.attrs.underline = from.attrs.underline ?? to.attrs.underline;
    to.attrs.strikethrough = from.attrs.strikethrough ?? to.attrs.strikethrough;
    to.attrs.inverse = from.attrs.inverse ?? to.attrs.inverse;
    to.attrs.blink = from.attrs.blink ?? to.attrs.blink;
    to.attrs.dim = from.attrs.dim ?? to.attrs.dim;
  }
}

export interface VirtualGridOptions {
  cols: number;
  rows: number;
  scrollback: number;  // Maximum scrollback lines to keep
}

export class VirtualGrid {
  private lines = new Map<number, Cell[]>();
  private cellPool: Cell[] = [];
  private linePool: Cell[][] = [];

  cols: number;
  rows: number;
  scrollback: number;

  // Cursor position (0-indexed)
  cursorX = 0;
  cursorY = 0;

  // Scroll region
  scrollTop = 0;
  scrollBottom: number;

  // Current line offset (for scrollback)
  private lineOffset = 0;

  // Track the range of lines that have content
  private minLine = 0;
  private maxLine = 0;

  // Current SGR state
  currentFg = DEFAULT_FG;
  currentBg = DEFAULT_BG;
  currentAttrs: CellAttrs = { ...DEFAULT_ATTRS };

  constructor(options: VirtualGridOptions) {
    this.cols = options.cols;
    this.rows = options.rows;
    this.scrollback = options.scrollback;
    this.scrollBottom = options.rows - 1;
  }

  /**
   * Get absolute line index from relative row
   */
  private absoluteLine(row: number): number {
    return this.lineOffset + row;
  }

  /**
   * Get a line, creating it if necessary
   */
  private getOrCreateLine(lineIndex: number): Cell[] {
    let line = this.lines.get(lineIndex);
    if (!line) {
      line = this.allocateLine();
      this.lines.set(lineIndex, line);
      this.minLine = Math.min(this.minLine, lineIndex);
      this.maxLine = Math.max(this.maxLine, lineIndex);
    }
    return line;
  }

  /**
   * Allocate a line from pool or create new
   */
  private allocateLine(): Cell[] {
    let line = this.linePool.pop();
    if (!line) {
      line = [];
      for (let i = 0; i < this.cols; i++) {
        line.push(this.allocateCell());
      }
    } else {
      // Reset cells
      for (const cell of line) {
        cell.char = ' ';
        cell.fg = DEFAULT_FG;
        cell.bg = DEFAULT_BG;
        Object.assign(cell.attrs, DEFAULT_ATTRS);
      }
      // Adjust size if cols changed
      while (line.length < this.cols) {
        line.push(this.allocateCell());
      }
      while (line.length > this.cols) {
        const cell = line.pop()!;
        this.cellPool.push(cell);
      }
    }
    return line;
  }

  /**
   * Allocate a cell from pool or create new
   */
  private allocateCell(): Cell {
    return this.cellPool.pop() || createDefaultCell();
  }

  /**
   * Recycle a line back to the pool
   */
  private recycleLine(lineIndex: number): void {
    const line = this.lines.get(lineIndex);
    if (line) {
      this.linePool.push(line);
      this.lines.delete(lineIndex);
    }
  }

  /**
   * Get a line (may be null if empty)
   */
  getLine(row: number): Cell[] | null {
    const lineIndex = this.absoluteLine(row);
    return this.lines.get(lineIndex) || null;
  }

  /**
   * Get a cell at position
   */
  getCell(col: number, row: number): Cell | null {
    const line = this.getLine(row);
    if (!line || col < 0 || col >= this.cols) return null;
    return line[col];
  }

  /**
   * Set a cell at the current cursor position
   */
  setCell(char: string): void {
    if (this.cursorX >= this.cols) return;

    const lineIndex = this.absoluteLine(this.cursorY);
    const line = this.getOrCreateLine(lineIndex);
    const cell = line[this.cursorX];

    cell.char = char;
    cell.fg = this.currentFg;
    cell.bg = this.currentBg;
    Object.assign(cell.attrs, this.currentAttrs);

    this.cursorX++;
  }

  /**
   * Set cell at specific position with partial cell data
   */
  setCellAt(col: number, row: number, data: Partial<Cell>): void {
    if (col < 0 || col >= this.cols || row < 0) return;

    const lineIndex = this.absoluteLine(row);
    const line = this.getOrCreateLine(lineIndex);
    copyCell(data, line[col]);
  }

  /**
   * Move cursor to position (0-indexed)
   */
  moveCursor(col: number, row: number): void {
    this.cursorX = Math.max(0, Math.min(col, this.cols - 1));
    this.cursorY = Math.max(0, Math.min(row, this.rows - 1));
  }

  /**
   * Move cursor relative to current position
   */
  moveCursorRelative(deltaCol: number, deltaRow: number): void {
    this.moveCursor(this.cursorX + deltaCol, this.cursorY + deltaRow);
  }

  /**
   * Scroll the grid up by n lines
   */
  scrollUp(n: number = 1): void {
    for (let i = 0; i < n; i++) {
      // The top line of scroll region becomes scrollback
      // Lines in scroll region shift up
      // Bottom line of scroll region becomes empty

      for (let row = this.scrollTop; row < this.scrollBottom; row++) {
        const srcLine = this.absoluteLine(row + 1);
        const dstLine = this.absoluteLine(row);

        const src = this.lines.get(srcLine);
        if (src) {
          this.lines.set(dstLine, src);
          this.lines.delete(srcLine);
        } else {
          this.recycleLine(dstLine);
        }
      }

      // Clear the bottom line
      this.recycleLine(this.absoluteLine(this.scrollBottom));
    }

    this.lineOffset += n;
    this.trimScrollback();
  }

  /**
   * Scroll the grid down by n lines
   */
  scrollDown(n: number = 1): void {
    for (let i = 0; i < n; i++) {
      // Lines in scroll region shift down
      // Top line of scroll region becomes empty

      for (let row = this.scrollBottom; row > this.scrollTop; row--) {
        const srcLine = this.absoluteLine(row - 1);
        const dstLine = this.absoluteLine(row);

        const src = this.lines.get(srcLine);
        if (src) {
          this.lines.set(dstLine, src);
          this.lines.delete(srcLine);
        } else {
          this.recycleLine(dstLine);
        }
      }

      // Clear the top line
      this.recycleLine(this.absoluteLine(this.scrollTop));
    }
  }

  /**
   * Erase from cursor to end of line
   */
  eraseToEndOfLine(): void {
    const lineIndex = this.absoluteLine(this.cursorY);
    const line = this.lines.get(lineIndex);
    if (!line) return;

    for (let col = this.cursorX; col < this.cols; col++) {
      line[col].char = ' ';
      line[col].fg = DEFAULT_FG;
      line[col].bg = DEFAULT_BG;
      Object.assign(line[col].attrs, DEFAULT_ATTRS);
    }
  }

  /**
   * Erase from start of line to cursor
   */
  eraseToStartOfLine(): void {
    const lineIndex = this.absoluteLine(this.cursorY);
    const line = this.lines.get(lineIndex);
    if (!line) return;

    for (let col = 0; col <= this.cursorX && col < this.cols; col++) {
      line[col].char = ' ';
      line[col].fg = DEFAULT_FG;
      line[col].bg = DEFAULT_BG;
      Object.assign(line[col].attrs, DEFAULT_ATTRS);
    }
  }

  /**
   * Erase entire line
   */
  eraseLine(): void {
    this.recycleLine(this.absoluteLine(this.cursorY));
  }

  /**
   * Erase from cursor to end of screen
   */
  eraseToEndOfScreen(): void {
    this.eraseToEndOfLine();
    for (let row = this.cursorY + 1; row < this.rows; row++) {
      this.recycleLine(this.absoluteLine(row));
    }
  }

  /**
   * Erase from start of screen to cursor
   */
  eraseToStartOfScreen(): void {
    for (let row = 0; row < this.cursorY; row++) {
      this.recycleLine(this.absoluteLine(row));
    }
    this.eraseToStartOfLine();
  }

  /**
   * Erase entire screen
   */
  eraseScreen(): void {
    for (let row = 0; row < this.rows; row++) {
      this.recycleLine(this.absoluteLine(row));
    }
  }

  /**
   * Resize the grid
   */
  resize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.scrollBottom = rows - 1;

    // Clamp cursor
    this.cursorX = Math.min(this.cursorX, cols - 1);
    this.cursorY = Math.min(this.cursorY, rows - 1);

    // Adjust existing lines
    for (const [lineIndex, line] of this.lines) {
      while (line.length < cols) {
        line.push(this.allocateCell());
      }
      while (line.length > cols) {
        const cell = line.pop()!;
        this.cellPool.push(cell);
      }
    }
  }

  /**
   * Trim scrollback to configured limit
   */
  private trimScrollback(): void {
    const minAllowed = this.lineOffset - this.scrollback;

    for (const lineIndex of this.lines.keys()) {
      if (lineIndex < minAllowed) {
        this.recycleLine(lineIndex);
      }
    }

    this.minLine = Math.max(this.minLine, minAllowed);
  }

  /**
   * Get visible lines for rendering
   */
  getVisibleLines(): (Cell[] | null)[] {
    const result: (Cell[] | null)[] = [];
    for (let row = 0; row < this.rows; row++) {
      result.push(this.getLine(row));
    }
    return result;
  }

  /**
   * Get scrollback lines
   */
  getScrollbackLines(count: number, offset: number = 0): (Cell[] | null)[] {
    const result: (Cell[] | null)[] = [];
    const startLine = this.lineOffset - offset - count;

    for (let i = 0; i < count; i++) {
      const lineIndex = startLine + i;
      result.push(this.lines.get(lineIndex) || null);
    }

    return result;
  }

  /**
   * Get total scrollback available
   */
  getScrollbackSize(): number {
    return Math.max(0, this.lineOffset - this.minLine);
  }

  /**
   * Reset SGR attributes to default
   */
  resetAttributes(): void {
    this.currentFg = DEFAULT_FG;
    this.currentBg = DEFAULT_BG;
    this.currentAttrs = { ...DEFAULT_ATTRS };
  }

  /**
   * Set scroll region
   */
  setScrollRegion(top: number, bottom: number): void {
    this.scrollTop = Math.max(0, Math.min(top, this.rows - 1));
    this.scrollBottom = Math.max(this.scrollTop, Math.min(bottom, this.rows - 1));
  }

  /**
   * Reset scroll region to full screen
   */
  resetScrollRegion(): void {
    this.scrollTop = 0;
    this.scrollBottom = this.rows - 1;
  }

  /**
   * New line (move cursor down, scroll if needed)
   */
  newLine(): void {
    if (this.cursorY >= this.scrollBottom) {
      this.scrollUp(1);
    } else {
      this.cursorY++;
    }
  }

  /**
   * Carriage return (move cursor to start of line)
   */
  carriageReturn(): void {
    this.cursorX = 0;
  }

  /**
   * Tab (move cursor to next tab stop)
   */
  tab(): void {
    const nextTab = Math.min(((Math.floor(this.cursorX / 8) + 1) * 8), this.cols - 1);
    this.cursorX = nextTab;
  }

  /**
   * Backspace (move cursor left)
   */
  backspace(): void {
    if (this.cursorX > 0) {
      this.cursorX--;
    }
  }
}
