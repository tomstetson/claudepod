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
│   └── notifications.js   # Pushover notification logic
├── public/
│   ├── index.html         # PWA shell
│   ├── app.js             # Frontend terminal client
│   ├── style.css          # Mobile-first styles
│   ├── sw.js              # Service worker
│   ├── manifest.json      # PWA manifest
│   └── icons/             # PWA icons
├── test/
│   ├── setup.js           # Test utilities
│   ├── tmux.test.js       # tmux unit tests
│   ├── notifications.test.js # notifications unit tests
│   ├── api.test.js        # API integration tests
│   └── pty-test.js        # PTY integration tests
├── docs/
│   └── plans/
│       ├── 2026-01-14-claudepod-design.md
│       └── 2026-01-15-claudepod-v2.md
├── .env.example           # Environment template
├── .gitignore
├── package.json
└── README.md
```

## Current Features
- [✅] tmux session listing and management
- [✅] WebSocket terminal connection
- [✅] xterm.js terminal UI
- [✅] Session switching
- [✅] New session creation with directory browser
- [✅] Kill session with confirmation
- [✅] Quick action buttons (Y/N/Enter/Esc/Tab/Ctrl+C)
- [✅] PWA manifest and service worker
- [✅] Pushover notification support
- [✅] Security headers (Helmet)
- [✅] Rate limiting
- [✅] WebSocket origin validation
- [✅] Health check endpoint
- [✅] Graceful shutdown
- [✅] Connection status indicator
- [✅] Keyboard shortcuts
- [✅] Session auto-refresh
- [✅] Offline detection
- [✅] Install prompt
- [✅] Comprehensive test suite
