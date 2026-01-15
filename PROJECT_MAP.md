# Project Map
**Last Updated:** 2026-01-14

## Overview
Web-based terminal viewer for remotely interacting with Claude Code sessions via Tailscale.

## Tech Stack
- **Frontend:** Vanilla JS + xterm.js (PWA)
- **Backend:** Node.js + Express + WebSocket
- **Terminal:** tmux + node-pty
- **Notifications:** Pushover

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
├── docs/
│   └── plans/
│       └── 2026-01-14-claudepod-design.md
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
- [✅] New session creation
- [✅] Quick action buttons
- [✅] PWA manifest and service worker
- [✅] Pushover notification support
- [ ] PNG icons for PWA
