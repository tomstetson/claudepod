const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { RingBuffer } = require('../lib/buffer');

describe('RingBuffer', () => {
  let buffer;

  beforeEach(() => {
    buffer = new RingBuffer({ maxLines: 100 });
  });

  describe('constructor', () => {
    it('should use default maxLines if not specified', () => {
      const defaultBuffer = new RingBuffer();
      assert.strictEqual(defaultBuffer.maxLines, 50000);
    });

    it('should use provided maxLines', () => {
      assert.strictEqual(buffer.maxLines, 100);
    });

    it('should start empty', () => {
      const state = buffer.getState();
      assert.strictEqual(state.lineCount, 0);
      assert.strictEqual(state.newestLine, 0);
    });
  });

  describe('write', () => {
    it('should add complete lines ending with newline', () => {
      const count = buffer.write('line1\nline2\nline3\n');
      assert.strictEqual(count, 3);
      assert.strictEqual(buffer.getState().lineCount, 3);
    });

    it('should handle data without trailing newline', () => {
      buffer.write('line1\npartial');
      const state = buffer.getState();
      assert.strictEqual(state.lineCount, 1);
      assert.strictEqual(state.hasPartial, true);
    });

    it('should combine partial lines across writes', () => {
      buffer.write('hel');
      buffer.write('lo\nworld\n');

      const result = buffer.getRange(1, 10);
      assert.deepStrictEqual(result.lines, ['hello', 'world']);
    });

    it('should handle empty writes', () => {
      const count = buffer.write('');
      assert.strictEqual(count, 0);
    });

    it('should handle null/undefined writes', () => {
      const count = buffer.write(null);
      assert.strictEqual(count, 0);
    });

    it('should trim buffer when exceeding maxLines', () => {
      const smallBuffer = new RingBuffer({ maxLines: 5 });

      for (let i = 1; i <= 10; i++) {
        smallBuffer.write(`line${i}\n`);
      }

      const state = smallBuffer.getState();
      assert.strictEqual(state.lineCount, 5);
      assert.strictEqual(state.oldestLine, 6);
      assert.strictEqual(state.newestLine, 10);
    });

    it('should maintain correct totalLinesWritten after trim', () => {
      const smallBuffer = new RingBuffer({ maxLines: 3 });

      smallBuffer.write('a\nb\nc\nd\ne\n');

      assert.strictEqual(smallBuffer.totalLinesWritten, 5);
      assert.strictEqual(smallBuffer.getState().lineCount, 3);
    });
  });

  describe('getRange', () => {
    beforeEach(() => {
      // Write 10 lines
      for (let i = 1; i <= 10; i++) {
        buffer.write(`line${i}\n`);
      }
    });

    it('should return requested range', () => {
      const result = buffer.getRange(3, 3);
      assert.deepStrictEqual(result.lines, ['line3', 'line4', 'line5']);
      assert.strictEqual(result.startLine, 3);
      assert.strictEqual(result.endLine, 5);
    });

    it('should clamp to available range when requesting before buffer', () => {
      const smallBuffer = new RingBuffer({ maxLines: 5 });
      for (let i = 1; i <= 10; i++) {
        smallBuffer.write(`line${i}\n`);
      }

      // Buffer has lines 6-10, request lines 1-5
      // Should clamp start to 6 and return available lines
      const result = smallBuffer.getRange(1, 5);
      assert.deepStrictEqual(result.lines, ['line6', 'line7', 'line8', 'line9', 'line10']);
      assert.strictEqual(result.startLine, 6);
      assert.strictEqual(result.endLine, 10);
    });

    it('should clamp to available range when requesting past buffer', () => {
      const result = buffer.getRange(8, 10);
      assert.deepStrictEqual(result.lines, ['line8', 'line9', 'line10']);
      assert.strictEqual(result.startLine, 8);
      assert.strictEqual(result.endLine, 10);
    });

    it('should return empty array for out of range request', () => {
      const result = buffer.getRange(100, 5);
      assert.deepStrictEqual(result.lines, []);
    });

    it('should handle single line request', () => {
      const result = buffer.getRange(5, 1);
      assert.deepStrictEqual(result.lines, ['line5']);
      assert.strictEqual(result.startLine, 5);
      assert.strictEqual(result.endLine, 5);
    });
  });

  describe('getTail', () => {
    beforeEach(() => {
      for (let i = 1; i <= 10; i++) {
        buffer.write(`line${i}\n`);
      }
    });

    it('should return last N lines', () => {
      const result = buffer.getTail(3);
      assert.deepStrictEqual(result.lines, ['line8', 'line9', 'line10']);
    });

    it('should return all lines if count exceeds buffer size', () => {
      const result = buffer.getTail(100);
      assert.strictEqual(result.lines.length, 10);
      assert.strictEqual(result.lines[0], 'line1');
      assert.strictEqual(result.lines[9], 'line10');
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = new RingBuffer();
      const result = emptyBuffer.getTail(5);
      assert.deepStrictEqual(result.lines, []);
    });
  });

  describe('getAll', () => {
    it('should return all content as string', () => {
      buffer.write('line1\nline2\nline3\n');
      const all = buffer.getAll();
      assert.strictEqual(all, 'line1\nline2\nline3');
    });

    it('should include partial line', () => {
      buffer.write('line1\npartial');
      const all = buffer.getAll();
      assert.strictEqual(all, 'line1\npartial');
    });

    it('should return empty string for empty buffer', () => {
      const all = buffer.getAll();
      assert.strictEqual(all, '');
    });
  });

  describe('getState', () => {
    it('should return correct state for empty buffer', () => {
      const state = buffer.getState();
      assert.strictEqual(state.oldestLine, 1);
      assert.strictEqual(state.newestLine, 0);
      assert.strictEqual(state.lineCount, 0);
      assert.strictEqual(state.hasPartial, false);
    });

    it('should return correct state after writes', () => {
      buffer.write('a\nb\nc\n');
      const state = buffer.getState();
      assert.strictEqual(state.oldestLine, 1);
      assert.strictEqual(state.newestLine, 3);
      assert.strictEqual(state.lineCount, 3);
    });

    it('should return correct state after buffer trimming', () => {
      const smallBuffer = new RingBuffer({ maxLines: 5 });
      for (let i = 1; i <= 20; i++) {
        smallBuffer.write(`${i}\n`);
      }

      const state = smallBuffer.getState();
      assert.strictEqual(state.oldestLine, 16);
      assert.strictEqual(state.newestLine, 20);
      assert.strictEqual(state.lineCount, 5);
    });

    it('should track partial line status', () => {
      buffer.write('complete\n');
      assert.strictEqual(buffer.getState().hasPartial, false);

      buffer.write('partial');
      assert.strictEqual(buffer.getState().hasPartial, true);

      buffer.write(' more\n');
      assert.strictEqual(buffer.getState().hasPartial, false);
    });
  });

  describe('clear', () => {
    it('should empty the buffer', () => {
      buffer.write('line1\nline2\n');
      buffer.clear();

      assert.strictEqual(buffer.getState().lineCount, 0);
      assert.strictEqual(buffer.getAll(), '');
    });

    it('should clear partial line', () => {
      buffer.write('partial');
      buffer.clear();

      assert.strictEqual(buffer.getState().hasPartial, false);
    });

    it('should preserve totalLinesWritten for line numbering', () => {
      buffer.write('a\nb\nc\n');
      const beforeClear = buffer.totalLinesWritten;
      buffer.clear();

      assert.strictEqual(buffer.totalLinesWritten, beforeClear);
    });
  });

  describe('getMemoryUsage', () => {
    it('should estimate memory correctly', () => {
      buffer.write('hello\nworld\n');
      const usage = buffer.getMemoryUsage();

      // 'hello' (5) + 'world' (5) = 10 chars * 2 bytes = 20
      assert.strictEqual(usage, 20);
    });

    it('should include partial line in estimate', () => {
      buffer.write('hello\npart');
      const usage = buffer.getMemoryUsage();

      // 'hello' (5) + 'part' (4) = 9 chars * 2 bytes = 18
      assert.strictEqual(usage, 18);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid successive writes', () => {
      for (let i = 0; i < 1000; i++) {
        buffer.write(`line${i}\n`);
      }

      const state = buffer.getState();
      assert.strictEqual(state.lineCount, 100); // maxLines
      assert.strictEqual(state.newestLine, 1000);
    });

    it('should handle very long lines', () => {
      const longLine = 'x'.repeat(10000);
      buffer.write(longLine + '\n');

      const result = buffer.getRange(1, 1);
      assert.strictEqual(result.lines[0].length, 10000);
    });

    it('should handle lines with special characters', () => {
      buffer.write('emoji: 🎉\nescape: \x1b[31mred\x1b[0m\n');

      const result = buffer.getRange(1, 2);
      assert.strictEqual(result.lines[0], 'emoji: 🎉');
      assert.strictEqual(result.lines[1], 'escape: \x1b[31mred\x1b[0m');
    });

    it('should handle only newlines', () => {
      buffer.write('\n\n\n');
      const state = buffer.getState();
      assert.strictEqual(state.lineCount, 3);
    });

    it('should handle mixed CRLF and LF', () => {
      // Note: We only split on \n, so \r stays with content
      buffer.write('line1\r\nline2\n');
      const result = buffer.getRange(1, 2);
      assert.strictEqual(result.lines[0], 'line1\r');
      assert.strictEqual(result.lines[1], 'line2');
    });
  });
});
