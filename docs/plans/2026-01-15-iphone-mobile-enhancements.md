# iPhone/Mobile Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical iPhone UX issues including virtual keyboard handling, touch target sizes, modal scroll lock, and iOS input quirks.

**Architecture:** Frontend-only changes to CSS and JavaScript. Uses the `visualViewport` API to detect keyboard state and adjust layout. CSS changes increase touch targets to Apple's 44px minimum. Modal scroll lock prevents background scrolling on iOS Safari.

**Tech Stack:** Vanilla JS, CSS custom properties, visualViewport API, PWA manifest

---

## Task 1: Virtual Keyboard Detection

**Files:**
- Modify: `public/app.js:161-180` (constructor)
- Modify: `public/app.js:240-260` (setupTerminal)

**Step 1: Add keyboard state tracking to constructor**

In `public/app.js`, find the constructor around line 161-180 and add these properties:

```javascript
// In constructor(), after existing properties:
this.keyboardVisible = false;
this.viewportHeight = window.innerHeight;
```

**Step 2: Add visualViewport listener in setupTerminal**

In `public/app.js`, find `setupTerminal()` around line 240 and add after the ResizeObserver setup:

```javascript
// Virtual keyboard detection for iOS
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const currentHeight = window.visualViewport.height;
    const heightDiff = this.viewportHeight - currentHeight;

    // Keyboard is likely open if viewport shrunk by >150px
    this.keyboardVisible = heightDiff > 150;

    if (this.keyboardVisible) {
      document.body.classList.add('keyboard-visible');
      // Scroll input into view
      const composer = document.getElementById('input-composer');
      if (document.activeElement === composer) {
        composer.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }
    } else {
      document.body.classList.remove('keyboard-visible');
    }

    // Refit terminal
    this.fitTerminal();
  });

  // Store initial viewport height
  this.viewportHeight = window.visualViewport.height;
}
```

**Step 3: Run the app and verify**

```bash
npm start
```

Open on iPhone, tap input field - keyboard should open and input should stay visible.

**Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: add virtual keyboard detection for iOS"
```

---

## Task 2: Keyboard-Visible CSS Adjustments

**Files:**
- Modify: `public/style.css:386-400` (after input-bar section)

**Step 1: Add keyboard-visible CSS class**

In `public/style.css`, find the `.input-bar` section (around line 338) and add after it:

```css
/* Keyboard visible adjustments */
body.keyboard-visible .quick-actions {
  display: none;
}

body.keyboard-visible .terminal-container {
  /* Reduce terminal height when keyboard is open */
  flex: 1;
  min-height: 100px;
}

body.keyboard-visible .input-bar {
  /* Ensure input bar stays above keyboard */
  position: relative;
  z-index: 200;
}

body.keyboard-visible .scroll-controls {
  /* Hide scroll controls when keyboard open */
  display: none;
}
```

**Step 2: Test on device**

Open on iPhone, tap input - quick actions should hide, giving more screen space.

**Step 3: Commit**

```bash
git add public/style.css
git commit -m "feat: add CSS adjustments for visible keyboard state"
```

---

## Task 3: Increase Touch Target Sizes

**Files:**
- Modify: `public/style.css:125-158` (font-controls section)
- Modify: `public/style.css:694-753` (mobile adjustments)

**Step 1: Increase font button sizes**

In `public/style.css`, find `.font-btn` around line 131 and change:

```css
.font-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
```

**Step 2: Update mobile action button sizes**

In `public/style.css`, find the mobile adjustments section `@media (max-width: 480px)` around line 695 and update `.action-btn`:

```css
.action-btn {
  min-width: 44px;
  height: 44px;
  padding: 0 12px;
  font-size: 12px;
  border-radius: 6px;
}
```

**Step 3: Update send button size**

Find `#send-btn` in the mobile section and update:

```css
#send-btn {
  width: 44px;
  height: 44px;
}
```

**Step 4: Test on device**

All buttons should be easily tappable without accidental mis-taps.

**Step 5: Commit**

```bash
git add public/style.css
git commit -m "feat: increase touch targets to 44px minimum"
```

---

## Task 4: Modal Scroll Lock

**Files:**
- Modify: `public/app.js` (showModal/hideModal methods)
- Modify: `public/style.css` (add scroll-lock class)

**Step 1: Add scroll-lock CSS**

In `public/style.css`, add near the top after the `body` styles (around line 68):

```css
/* Scroll lock for modals on iOS */
body.scroll-locked {
  overflow: hidden;
  position: fixed;
  width: 100%;
  height: 100%;
}

body.scroll-locked #app {
  overflow: hidden;
}
```

**Step 2: Create scroll lock helper methods in app.js**

In `public/app.js`, find the class methods section and add these helper methods (around line 800, near the `haptic` method):

```javascript
// Scroll lock for modals (iOS fix)
lockScroll() {
  this.scrollPosition = window.scrollY;
  document.body.classList.add('scroll-locked');
  document.body.style.top = `-${this.scrollPosition}px`;
}

unlockScroll() {
  document.body.classList.remove('scroll-locked');
  document.body.style.top = '';
  window.scrollTo(0, this.scrollPosition || 0);
}
```

**Step 3: Update showKillModal to lock scroll**

Find `showKillModal()` method and add scroll lock:

```javascript
showKillModal(sessionName) {
  this.lockScroll();  // Add this line
  const modal = document.getElementById('kill-modal');
  // ... rest of existing code
}
```

**Step 4: Update hideKillModal to unlock scroll**

Find `hideKillModal()` method and add scroll unlock:

```javascript
hideKillModal() {
  this.unlockScroll();  // Add this line
  const modal = document.getElementById('kill-modal');
  // ... rest of existing code
}
```

**Step 5: Update showDirBrowser to lock scroll**

Find `showDirBrowser()` method and add:

```javascript
showDirBrowser() {
  this.lockScroll();  // Add this line
  // ... rest of existing code
}
```

**Step 6: Update hideDirBrowser to unlock scroll**

Find `hideDirBrowser()` method and add:

```javascript
hideDirBrowser() {
  this.unlockScroll();  // Add this line
  // ... rest of existing code
}
```

**Step 7: Update showPalette to lock scroll**

Find `showPalette()` method and add:

```javascript
showPalette() {
  this.lockScroll();  // Add this line
  // ... rest of existing code
}
```

**Step 8: Update hidePalette to unlock scroll**

Find `hidePalette()` method and add:

```javascript
hidePalette() {
  this.unlockScroll();  // Add this line
  // ... rest of existing code
}
```

**Step 9: Test on device**

Open modal on iPhone, try scrolling - background should not scroll.

**Step 10: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: add modal scroll lock for iOS"
```

---

## Task 5: iOS Input Attributes

**Files:**
- Modify: `public/index.html:58` (input-composer)
- Modify: `public/index.html:112` (palette-search)

**Step 1: Update input-composer attributes**

In `public/index.html`, find the textarea around line 58 and update:

```html
<textarea
  id="input-composer"
  placeholder="Type a message..."
  rows="1"
  autocomplete="off"
  autocorrect="off"
  autocapitalize="none"
  spellcheck="false"
  enterkeyhint="send"
></textarea>
```

**Step 2: Update palette-search attributes**

In `public/index.html`, find the palette search input around line 112 and update:

```html
<input
  type="text"
  id="palette-search"
  placeholder="Search commands..."
  autocomplete="off"
  autocorrect="off"
  autocapitalize="none"
  spellcheck="false"
  enterkeyhint="search"
>
```

**Step 3: Test on device**

Input fields should not auto-capitalize first letter, keyboard should show appropriate action key.

**Step 4: Commit**

```bash
git add public/index.html
git commit -m "feat: add iOS-optimized input attributes"
```

---

## Task 6: PWA Manifest Enhancements

**Files:**
- Modify: `public/manifest.json`

**Step 1: Update manifest with shortcuts and id**

Replace `public/manifest.json` with:

```json
{
  "id": "claudepod",
  "name": "ClaudePod",
  "short_name": "ClaudePod",
  "description": "Remote terminal viewer for Claude Code sessions",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#141414",
  "theme_color": "#141414",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["developer", "utilities"],
  "shortcuts": [
    {
      "name": "New Session",
      "short_name": "New",
      "description": "Create a new Claude session",
      "url": "/?action=new",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    },
    {
      "name": "Command Palette",
      "short_name": "Commands",
      "description": "Open command palette",
      "url": "/?action=palette",
      "icons": [{ "src": "/icons/icon-192.png", "sizes": "192x192" }]
    }
  ]
}
```

**Step 2: Update service worker cache version**

In `public/sw.js`, increment the cache version:

```javascript
const CACHE_VERSION = 9;
```

**Step 3: Commit**

```bash
git add public/manifest.json public/sw.js
git commit -m "feat: enhance PWA manifest with shortcuts"
```

---

## Task 7: Handle PWA Shortcut Actions

**Files:**
- Modify: `public/app.js` (init method)

**Step 1: Add URL parameter handling**

In `public/app.js`, find the `init()` method and add at the beginning:

```javascript
async init() {
  // Handle PWA shortcut actions
  const params = new URLSearchParams(window.location.search);
  const action = params.get('action');

  if (action) {
    // Clear the URL parameter
    window.history.replaceState({}, '', '/');

    // Queue action for after init
    this.pendingAction = action;
  }

  // ... rest of existing init code
```

**Step 2: Execute pending action after connection**

In `public/app.js`, find where the WebSocket `onopen` handler is (in `connectToSession`) and add after successful connection:

```javascript
// After the existing onopen code, add:
// Handle pending PWA action
if (this.pendingAction) {
  setTimeout(() => {
    if (this.pendingAction === 'new') {
      this.showDirBrowser();
    } else if (this.pendingAction === 'palette') {
      this.showPalette();
    }
    this.pendingAction = null;
  }, 500);
}
```

**Step 3: Test**

Install PWA, long-press icon (iOS) or use app shortcuts (Android) - actions should work.

**Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: handle PWA shortcut actions"
```

---

## Task 8: Run Tests and Final Verification

**Step 1: Run test suite**

```bash
npm test
```

Expected: All 42 tests pass.

**Step 2: Manual verification checklist**

On iPhone Safari:
- [ ] Tap input - keyboard opens, input stays visible
- [ ] Quick actions hide when keyboard open
- [ ] All buttons easily tappable (44px targets)
- [ ] Open modal - background doesn't scroll
- [ ] Input doesn't auto-capitalize
- [ ] Swipe between sessions works
- [ ] PWA installs correctly

**Step 3: Update documentation**

Update `WORKING_ON.md` and `RECENT_CHANGES.md` with the new features.

**Step 4: Final commit**

```bash
git add WORKING_ON.md RECENT_CHANGES.md PROJECT_MAP.md
git commit -m "docs: update documentation with mobile enhancements"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Virtual keyboard detection | app.js |
| 2 | Keyboard-visible CSS | style.css |
| 3 | Touch target sizes (44px) | style.css |
| 4 | Modal scroll lock | app.js, style.css |
| 5 | iOS input attributes | index.html |
| 6 | PWA manifest shortcuts | manifest.json, sw.js |
| 7 | PWA shortcut handling | app.js |
| 8 | Testing and docs | test, docs |

**Estimated time:** 30-45 minutes for all tasks
