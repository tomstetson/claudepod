/**
 * ClaudePod 2.0 - Entry Point
 *
 * Mobile-first terminal for Claude Code access via Tailscale.
 */

import { App } from './App';

// Global app instance for debugging
declare global {
  interface Window {
    claudepod: App;
  }
}

async function main(): Promise<void> {
  const app = new App();

  // Expose for debugging
  window.claudepod = app;

  // Initialize
  try {
    await app.init();
  } catch (err) {
    console.error('Failed to initialize ClaudePod:', err);

    // Show error to user
    const container = document.getElementById('terminal-container');
    if (container) {
      container.innerHTML = `
        <div class="error-screen">
          <h2>Failed to Initialize</h2>
          <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
          <button onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
