/**
 * PerformanceMonitor - FPS monitoring and adaptive quality
 *
 * Features:
 * - Real-time FPS tracking
 * - Automatic quality degradation when FPS drops
 * - Memory usage estimation
 * - Performance event callbacks
 */

class PerformanceMonitor {
  constructor(options = {}) {
    // Configuration
    this.targetFps = options.targetFps || 60;
    this.lowFpsThreshold = options.lowFpsThreshold || 30;
    this.criticalFpsThreshold = options.criticalFpsThreshold || 15;
    this.sampleInterval = options.sampleInterval || 1000; // 1 second

    // Callbacks
    this.onQualityChange = options.onQualityChange || (() => {});
    this.onFpsUpdate = options.onFpsUpdate || (() => {});

    // State
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.quality = 'high'; // 'high', 'medium', 'low'
    this.running = false;
    this.rafId = null;

    // FPS history for smoothing
    this.fpsHistory = [];
    this.historySize = 5;

    // Bind methods
    this.tick = this.tick.bind(this);
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.running) return;

    this.running = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.rafId = requestAnimationFrame(this.tick);

    console.log('PerformanceMonitor started');
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Animation frame tick
   */
  tick() {
    if (!this.running) return;

    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    // Update FPS every sampleInterval
    if (elapsed >= this.sampleInterval) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime = now;

      // Add to history for smoothing
      this.fpsHistory.push(this.fps);
      if (this.fpsHistory.length > this.historySize) {
        this.fpsHistory.shift();
      }

      // Calculate smoothed FPS
      const smoothedFps = this.getSmoothedFps();

      // Check quality level
      this.updateQuality(smoothedFps);

      // Emit update
      this.onFpsUpdate({
        fps: this.fps,
        smoothedFps,
        quality: this.quality
      });
    }

    this.rafId = requestAnimationFrame(this.tick);
  }

  /**
   * Get smoothed FPS from history
   * @returns {number}
   */
  getSmoothedFps() {
    if (this.fpsHistory.length === 0) return this.fps;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.fpsHistory.length);
  }

  /**
   * Update quality level based on FPS
   * @param {number} fps
   */
  updateQuality(fps) {
    let newQuality = this.quality;

    if (fps < this.criticalFpsThreshold) {
      newQuality = 'low';
    } else if (fps < this.lowFpsThreshold) {
      newQuality = 'medium';
    } else if (fps >= this.targetFps - 5) {
      // Only upgrade if consistently good
      if (this.quality !== 'high' && this.fpsHistory.every(f => f >= this.lowFpsThreshold)) {
        newQuality = 'high';
      }
    }

    if (newQuality !== this.quality) {
      const oldQuality = this.quality;
      this.quality = newQuality;

      console.log(`Quality changed: ${oldQuality} -> ${newQuality} (FPS: ${fps})`);

      this.onQualityChange({
        oldQuality,
        newQuality,
        fps
      });
    }
  }

  /**
   * Get current quality settings for terminal
   * @returns {Object}
   */
  getTerminalSettings() {
    switch (this.quality) {
      case 'low':
        return {
          scrollback: 200,
          smoothScrollDuration: 0,
          cursorBlink: false,
          rendererType: 'dom' // DOM renderer is lighter
        };
      case 'medium':
        return {
          scrollback: 500,
          smoothScrollDuration: 50,
          cursorBlink: true,
          rendererType: 'canvas'
        };
      case 'high':
      default:
        return {
          scrollback: 1000,
          smoothScrollDuration: 100,
          cursorBlink: true,
          rendererType: 'canvas'
        };
    }
  }

  /**
   * Get estimated memory usage
   * @returns {Object}
   */
  getMemoryInfo() {
    // Use Performance API if available
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }

    return null;
  }

  /**
   * Get current stats
   * @returns {Object}
   */
  getStats() {
    return {
      fps: this.fps,
      smoothedFps: this.getSmoothedFps(),
      quality: this.quality,
      memory: this.getMemoryInfo(),
      running: this.running
    };
  }

  /**
   * Force a quality level (for testing)
   * @param {string} quality - 'high', 'medium', or 'low'
   */
  setQuality(quality) {
    if (['high', 'medium', 'low'].includes(quality)) {
      const oldQuality = this.quality;
      this.quality = quality;

      if (oldQuality !== quality) {
        this.onQualityChange({
          oldQuality,
          newQuality: quality,
          fps: this.fps,
          forced: true
        });
      }
    }
  }

  /**
   * Check if device is likely low-powered
   * @returns {boolean}
   */
  static isLowPowerDevice() {
    // Check for low memory (if available)
    if (navigator.deviceMemory && navigator.deviceMemory < 4) {
      return true;
    }

    // Check for low core count (if available)
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
      return true;
    }

    // Check for save-data preference
    if (navigator.connection && navigator.connection.saveData) {
      return true;
    }

    return false;
  }

  /**
   * Get recommended initial settings
   * @returns {Object}
   */
  static getRecommendedSettings() {
    if (PerformanceMonitor.isLowPowerDevice()) {
      return {
        scrollback: 500,
        fontSize: 14,
        enablePerformanceMonitor: true,
        initialQuality: 'medium'
      };
    }

    return {
      scrollback: 1000,
      fontSize: 14,
      enablePerformanceMonitor: false, // Only enable if issues detected
      initialQuality: 'high'
    };
  }
}

// Export for use in app.js
window.PerformanceMonitor = PerformanceMonitor;
