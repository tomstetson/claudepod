# ClaudePod Design

**Date:** 2026-01-14
**Status:** Approved

## Overview

ClaudePod is a web-based terminal viewer for remotely monitoring and interacting with Claude Code sessions. It runs on your Mac and is accessible via Tailscale from your phone as a PWA.

## Use Case

- Monitor multiple Claude Code sessions remotely
- Respond to prompts (Y/n, questions) while away from desk
- Get push notifications when Claude needs input
- Light interaction, not heavy terminal work

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Your Mac                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ tmux: claude1│   │ tmux: claude2│   │ tmux: claude3│ │
│  │ (Claude Code)│   │ (Claude Code)│   │ (Claude Code)│ │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         └──────────────────┼──────────────────┘         │
│                            ▼                            │
│                   ┌─────────────────┐                   │
│                   │  ClaudePod App  │                   │
│                   │  (Node.js:3000) │                   │
│                   └────────┬────────┘                   │
└────────────────────────────┼────────────────────────────┘
                             │ Tailscale
                             ▼
                    ┌─────────────────┐
                    │  Your Phone     │
                    │  (PWA Browser)  │
                    └─────────────────┘
```

## Tech Stack

- **Runtime:** Node.js
- **Server:** Express
- **WebSocket:** ws
- **Terminal:** node-pty + xterm.js
- **Push notifications:** web-push
- **Session management:** tmux

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serve PWA |
| GET | `/api/sessions` | List tmux sessions |
| POST | `/api/sessions` | Create new tmux + Claude session |
| WS | `/terminal/:name` | WebSocket for terminal I/O |
| POST | `/api/notify/subscribe` | Register push subscription |

## Frontend UI

Mobile-first PWA with:
- Session dropdown selector
- "New Session" button
- xterm.js terminal view (scrollable, touch-friendly)
- Quick-tap buttons: [Y] [N] [Enter] [Esc] [Tab]
- Push notification support

```
┌─────────────────────────────┐
│ ☰  ClaudePod    [claude1 ▼]│
│              [+ New Session]│
├─────────────────────────────┤
│                             │
│  $ claude                   │
│  ╭─────────────────────────╮│
│  │ I'll help you build... ││
│  │                        ││
│  │ Should I proceed?      ││
│  │ [Y/n]                  ││
│  ╰─────────────────────────╯│
│                             │
├─────────────────────────────┤
│ [Y] [N] [Enter] [Esc] [Tab]│
└─────────────────────────────┘
```

## Push Notifications

Detect Claude prompts by matching terminal output:
```javascript
const PROMPT_PATTERNS = [
  /\[Y\/n\]/i,
  /\[yes\/no\]/i,
  /Press Enter/i,
  /\? $/,
  /waiting for input/i
];
```

When matched and tab not focused, send notification: "Claude is waiting for input in claude1"

## tmux Integration

**Session discovery:**
```bash
tmux list-sessions -F "#{session_name}:#{session_attached}"
```

**Attach to session:**
```bash
tmux attach -t <session_name>
```

**Create new session:**
```bash
tmux new-session -d -s <name> 'claude'
```

Auto-naming finds next available: claude1, claude2, etc.

## File Structure

```
ClaudePod/
├── package.json
├── server.js
├── lib/
│   ├── tmux.js
│   └── notifications.js
├── public/
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
└── README.md
```

## Dependencies

```json
{
  "express": "^4.18",
  "ws": "^8.16",
  "node-pty": "^1.0",
  "web-push": "^3.6"
}
```

## Security

- **Authentication:** Tailscale-only (no additional auth layer)
- **Network:** Only accessible within Tailscale network
- **Trust model:** Anyone on your tailnet can access

## Setup

1. `npm install`
2. Generate VAPID keys for push notifications
3. `npm start` (runs on port 3000)
4. Access via `http://<tailscale-ip>:3000`
5. Install as PWA, allow notifications

## Future Enhancements (not v1)

- Session kill button
- Multiple device sync
- Session activity indicators
- Custom notification patterns
- LaunchAgent for auto-start
