# Recent Changes

## 2026-01-15 — v3 Phase 10: Export & Clipboard
**Files:** public/app.js
**Why:** Allow users to copy and export session content
**Changes:**
- Copy selection to clipboard via command palette or Cmd+C
- Session export to .txt file via palette or Cmd+S
- Full terminal buffer export with timestamp in filename
- Haptic feedback for successful operations
**Commits:**
- `feat: add copy selection to clipboard command`
- `feat: add session export to file feature`

## 2026-01-15 — v3 Phase 9: Terminal Themes
**Files:** public/app.js
**Why:** Customization and visual comfort
**Changes:**
- 5 terminal themes: Default, Dracula, Nord, Solarized Dark, Monokai
- Theme selector via command palette (type "theme")
- Theme preference saved to localStorage
- Instant theme switching without page reload
**Commits:**
- `feat: add multiple terminal themes`

## 2026-01-15 — v3 Phase 8: Connection Quality & Notifications
**Files:** server.js, public/app.js, public/style.css, lib/notifications.js, test/notifications.test.js
**Why:** Better connection visibility and smarter notifications
**Changes:**
- Ping/pong WebSocket latency measurement every 5 seconds
- Visual indicator color changes based on latency (green/yellow/red)
- Enhanced notification patterns (30+ Claude-specific prompts)
- Detects tool approvals, plan mode, selection prompts, etc.
- Test suite now at 42 tests
**Commits:**
- `feat: add connection quality indicator with latency`
- `feat: enhance notification patterns for Claude prompts`

## 2026-01-15 — v3 Phase 7: Keyboard Shortcuts & Help
**Files:** public/app.js
**Why:** Power user features and discoverability
**Changes:**
- View commands in palette (clear, scroll top/bottom)
- Keyboard shortcuts: Cmd+P (palette), Cmd+K (clear), Cmd+F (search)
- Shortcuts help command shows all available shortcuts in terminal
**Commits:**
- `feat: add view commands to palette`
- `feat: add keyboard shortcuts for common actions`
- `feat: add shortcuts help command to palette`

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
