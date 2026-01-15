# ClaudePod

Web-based terminal viewer for remotely monitoring and interacting with Claude Code sessions. Access your Claude sessions from your phone via Tailscale.

## Features

- View multiple Claude Code sessions running in tmux
- Switch between sessions
- Create new Claude sessions
- Quick-tap buttons for common inputs (Y/N/Enter/Esc)
- PWA - installable on your phone's home screen
- Pushover notifications when Claude needs input

## Prerequisites

- macOS with Node.js 18+
- tmux installed (`brew install tmux`)
- Tailscale configured for remote access
- (Optional) Pushover account for notifications

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment (optional, for notifications):**
   ```bash
   cp .env.example .env
   # Edit .env with your Pushover credentials
   ```

3. **Generate PWA icons:**

   Replace the SVG icon with PNG versions:
   - `public/icons/icon-192.png` (192x192)
   - `public/icons/icon-512.png` (512x512)

   You can use the included SVG as a template or create your own.

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Access from your phone:**
   - Find your Mac's Tailscale IP: `tailscale ip -4`
   - Open `http://<tailscale-ip>:3000` on your phone
   - Add to home screen for PWA experience

## Usage

### Creating Claude Sessions

Click **+ New** to create a new tmux session running Claude Code. Sessions are named `claude1`, `claude2`, etc.

### Managing Sessions Manually

You can also create/manage tmux sessions from your terminal:

```bash
# Create a new session
tmux new -s myproject -d 'claude'

# List sessions
tmux ls

# Attach locally
tmux attach -t myproject

# Kill a session
tmux kill-session -t myproject
```

### Quick Actions

The bottom bar has quick-tap buttons for common Claude interactions:
- **Y/N** - Respond to yes/no prompts
- **Enter** - Confirm prompts
- **Esc** - Cancel/escape
- **Tab** - Tab completion
- **Ctrl+C** - Interrupt current operation

## Pushover Notifications

To get notified when Claude needs input:

1. Create a Pushover account at https://pushover.net
2. Create an application to get your API token
3. Add to `.env`:
   ```
   PUSHOVER_APP_TOKEN=your_token
   PUSHOVER_USER_KEY=your_user_key
   ```

Notifications are sent when Claude outputs patterns like `[Y/n]` or `?` and you're not actively viewing that session.

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

## Development

```bash
# Run with auto-reload
npm run dev
```

## Troubleshooting

**"No sessions" showing:**
- Make sure tmux is installed: `which tmux`
- Check if tmux server is running: `tmux ls`

**Can't connect from phone:**
- Verify Tailscale is connected on both devices
- Check firewall allows port 3000
- Try the Tailscale IP directly, not hostname

**node-pty build errors:**
- Ensure Xcode command line tools are installed: `xcode-select --install`
- Try clearing npm cache: `npm cache clean --force && rm -rf node_modules && npm install`

## License

MIT
