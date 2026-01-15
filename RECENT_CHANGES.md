# Recent Changes

## 2026-01-15 — v3 Phase 6: Optimistic UI & Polish
**Files:** public/app.js
**Why:** Improve perceived performance and UX polish
**Changes:**
- Optimistic UI for label changes, notification toggles, session kills
- Instant feedback with automatic revert on API failure
- Dynamic command palette shows context-aware mute/unmute
**Commits:**
- `feat: add optimistic UI updates for instant feedback`
- `feat: dynamic notification command shows mute/unmute based on state`

## 2026-01-15 — v3 Phase 5: Notification Preferences
**Files:** lib/sessions.js, server.js, public/app.js, test/server.test.js
**Why:** Allow users to mute notifications for specific sessions
**Changes:**
- Per-session notification toggle via command palette
- Sessions with notifications disabled show 🔕 indicator
- Server checks preference before sending Pushover notifications
- Test suite now at 39 tests
**Commits:**
- `feat: add per-session notification preferences`
- `feat: add muted indicator for sessions with notifications disabled`

## 2026-01-15 — v3 Phase 3-4: Navigation & Search
**Files:** lib/sessions.js, server.js, public/app.js, public/index.html, public/sw.js
**Why:** Enhanced mobile navigation and discoverability
**Changes:**
- Smart scroll buttons (top/bottom) for quick navigation
- Session labels with rename command in palette
- Gesture navigation using Hammer.js (swipe left/right)
- Terminal search using xterm-addon-search
- Service worker cache updated to v8
**Commits:**
- `feat: add scroll controls and session labels`
- `feat: add gesture navigation and terminal search`

## 2026-01-15 — v3 Phase 1: Input Experience & Mobile Polish
**Files:** server.js, public/*, test/*, scripts/start.sh
**Why:** Major UX improvements for mobile Claude Code experience
**Changes:**
- Text input composer with auto-resize textarea
- Command palette with search and keyboard navigation
- Command history stored in localStorage
- Haptic feedback for button presses
- Font size controls (A-/A+) with persistence
- Smart network reconnection on coming back online
- Folder creation from directory browser
- Process manager script for auto-restart
- Consolidated and improved test suite (34 tests)
**Commits:**
- `feat: implement v3 Phase 1 - input experience overhaul`
- `feat: add font size controls and smart reconnection`
- `feat: add folder creation from directory browser`
- `feat: improve test infrastructure and add process manager`

## 2026-01-15 — v2 Security & Testing
**Files:** server.js, public/*, test/*
**Why:** Production hardening and stability
**Changes:**
- Added Helmet security headers
- Rate limiting on API endpoints
- WebSocket origin validation
- Health check endpoint
- Graceful shutdown handling
- Directory browser completion
- Comprehensive test suite
**Commits:**
- `feat: complete v2 security and testing phase`

## 2026-01-14 — Initial project creation
**Files:** All files
**Why:** Built complete ClaudePod application from scratch
**Changes:**
- Created Express server with WebSocket support
- Implemented tmux session discovery and management
- Built xterm.js-based PWA frontend
- Added Pushover notification integration
- Mobile-first responsive design
- Quick action buttons for common inputs
