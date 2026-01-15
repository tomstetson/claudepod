# ClaudePod

A mobile-first PWA for remotely monitoring and interacting with [Claude Code](https://claude.ai/code) sessions. Access your Claude sessions from your phone while away from your desk.

![ClaudePod](https://img.shields.io/badge/PWA-Ready-blue) ![Node](https://img.shields.io/badge/Node-18%2B-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Why ClaudePod?

Claude Code runs long tasks that often pause for confirmation. ClaudePod lets you:
- Monitor sessions from your phone via Tailscale
- Get push notifications when Claude needs input
- Quickly respond with Y/N/Enter without typing
- Switch between multiple Claude sessions

## Features

### Terminal
- Full xterm.js terminal with 256-color support
- Multiple terminal themes (Default, Dracula, Nord, Solarized, Monokai)
- Session search (Cmd/Ctrl+F)
- Copy selection and export session to file

### Mobile-First
- iOS keyboard handling with visualViewport API
- 44px touch targets (Apple HIG compliant)
- Swipe gestures to switch sessions
- Haptic feedback
- PWA installable on home screen

### Productivity
- Command palette (Cmd/Ctrl+P) with fuzzy search
- Quick action buttons (Y/N/Enter/Esc/Ctrl+C)
- Session labels and renaming
- Per-session notification preferences
- Keyboard shortcuts for power users

### Notifications
- Pushover notifications when Claude needs input
- Smart debouncing (no spam)
- 30+ Claude-specific prompt patterns detected
- Only notifies when not actively viewing

## Prerequisites

- macOS with Node.js 18+
- tmux (`brew install tmux`)
- [Tailscale](https://tailscale.com) for remote access
- (Optional) [Pushover](https://pushover.net) account for notifications

## Quick Start

```bash
# Clone the repo
git clone https://github.com/yourusername/claudepod.git
cd claudepod

# Install dependencies
npm install

# Start the server
npm start
```

Open `http://localhost:3000` in your browser, or access via your Tailscale IP from your phone.

## Configuration

Create a `.env` file (optional):

```bash
# Directory browser root (defaults to $HOME)
CLAUDEPOD_PROJECTS_DIR=/path/to/your/projects

# Server port (default: 3000)
PORT=3000

# Pushover notifications (optional)
PUSHOVER_APP_TOKEN=your_app_token
PUSHOVER_USER_KEY=your_user_key

# Custom tmux path (default: /opt/homebrew/bin/tmux)
TMUX_PATH=/usr/local/bin/tmux
```

## Usage

### Creating Sessions

Click **+ New** to create a new tmux session running Claude Code. Browse to select a project directory.

### Quick Actions

Bottom bar buttons for common Claude interactions:
- **Y/N** - Respond to yes/no prompts
- **↵** - Send Enter
- **Esc** - Cancel/escape
- **^C** - Interrupt (Ctrl+C)
- **/** - Open command palette

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + P | Command palette |
| Cmd/Ctrl + K | Clear terminal |
| Cmd/Ctrl + F | Search terminal |
| Cmd/Ctrl + T | Cycle theme |
| Cmd/Ctrl + S | Export session |
| Cmd/Ctrl + O | Import file |
| Cmd/Ctrl + Shift + N | New session |
| Cmd/Ctrl + Shift + K | Kill session |

### Gestures (Mobile)

- **Swipe left/right** - Switch between sessions

## Architecture

```
Your Mac                          Your Phone
┌─────────────────────────┐      ┌──────────────┐
│ tmux sessions           │      │              │
│  ├─ claude1 (claude)    │◄────►│  ClaudePod   │
│  ├─ claude2 (claude)    │  WS  │  PWA         │
│  └─ claude3 (claude)    │      │              │
│           ▲             │      └──────────────┘
│           │             │            │
│    ClaudePod Server     │◄───────────┘
│    (localhost:3000)     │      Tailscale
└─────────────────────────┘
```

## Security

- Helmet.js security headers
- Rate limiting on API endpoints (100 req/15min)
- WebSocket origin validation (localhost + private IPs + Tailscale)
- Path traversal protection
- No secrets in codebase (env vars only)

**Note:** ClaudePod is designed for trusted local/Tailscale networks. Do not expose directly to the internet.

## Development

```bash
# Run with auto-reload
npm run dev

# Run tests
npm test

# Run all tests including PTY
npm run test:all

# Run with process manager (auto-restart)
npm run start:managed
```

## Troubleshooting

**"No sessions" showing:**
- Ensure tmux is installed: `which tmux`
- Check if tmux server is running: `tmux ls`
- Verify TMUX_PATH in .env matches your installation

**Can't connect from phone:**
- Verify Tailscale is connected on both devices
- Check firewall allows port 3000
- Use Tailscale IP directly: `tailscale ip -4`

**node-pty build errors:**
- Install Xcode CLI tools: `xcode-select --install`
- Clear cache: `rm -rf node_modules && npm install`

## License

MIT

## Acknowledgments

- [xterm.js](https://xtermjs.org/) - Terminal emulator
- [Hammer.js](https://hammerjs.github.io/) - Touch gestures
- [Pushover](https://pushover.net/) - Push notifications
