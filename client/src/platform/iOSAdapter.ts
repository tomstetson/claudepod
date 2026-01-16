/**
 * iOS Platform Adapter
 *
 * Handles iOS-specific behavior including:
 * - Keyboard detection and management
 * - PWA keyboard recovery workarounds
 * - Haptic feedback
 * - Safe area insets
 * - Scroll behavior tuning
 */

import {
  PlatformAdapter,
  KeyboardState,
  HapticType,
  SafeAreaInsets,
  isStandalone,
  hasTouchScreen
} from './PlatformAdapter';

export class iOSAdapter implements PlatformAdapter {
  readonly platform = 'ios' as const;
  readonly isStandalone: boolean;
  readonly hasTouchScreen = true;
  readonly isIPhone: boolean;
  readonly isIPad: boolean;

  private keyboardState: KeyboardState = {
    visible: false,
    height: 0,
    animating: false
  };

  private keyboardListeners = new Set<(state: KeyboardState) => void>();
  private orientationListeners = new Set<(orientation: 'portrait' | 'landscape') => void>();

  private initialViewportHeight: number;
  private focusedInput: HTMLElement | null = null;
  private keyboardRecoveryAttempts = 0;

  // For cleanup
  private cleanupFunctions: (() => void)[] = [];

  constructor() {
    this.isStandalone = isStandalone();
    this.isIPhone = /iphone/i.test(navigator.userAgent);
    this.isIPad = /ipad/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    this.initialViewportHeight = window.innerHeight;

    this.setupKeyboardDetection();
    this.setupOrientationDetection();
  }

  /**
   * Setup keyboard detection using multiple methods for reliability
   */
  private setupKeyboardDetection(): void {
    // Method 1: visualViewport API (most reliable when it works)
    if (window.visualViewport) {
      const handleResize = () => this.handleViewportResize();
      window.visualViewport.addEventListener('resize', handleResize);
      this.cleanupFunctions.push(() => {
        window.visualViewport?.removeEventListener('resize', handleResize);
      });
    }

    // Method 2: Focus/blur tracking
    const handleFocusIn = (e: FocusEvent) => this.handleFocusIn(e);
    const handleFocusOut = (e: FocusEvent) => this.handleFocusOut(e);

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    this.cleanupFunctions.push(() => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    });

    // Method 3: Window resize as fallback
    const handleWindowResize = () => this.handleWindowResize();
    window.addEventListener('resize', handleWindowResize);
    this.cleanupFunctions.push(() => {
      window.removeEventListener('resize', handleWindowResize);
    });
  }

  private handleViewportResize(): void {
    if (!window.visualViewport) return;

    const currentHeight = window.visualViewport.height;
    const heightDiff = this.initialViewportHeight - currentHeight;

    // Keyboard is considered visible if viewport shrunk by more than 100px
    // (accounting for URL bar collapse/expand which is ~50px)
    const wasVisible = this.keyboardState.visible;
    const isVisible = heightDiff > 100;

    if (isVisible !== wasVisible) {
      this.keyboardState = {
        visible: isVisible,
        height: isVisible ? heightDiff : 0,
        animating: false
      };
      this.notifyKeyboardChange();
    }
  }

  private handleFocusIn(e: FocusEvent): void {
    const target = e.target as HTMLElement;

    // Check if it's an input element
    if (this.isInputElement(target)) {
      this.focusedInput = target;
      this.keyboardRecoveryAttempts = 0;

      // Set a small delay to detect if keyboard actually appeared
      setTimeout(() => {
        this.checkKeyboardAppeared();
      }, 300);
    }
  }

  private handleFocusOut(e: FocusEvent): void {
    const target = e.target as HTMLElement;

    if (target === this.focusedInput) {
      this.focusedInput = null;

      // Delay to allow for focus transfer
      setTimeout(() => {
        if (!this.focusedInput) {
          this.keyboardState = {
            visible: false,
            height: 0,
            animating: false
          };
          this.notifyKeyboardChange();
        }
      }, 100);
    }
  }

  private handleWindowResize(): void {
    // Update initial viewport height on orientation change
    if (this.getOrientation() !== this.lastOrientation) {
      this.lastOrientation = this.getOrientation();
      // Wait for resize to complete
      setTimeout(() => {
        this.initialViewportHeight = window.innerHeight;
      }, 500);
    }
  }

  private lastOrientation: 'portrait' | 'landscape' = 'portrait';

  /**
   * Check if keyboard actually appeared after focus
   */
  private checkKeyboardAppeared(): void {
    if (!this.focusedInput) return;

    // If keyboard should be visible but viewport didn't shrink,
    // the iOS PWA keyboard bug might have occurred
    if (!this.keyboardState.visible && this.focusedInput === document.activeElement) {
      this.attemptKeyboardRecovery();
    }
  }

  /**
   * Attempt to recover keyboard using various workarounds
   */
  private async attemptKeyboardRecovery(): Promise<void> {
    if (this.keyboardRecoveryAttempts >= 3) {
      console.warn('Keyboard recovery failed after 3 attempts');
      return;
    }

    this.keyboardRecoveryAttempts++;
    console.log(`Attempting keyboard recovery (attempt ${this.keyboardRecoveryAttempts})`);

    const input = this.focusedInput;
    if (!input) return;

    // Method 1: Blur and refocus with delay
    input.blur();
    await this.delay(100);
    input.focus();
    await this.delay(300);

    if (this.keyboardState.visible) return;

    // Method 2: Touch simulation
    this.simulateTouch(input);
    await this.delay(300);

    if (this.keyboardState.visible) return;

    // Method 3: Create temporary input, focus it, then return focus
    const tempInput = document.createElement('input');
    tempInput.type = 'text';
    tempInput.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;';
    document.body.appendChild(tempInput);

    tempInput.focus();
    await this.delay(200);
    tempInput.remove();

    if (input === this.focusedInput) {
      input.focus();
    }
  }

  /**
   * Simulate touch event on element
   */
  private simulateTouch(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const touchStart = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [new Touch({
        identifier: 0,
        target: element,
        clientX: x,
        clientY: y
      })]
    });

    const touchEnd = new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: []
    });

    element.dispatchEvent(touchStart);
    element.dispatchEvent(touchEnd);
  }

  private isInputElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'input') {
      const type = (element as HTMLInputElement).type.toLowerCase();
      return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden'].includes(type);
    }
    return tagName === 'textarea' || element.contentEditable === 'true';
  }

  private notifyKeyboardChange(): void {
    for (const listener of this.keyboardListeners) {
      listener(this.keyboardState);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API

  getKeyboardState(): KeyboardState {
    return { ...this.keyboardState };
  }

  onKeyboardChange(callback: (state: KeyboardState) => void): () => void {
    this.keyboardListeners.add(callback);
    return () => this.keyboardListeners.delete(callback);
  }

  async forceKeyboardShow(input: HTMLElement): Promise<void> {
    this.focusedInput = input;
    this.keyboardRecoveryAttempts = 0;

    input.focus();

    // Wait for keyboard
    await this.delay(300);

    // Check if keyboard appeared
    if (!this.keyboardState.visible) {
      await this.attemptKeyboardRecovery();
    }
  }

  async forceKeyboardHide(): Promise<void> {
    if (this.focusedInput) {
      this.focusedInput.blur();
    }
    document.body.focus();
  }

  haptic(type: HapticType): void {
    // iOS Safari supports basic vibration
    if (!('vibrate' in navigator)) return;

    const patterns: Record<HapticType, number[]> = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 50, 10],
      error: [50, 30, 50],
      warning: [30, 30, 30]
    };

    navigator.vibrate(patterns[type] || [10]);
  }

  getSafeAreaInsets(): SafeAreaInsets {
    const style = getComputedStyle(document.documentElement);

    return {
      top: parseInt(style.getPropertyValue('--sat') || '0', 10) ||
        parseInt(style.getPropertyValue('env(safe-area-inset-top)') || '0', 10),
      bottom: parseInt(style.getPropertyValue('--sab') || '0', 10) ||
        parseInt(style.getPropertyValue('env(safe-area-inset-bottom)') || '0', 10),
      left: parseInt(style.getPropertyValue('--sal') || '0', 10) ||
        parseInt(style.getPropertyValue('env(safe-area-inset-left)') || '0', 10),
      right: parseInt(style.getPropertyValue('--sar') || '0', 10) ||
        parseInt(style.getPropertyValue('env(safe-area-inset-right)') || '0', 10)
    };
  }

  configureScroll(element: HTMLElement): void {
    // Enable smooth momentum scrolling
    element.style.webkitOverflowScrolling = 'touch';
    element.style.overscrollBehavior = 'contain';

    // Prevent rubber-banding at edges
    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].pageY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].pageY;
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop >= element.scrollHeight - element.clientHeight;

      if ((atTop && y > startY) || (atBottom && y < startY)) {
        e.preventDefault();
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });

    this.cleanupFunctions.push(() => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
    });
  }

  async readClipboard(): Promise<string> {
    try {
      return await navigator.clipboard.readText();
    } catch {
      // Fallback for older iOS
      const textarea = document.createElement('textarea');
      textarea.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;';
      document.body.appendChild(textarea);
      textarea.focus();
      document.execCommand('paste');
      const text = textarea.value;
      textarea.remove();
      return text;
    }
  }

  async writeClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older iOS
      const textarea = document.createElement('textarea');
      textarea.style.cssText = 'position:fixed;top:-100px;left:-100px;opacity:0;';
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  }

  getOrientation(): 'portrait' | 'landscape' {
    if (window.matchMedia('(orientation: portrait)').matches) {
      return 'portrait';
    }
    return 'landscape';
  }

  private setupOrientationDetection(): void {
    const mediaQuery = window.matchMedia('(orientation: portrait)');
    this.lastOrientation = this.getOrientation();

    const handleChange = () => {
      const orientation = this.getOrientation();
      if (orientation !== this.lastOrientation) {
        this.lastOrientation = orientation;
        for (const listener of this.orientationListeners) {
          listener(orientation);
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    this.cleanupFunctions.push(() => {
      mediaQuery.removeEventListener('change', handleChange);
    });
  }

  onOrientationChange(callback: (orientation: 'portrait' | 'landscape') => void): () => void {
    this.orientationListeners.add(callback);
    return () => this.orientationListeners.delete(callback);
  }

  isLowPowerMode(): boolean {
    // No API for this in Safari, could check battery level as proxy
    return false;
  }

  destroy(): void {
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];
    this.keyboardListeners.clear();
    this.orientationListeners.clear();
  }
}
