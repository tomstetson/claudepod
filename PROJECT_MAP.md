# Project Map
**Last Updated:** 2026-01-15

## Overview
Web-based terminal viewer for remotely interacting with Claude Code sessions via Tailscale.

## Tech Stack
- **Frontend:** Vanilla JS + xterm.js (PWA)
- **Backend:** Node.js + Express + WebSocket + Helmet
- **Terminal:** tmux + node-pty
- **Notifications:** Pushover
- **Testing:** Node.js built-in test runner

## Directory Structure
```
ClaudePod/
├── server.js              # Express + WebSocket server
├── lib/
│   ├── tmux.js            # tmux session management
│   ├── notifications.js   # Pushover notification logic
│   └── sessions.js        # Session metadata (labels)
├── public/
│   ├── index.html         # PWA shell
│   ├── app.js             # Frontend terminal client
│   ├── style.css          # Mobile-first styles
│   ├── sw.js              # Service worker (cache v8)
│   ├── manifest.json      # PWA manifest
│   └── icons/             # PWA icons
├── test/
│   ├── setup.js           # Test utilities with port cleanup
│   ├── server.test.js     # Consolidated server/API tests
│   ├── tmux.test.js       # tmux unit tests
│   ├── notifications.test.js # notifications unit tests
│   └── pty-test.js        # PTY integration tests
├── scripts/
│   └── start.sh           # Process manager with auto-restart
├── docs/
│   └── plans/
│       ├── 2026-01-14-claudepod-design.md
│       ├── 2026-01-15-claudepod-v2.md
│       └── 2026-01-15-claudepod-v3.md
├── .env.example           # Environment template
├── .gitignore
├── package.json           # v2.0.0
└── README.md
```

## Current Features
- [✅] tmux session listing and management
- [✅] WebSocket terminal connection
- [✅] xterm.js terminal UI
- [✅] Session switching
- [✅] New session creation with directory browser
- [✅] Folder creation from directory browser
- [✅] Kill session with confirmation
- [✅] Quick action buttons (Y/N/Enter/Esc/Ctrl+C)
- [✅] PWA manifest and service worker
- [✅] Pushover notification support
- [✅] Security headers (Helmet)
- [✅] Rate limiting
- [✅] WebSocket origin validation
- [✅] Health check endpoint
- [✅] Graceful shutdown
- [✅] Process manager with auto-restart
- [✅] Connection status indicator
- [✅] Keyboard shortcuts
- [✅] Session auto-refresh
- [✅] Offline detection
- [✅] Smart reconnection on network restore
- [✅] Install prompt
- [✅] Comprehensive test suite (36 tests)
- [✅] Text input composer (v3)
- [✅] Command palette with search (v3)
- [✅] Command history (v3)
- [✅] Haptic feedback (v3)
- [✅] Font size controls (v3)
- [✅] Smart scroll buttons (v3)
- [✅] Session labels (v3)
- [✅] Gesture navigation - swipe between sessions (v3)
- [✅] Terminal search (v3)
