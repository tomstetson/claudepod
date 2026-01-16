/**
 * Platform Adapter - Abstraction layer for platform-specific behavior
 *
 * Handles keyboard detection, haptics, safe areas, and other
 * platform-specific functionality.
 */

export interface KeyboardState {
  visible: boolean;
  height: number;
  animating: boolean;
}

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PlatformAdapter {
  // Platform identification
  readonly platform: 'ios' | 'android' | 'desktop';
  readonly isStandalone: boolean;  // PWA mode
  readonly hasTouchScreen: boolean;
  readonly isIPhone: boolean;
  readonly isIPad: boolean;

  // Keyboard management
  getKeyboardState(): KeyboardState;
  onKeyboardChange(callback: (state: KeyboardState) => void): () => void;
  forceKeyboardShow(input: HTMLElement): Promise<void>;
  forceKeyboardHide(): Promise<void>;

  // Haptics
  haptic(type: HapticType): void;

  // Safe areas
  getSafeAreaInsets(): SafeAreaInsets;

  // Scroll behavior
  configureScroll(element: HTMLElement): void;

  // Clipboard
  readClipboard(): Promise<string>;
  writeClipboard(text: string): Promise<void>;

  // Orientation
  getOrientation(): 'portrait' | 'landscape';
  onOrientationChange(callback: (orientation: 'portrait' | 'landscape') => void): () => void;

  // Power state
  isLowPowerMode(): boolean;

  // Cleanup
  destroy(): void;
}

/**
 * Detect the current platform
 */
export function detectPlatform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios';
  }

  if (/android/.test(ua)) {
    return 'android';
  }

  return 'desktop';
}

/**
 * Check if running as standalone PWA
 */
export function isStandalone(): boolean {
  // iOS Safari
  if ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone) {
    return true;
  }

  // Other browsers
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  return false;
}

/**
 * Check if device has touch screen
 */
export function hasTouchScreen(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
