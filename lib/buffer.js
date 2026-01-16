/**
 * RingBuffer - Circular buffer for terminal session output
 *
 * Stores terminal output lines with efficient memory usage.
 * Supports retrieving historical content by absolute line number.
 */

class RingBuffer {
  /**
   * @param {Object} options
   * @param {number} options.maxLines - Maximum lines to keep in memory (default: 50000)
   */
  constructor(options = {}) {
    this.maxLines = options.maxLines || 50000;
    this.lines = [];
    this.totalLinesWritten = 0;

    // Partial line buffer for incomplete lines (no trailing newline)
    this.partialLine = '';
  }

  /**
   * Write terminal output data to the buffer
   * Handles partial lines correctly (data may not end with newline)
   *
   * @param {string} data - Raw terminal output
   * @returns {number} - Number of complete lines added
   */
  write(data) {
    if (!data) return 0;

    // Prepend any partial line from previous write
    const fullData = this.partialLine + data;

    // Split on newlines, keeping track of whether data ends with newline
    const parts = fullData.split('\n');

    // If data doesn't end with newline, last part is partial
    if (!data.endsWith('\n')) {
      this.partialLine = parts.pop();
    } else {
      this.partialLine = '';
      // Remove empty string from trailing newline
      if (parts[parts.length - 1] === '') {
        parts.pop();
      }
    }

    // Add complete lines to buffer
    const newLines = parts;
    if (newLines.length === 0) return 0;

    this.lines.push(...newLines);
    this.totalLinesWritten += newLines.length;

    // Trim to max size if needed
    if (this.lines.length > this.maxLines) {
      const overflow = this.lines.length - this.maxLines;
      this.lines.splice(0, overflow);
    }

    return newLines.length;
  }

  /**
   * Get lines by absolute line number
   * Line numbers are 1-indexed and absolute (never reset)
   *
   * @param {number} startLine - First line to retrieve (1-indexed)
   * @param {number} count - Number of lines to retrieve
   * @returns {Object} - { lines: string[], startLine: number, endLine: number }
   */
  getRange(startLine, count) {
    const state = this.getState();

    // Clamp to available range
    const effectiveStart = Math.max(startLine, state.oldestLine);
    const effectiveEnd = Math.min(effectiveStart + count - 1, state.newestLine);

    if (effectiveStart > state.newestLine || effectiveEnd < state.oldestLine) {
      return { lines: [], startLine: effectiveStart, endLine: effectiveStart - 1 };
    }

    // Convert absolute line number to array index
    const startIndex = effectiveStart - state.oldestLine;
    const endIndex = effectiveEnd - state.oldestLine + 1;

    return {
      lines: this.lines.slice(startIndex, endIndex),
      startLine: effectiveStart,
      endLine: effectiveEnd
    };
  }

  /**
   * Get the most recent N lines
   *
   * @param {number} count - Number of lines to retrieve
   * @returns {Object} - { lines: string[], startLine: number, endLine: number }
   */
  getTail(count) {
    const state = this.getState();
    const startLine = Math.max(state.oldestLine, state.newestLine - count + 1);
    return this.getRange(startLine, count);
  }

  /**
   * Get all buffered content as a single string
   * Useful for export or full sync
   *
   * @returns {string}
   */
  getAll() {
    let content = this.lines.join('\n');
    if (this.partialLine) {
      content += '\n' + this.partialLine;
    }
    return content;
  }

  /**
   * Get current buffer state for synchronization
   *
   * @returns {Object} - Buffer state info
   */
  getState() {
    const lineCount = this.lines.length;
    const oldestLine = lineCount > 0 ? this.totalLinesWritten - lineCount + 1 : 1;
    const newestLine = this.totalLinesWritten || 0;

    return {
      oldestLine,      // First available line number
      newestLine,      // Last available line number
      lineCount,       // Number of lines in buffer
      hasPartial: this.partialLine.length > 0,
      maxLines: this.maxLines
    };
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.lines = [];
    this.partialLine = '';
    // Note: totalLinesWritten is NOT reset - line numbers are absolute
  }

  /**
   * Get memory usage estimate in bytes
   *
   * @returns {number}
   */
  getMemoryUsage() {
    let bytes = 0;
    for (const line of this.lines) {
      bytes += line.length * 2; // UTF-16 characters
    }
    bytes += this.partialLine.length * 2;
    return bytes;
  }
}

module.exports = { RingBuffer };
