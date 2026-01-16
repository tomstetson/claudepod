/**
 * ANSIParser - Parse ANSI escape sequences and apply to VirtualGrid
 *
 * Implements a state machine for processing terminal escape sequences.
 * Supports CSI (Control Sequence Introducer) and basic OSC (Operating System Command).
 */

import { VirtualGrid, DEFAULT_FG, DEFAULT_BG, DEFAULT_ATTRS } from './VirtualGrid';

enum ParserState {
  Ground,
  Escape,
  EscapeIntermediate,
  CSI,
  CSIParam,
  CSIIntermediate,
  OSC,
  OSCString,
  DCS,
}

// Standard ANSI colors (0-7 normal, 8-15 bright)
export const ANSI_COLORS = [
  '#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5', // Normal
  '#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff', // Bright
];

export class ANSIParser {
  private state = ParserState.Ground;
  private params: number[] = [];
  private currentParam = '';
  private intermediates = '';
  private oscString = '';

  constructor(private grid: VirtualGrid) {}

  /**
   * Parse and process a chunk of data
   */
  parse(data: string): void {
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      const code = char.charCodeAt(0);
      this.processChar(char, code);
    }
  }

  private processChar(char: string, code: number): void {
    switch (this.state) {
      case ParserState.Ground:
        this.handleGround(char, code);
        break;
      case ParserState.Escape:
        this.handleEscape(char, code);
        break;
      case ParserState.EscapeIntermediate:
        this.handleEscapeIntermediate(char, code);
        break;
      case ParserState.CSI:
      case ParserState.CSIParam:
        this.handleCSI(char, code);
        break;
      case ParserState.CSIIntermediate:
        this.handleCSIIntermediate(char, code);
        break;
      case ParserState.OSC:
      case ParserState.OSCString:
        this.handleOSC(char, code);
        break;
      case ParserState.DCS:
        this.handleDCS(char, code);
        break;
    }
  }

  private handleGround(char: string, code: number): void {
    // C0 control codes
    if (code < 0x20) {
      switch (code) {
        case 0x00: // NUL
          break;
        case 0x07: // BEL
          // Bell - could trigger haptic feedback
          break;
        case 0x08: // BS
          this.grid.backspace();
          break;
        case 0x09: // HT
          this.grid.tab();
          break;
        case 0x0a: // LF
        case 0x0b: // VT
        case 0x0c: // FF
          this.grid.newLine();
          break;
        case 0x0d: // CR
          this.grid.carriageReturn();
          break;
        case 0x1b: // ESC
          this.state = ParserState.Escape;
          break;
      }
      return;
    }

    // DEL
    if (code === 0x7f) {
      return;
    }

    // Printable character
    this.grid.setCell(char);

    // Handle line wrapping
    if (this.grid.cursorX >= this.grid.cols) {
      this.grid.carriageReturn();
      this.grid.newLine();
    }
  }

  private handleEscape(char: string, code: number): void {
    // Reset intermediates
    this.intermediates = '';

    if (code >= 0x20 && code <= 0x2f) {
      // Intermediate bytes
      this.intermediates += char;
      this.state = ParserState.EscapeIntermediate;
      return;
    }

    switch (char) {
      case '[':
        // CSI
        this.state = ParserState.CSI;
        this.params = [];
        this.currentParam = '';
        break;
      case ']':
        // OSC
        this.state = ParserState.OSC;
        this.oscString = '';
        break;
      case 'P':
        // DCS
        this.state = ParserState.DCS;
        break;
      case '7':
        // DECSC - Save cursor
        // TODO: Implement cursor save/restore
        this.state = ParserState.Ground;
        break;
      case '8':
        // DECRC - Restore cursor
        // TODO: Implement cursor save/restore
        this.state = ParserState.Ground;
        break;
      case 'D':
        // IND - Index (move down one line)
        this.grid.newLine();
        this.state = ParserState.Ground;
        break;
      case 'E':
        // NEL - Next line
        this.grid.carriageReturn();
        this.grid.newLine();
        this.state = ParserState.Ground;
        break;
      case 'M':
        // RI - Reverse index (move up one line)
        if (this.grid.cursorY <= this.grid.scrollTop) {
          this.grid.scrollDown(1);
        } else {
          this.grid.cursorY--;
        }
        this.state = ParserState.Ground;
        break;
      case 'c':
        // RIS - Reset to initial state
        this.grid.eraseScreen();
        this.grid.moveCursor(0, 0);
        this.grid.resetAttributes();
        this.grid.resetScrollRegion();
        this.state = ParserState.Ground;
        break;
      default:
        // Unknown escape sequence
        this.state = ParserState.Ground;
    }
  }

  private handleEscapeIntermediate(char: string, code: number): void {
    if (code >= 0x20 && code <= 0x2f) {
      this.intermediates += char;
      return;
    }

    // Final character - execute escape sequence
    // For now, just return to ground state
    this.state = ParserState.Ground;
  }

  private handleCSI(char: string, code: number): void {
    // Check for parameter byte
    if (code >= 0x30 && code <= 0x39) {
      // Digit
      this.currentParam += char;
      this.state = ParserState.CSIParam;
      return;
    }

    if (char === ';') {
      // Parameter separator
      this.params.push(this.currentParam ? parseInt(this.currentParam, 10) : 0);
      this.currentParam = '';
      this.state = ParserState.CSIParam;
      return;
    }

    if (char === '?') {
      // Private parameter prefix (e.g., for DECSET/DECRST)
      this.intermediates = '?';
      return;
    }

    if (char === '>') {
      // Secondary DA prefix
      this.intermediates = '>';
      return;
    }

    if (code >= 0x20 && code <= 0x2f) {
      // Intermediate byte
      this.intermediates += char;
      this.state = ParserState.CSIIntermediate;
      return;
    }

    // Final byte - execute CSI sequence
    if (this.currentParam) {
      this.params.push(parseInt(this.currentParam, 10));
    }

    this.executeCSI(char);
    this.state = ParserState.Ground;
  }

  private handleCSIIntermediate(char: string, code: number): void {
    if (code >= 0x20 && code <= 0x2f) {
      this.intermediates += char;
      return;
    }

    // Final byte - execute CSI sequence
    if (this.currentParam) {
      this.params.push(parseInt(this.currentParam, 10));
    }

    this.executeCSI(char);
    this.state = ParserState.Ground;
  }

  private handleOSC(char: string, code: number): void {
    if (code === 0x07 || (code === 0x1b)) {
      // BEL or ESC terminates OSC
      this.executeOSC();
      this.state = code === 0x1b ? ParserState.Escape : ParserState.Ground;
      return;
    }

    if (char === '\\' && this.oscString.endsWith('\x1b')) {
      // ST (String Terminator) = ESC \
      this.oscString = this.oscString.slice(0, -1);
      this.executeOSC();
      this.state = ParserState.Ground;
      return;
    }

    this.oscString += char;
    this.state = ParserState.OSCString;
  }

  private handleDCS(char: string, code: number): void {
    // DCS sequences end with ST (ESC \) or BEL
    if (code === 0x07) {
      this.state = ParserState.Ground;
      return;
    }
    if (code === 0x1b) {
      this.state = ParserState.Escape;
      return;
    }
    // Ignore DCS content for now
  }

  private executeCSI(final: string): void {
    const params = this.params;
    const p0 = params[0] ?? 0;
    const p1 = params[1] ?? 0;

    // Handle private sequences
    if (this.intermediates === '?') {
      this.executePrivateCSI(final, params);
      return;
    }

    switch (final) {
      case 'A': // CUU - Cursor Up
        this.grid.moveCursorRelative(0, -(p0 || 1));
        break;

      case 'B': // CUD - Cursor Down
        this.grid.moveCursorRelative(0, p0 || 1);
        break;

      case 'C': // CUF - Cursor Forward
        this.grid.moveCursorRelative(p0 || 1, 0);
        break;

      case 'D': // CUB - Cursor Back
        this.grid.moveCursorRelative(-(p0 || 1), 0);
        break;

      case 'E': // CNL - Cursor Next Line
        this.grid.moveCursor(0, this.grid.cursorY + (p0 || 1));
        break;

      case 'F': // CPL - Cursor Previous Line
        this.grid.moveCursor(0, this.grid.cursorY - (p0 || 1));
        break;

      case 'G': // CHA - Cursor Horizontal Absolute
        this.grid.moveCursor((p0 || 1) - 1, this.grid.cursorY);
        break;

      case 'H': // CUP - Cursor Position
      case 'f': // HVP - Horizontal and Vertical Position
        this.grid.moveCursor((p1 || 1) - 1, (p0 || 1) - 1);
        break;

      case 'J': // ED - Erase in Display
        switch (p0) {
          case 0:
            this.grid.eraseToEndOfScreen();
            break;
          case 1:
            this.grid.eraseToStartOfScreen();
            break;
          case 2:
          case 3:
            this.grid.eraseScreen();
            break;
        }
        break;

      case 'K': // EL - Erase in Line
        switch (p0) {
          case 0:
            this.grid.eraseToEndOfLine();
            break;
          case 1:
            this.grid.eraseToStartOfLine();
            break;
          case 2:
            this.grid.eraseLine();
            break;
        }
        break;

      case 'L': // IL - Insert Lines
        // TODO: Implement
        break;

      case 'M': // DL - Delete Lines
        // TODO: Implement
        break;

      case 'P': // DCH - Delete Characters
        // TODO: Implement
        break;

      case 'S': // SU - Scroll Up
        this.grid.scrollUp(p0 || 1);
        break;

      case 'T': // SD - Scroll Down
        this.grid.scrollDown(p0 || 1);
        break;

      case 'X': // ECH - Erase Characters
        // Erase n characters starting at cursor
        for (let i = 0; i < (p0 || 1); i++) {
          if (this.grid.cursorX + i < this.grid.cols) {
            this.grid.setCellAt(this.grid.cursorX + i, this.grid.cursorY, {
              char: ' ',
              fg: DEFAULT_FG,
              bg: DEFAULT_BG,
              attrs: { ...DEFAULT_ATTRS }
            });
          }
        }
        break;

      case 'd': // VPA - Vertical Position Absolute
        this.grid.moveCursor(this.grid.cursorX, (p0 || 1) - 1);
        break;

      case 'm': // SGR - Select Graphic Rendition
        this.handleSGR(params);
        break;

      case 'n': // DSR - Device Status Report
        // TODO: Send response
        break;

      case 'r': // DECSTBM - Set Top and Bottom Margins
        if (p0 === 0 && p1 === 0) {
          this.grid.resetScrollRegion();
        } else {
          this.grid.setScrollRegion((p0 || 1) - 1, (p1 || this.grid.rows) - 1);
        }
        this.grid.moveCursor(0, 0);
        break;

      case 's': // SCP - Save Cursor Position
        // TODO: Implement
        break;

      case 'u': // RCP - Restore Cursor Position
        // TODO: Implement
        break;

      case '@': // ICH - Insert Characters
        // TODO: Implement
        break;

      default:
        // Unknown CSI sequence
        break;
    }
  }

  private executePrivateCSI(final: string, params: number[]): void {
    const p0 = params[0] ?? 0;

    switch (final) {
      case 'h': // DECSET - DEC Private Mode Set
        this.handleDECSET(params, true);
        break;

      case 'l': // DECRST - DEC Private Mode Reset
        this.handleDECSET(params, false);
        break;

      case 'c': // DA - Device Attributes
        // TODO: Send response
        break;

      default:
        break;
    }
  }

  private handleDECSET(params: number[], set: boolean): void {
    for (const param of params) {
      switch (param) {
        case 1: // DECCKM - Cursor Keys Mode
          // TODO: Change cursor key mode
          break;

        case 7: // DECAWM - Auto Wrap Mode
          // TODO: Enable/disable auto wrap
          break;

        case 12: // Cursor blink
          break;

        case 25: // DECTCEM - Text Cursor Enable Mode
          // TODO: Show/hide cursor
          break;

        case 1049: // Alternate screen buffer
          // TODO: Switch buffer
          break;

        case 2004: // Bracketed paste mode
          // TODO: Enable/disable bracketed paste
          break;

        default:
          break;
      }
    }
  }

  private handleSGR(params: number[]): void {
    if (params.length === 0) {
      params = [0];
    }

    let i = 0;
    while (i < params.length) {
      const param = params[i];

      switch (param) {
        case 0: // Reset
          this.grid.resetAttributes();
          break;

        case 1: // Bold
          this.grid.currentAttrs.bold = true;
          break;

        case 2: // Dim
          this.grid.currentAttrs.dim = true;
          break;

        case 3: // Italic
          this.grid.currentAttrs.italic = true;
          break;

        case 4: // Underline
          this.grid.currentAttrs.underline = true;
          break;

        case 5: // Blink
          this.grid.currentAttrs.blink = true;
          break;

        case 7: // Inverse
          this.grid.currentAttrs.inverse = true;
          break;

        case 8: // Hidden
          // Not implemented
          break;

        case 9: // Strikethrough
          this.grid.currentAttrs.strikethrough = true;
          break;

        case 21: // Double underline (often rendered as bold off)
          this.grid.currentAttrs.bold = false;
          break;

        case 22: // Normal intensity (not bold, not dim)
          this.grid.currentAttrs.bold = false;
          this.grid.currentAttrs.dim = false;
          break;

        case 23: // Italic off
          this.grid.currentAttrs.italic = false;
          break;

        case 24: // Underline off
          this.grid.currentAttrs.underline = false;
          break;

        case 25: // Blink off
          this.grid.currentAttrs.blink = false;
          break;

        case 27: // Inverse off
          this.grid.currentAttrs.inverse = false;
          break;

        case 28: // Hidden off
          break;

        case 29: // Strikethrough off
          this.grid.currentAttrs.strikethrough = false;
          break;

        // Foreground colors (30-37, 90-97)
        case 30: case 31: case 32: case 33:
        case 34: case 35: case 36: case 37:
          this.grid.currentFg = param - 30;
          break;

        case 38: // Extended foreground color
          i = this.handleExtendedColor(params, i, true);
          break;

        case 39: // Default foreground
          this.grid.currentFg = DEFAULT_FG;
          break;

        // Background colors (40-47, 100-107)
        case 40: case 41: case 42: case 43:
        case 44: case 45: case 46: case 47:
          this.grid.currentBg = param - 40;
          break;

        case 48: // Extended background color
          i = this.handleExtendedColor(params, i, false);
          break;

        case 49: // Default background
          this.grid.currentBg = DEFAULT_BG;
          break;

        // Bright foreground colors
        case 90: case 91: case 92: case 93:
        case 94: case 95: case 96: case 97:
          this.grid.currentFg = param - 90 + 8;
          break;

        // Bright background colors
        case 100: case 101: case 102: case 103:
        case 104: case 105: case 106: case 107:
          this.grid.currentBg = param - 100 + 8;
          break;

        default:
          break;
      }

      i++;
    }
  }

  private handleExtendedColor(params: number[], index: number, isFg: boolean): number {
    if (index + 1 >= params.length) return index;

    const mode = params[index + 1];

    if (mode === 5 && index + 2 < params.length) {
      // 256 color mode: 38;5;n or 48;5;n
      const color = params[index + 2];
      if (isFg) {
        this.grid.currentFg = color;
      } else {
        this.grid.currentBg = color;
      }
      return index + 2;
    }

    if (mode === 2 && index + 4 < params.length) {
      // 24-bit RGB mode: 38;2;r;g;b or 48;2;r;g;b
      // We'll store this as 256 + (r << 16) + (g << 8) + b
      const r = params[index + 2];
      const g = params[index + 3];
      const b = params[index + 4];
      const color = 256 + (r << 16) + (g << 8) + b;
      if (isFg) {
        this.grid.currentFg = color;
      } else {
        this.grid.currentBg = color;
      }
      return index + 4;
    }

    return index + 1;
  }

  private executeOSC(): void {
    const colonIndex = this.oscString.indexOf(';');
    if (colonIndex === -1) return;

    const command = parseInt(this.oscString.slice(0, colonIndex), 10);
    const data = this.oscString.slice(colonIndex + 1);

    switch (command) {
      case 0: // Set window title and icon name
      case 1: // Set icon name
      case 2: // Set window title
        // TODO: Emit title change event
        break;

      case 4: // Set color
        // TODO: Handle color palette changes
        break;

      case 52: // Clipboard
        // TODO: Handle clipboard
        break;

      default:
        break;
    }
  }
}
