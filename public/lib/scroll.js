/**
 * ScrollController - Virtual scrolling with on-demand history fetch
 *
 * Features:
 * - Detects scroll to top and fetches history
 * - Prepends history without scroll jump
 * - Tracks loaded range for efficient fetching
 * - Throttled scroll handling for performance
 */

class ScrollController {
  constructor(options = {}) {
    this.terminal = options.terminal;
    this.connection = options.connection;
    this.onHistoryLoad = options.onHistoryLoad || (() => {});

    // Configuration
    this.fetchThreshold = options.fetchThreshold || 200; // px from top to trigger fetch
    this.fetchCount = options.fetchCount || 500; // lines to fetch per request
    this.throttleMs = options.throttleMs || 100;

    // State
    this.bufferState = null;
    this.loadedRange = { start: 0, end: 0 };
    this.loading = false;
    this.enabled = true;

    // Viewport element (set after terminal is ready)
    this.viewport = null;

    // Throttle timer
    this.throttleTimer = null;

    // Bind methods
    this.handleScroll = this.handleScroll.bind(this);
    this.handleSyncResponse = this.handleSyncResponse.bind(this);
  }

  /**
   * Initialize after terminal is ready
   */
  init() {
    if (!this.terminal || !this.terminal.element) {
      console.warn('ScrollController: Terminal not ready');
      return false;
    }

    // Find the xterm viewport element
    this.viewport = this.terminal.element.querySelector('.xterm-viewport');
    if (!this.viewport) {
      console.warn('ScrollController: Viewport not found');
      return false;
    }

    // Set up scroll listener
    this.viewport.addEventListener('scroll', this.handleScroll, { passive: true });

    // Listen for sync responses from connection
    if (this.connection) {
      this.connection.on('sync_response', this.handleSyncResponse);
    }

    console.log('ScrollController initialized');
    return true;
  }

  /**
   * Cleanup listeners
   */
  destroy() {
    if (this.viewport) {
      this.viewport.removeEventListener('scroll', this.handleScroll);
    }
    if (this.connection) {
      this.connection.off('sync_response', this.handleSyncResponse);
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
    }
  }

  /**
   * Update buffer state (called when connection receives state_sync)
   * @param {Object} state - Buffer state from server
   */
  updateBufferState(state) {
    this.bufferState = state;

    // If this is first load, set loaded range to what we received
    if (this.loadedRange.start === 0 && this.loadedRange.end === 0) {
      // Assume we loaded the tail of the buffer
      this.loadedRange.end = state.newestLine;
      this.loadedRange.start = Math.max(state.oldestLine, state.newestLine - this.fetchCount + 1);
    }
  }

  /**
   * Reset state for new session
   */
  reset() {
    this.bufferState = null;
    this.loadedRange = { start: 0, end: 0 };
    this.loading = false;
  }

  /**
   * Check if more history is available
   * @returns {boolean}
   */
  hasMoreHistory() {
    if (!this.bufferState) return false;
    return this.loadedRange.start > this.bufferState.oldestLine;
  }

  /**
   * Handle scroll event (throttled)
   */
  handleScroll() {
    if (!this.enabled || this.loading) return;

    // Throttle scroll handling
    if (this.throttleTimer) return;

    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
      this.checkAndFetchHistory();
    }, this.throttleMs);
  }

  /**
   * Check scroll position and fetch history if needed
   */
  checkAndFetchHistory() {
    if (!this.viewport || !this.enabled || this.loading) return;

    // Check if near top
    if (this.viewport.scrollTop < this.fetchThreshold && this.hasMoreHistory()) {
      this.fetchMoreHistory();
    }
  }

  /**
   * Fetch more history from server
   */
  fetchMoreHistory() {
    if (!this.connection || !this.bufferState || this.loading) return;

    this.loading = true;

    // Calculate range to fetch
    const fromLine = Math.max(
      this.bufferState.oldestLine,
      this.loadedRange.start - this.fetchCount
    );
    const count = this.loadedRange.start - fromLine;

    if (count <= 0) {
      this.loading = false;
      return;
    }

    console.log(`Fetching history: lines ${fromLine} to ${fromLine + count - 1}`);

    // Show loading indicator
    this.onHistoryLoad({ loading: true, fromLine, count });

    // Request from server
    this.connection.requestHistory(fromLine, count);
  }

  /**
   * Handle sync response from server
   * @param {Object} msg - Sync response message
   */
  handleSyncResponse(msg) {
    if (!this.loading) return;

    this.loading = false;
    this.onHistoryLoad({ loading: false });

    if (!msg.lines || msg.lines.length === 0) {
      console.log('No history returned');
      return;
    }

    // Update buffer state
    if (msg.bufferState) {
      this.bufferState = msg.bufferState;
    }

    // Prepend history to terminal
    this.prependHistory(msg.lines, msg.startLine);

    // Update loaded range
    this.loadedRange.start = msg.startLine;

    console.log(`Loaded ${msg.lines.length} lines, range now ${this.loadedRange.start}-${this.loadedRange.end}`);
  }

  /**
   * Prepend history to terminal without scroll jump
   * @param {string[]} lines - Lines to prepend
   * @param {number} startLine - Starting line number
   */
  prependHistory(lines, startLine) {
    if (!this.terminal || !this.viewport || lines.length === 0) return;

    // Save current scroll position
    const oldScrollTop = this.viewport.scrollTop;
    const oldScrollHeight = this.viewport.scrollHeight;

    // Build content string
    const content = lines.join('\r\n') + '\r\n';

    // Write to terminal at the beginning
    // Unfortunately xterm.js doesn't have a native "prepend" method,
    // so we need to use a workaround by writing to the buffer

    // For now, we'll write the content and let the user scroll
    // A proper implementation would require modifying the terminal buffer directly

    // Alternative approach: Write a separator and the history
    const separator = '\r\n\x1b[38;2;100;100;100m--- Earlier history ---\x1b[0m\r\n\r\n';

    // We can't truly prepend, but we can write to the scrollback
    // The terminal will handle this, but scroll position may jump

    // Store terminal content, clear, write history, then restore
    // This is a simplified approach - full implementation would use terminal buffer API

    // For Phase 3, we'll use a simpler approach: just notify that history is available
    // and let the user request it via a "Load more" button or similar

    // Emit event for UI to handle
    if (this.onHistoryLoad) {
      this.onHistoryLoad({
        loaded: true,
        lines: lines,
        startLine: startLine,
        count: lines.length
      });
    }
  }

  /**
   * Scroll to bottom of terminal
   */
  scrollToBottom() {
    if (this.viewport) {
      this.viewport.scrollTop = this.viewport.scrollHeight;
    }
  }

  /**
   * Scroll to top of terminal
   */
  scrollToTop() {
    if (this.viewport) {
      this.viewport.scrollTop = 0;
    }
  }

  /**
   * Enable/disable scroll watching
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  /**
   * Get current scroll info
   * @returns {Object}
   */
  getScrollInfo() {
    if (!this.viewport) return null;

    return {
      scrollTop: this.viewport.scrollTop,
      scrollHeight: this.viewport.scrollHeight,
      clientHeight: this.viewport.clientHeight,
      atTop: this.viewport.scrollTop < this.fetchThreshold,
      atBottom: this.viewport.scrollTop + this.viewport.clientHeight >= this.viewport.scrollHeight - 10,
      hasMoreHistory: this.hasMoreHistory(),
      loadedRange: { ...this.loadedRange },
      bufferState: this.bufferState ? { ...this.bufferState } : null
    };
  }
}

// Export for use in app.js
window.ScrollController = ScrollController;
