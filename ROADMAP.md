# ClaudePod Roadmap

> Future features and enhancements for ClaudePod. Contributions welcome!

## Current: v1.0 ✅

Core mobile-first PWA for monitoring Claude Code sessions:
- Terminal emulator with themes
- Quick action buttons (Y/N/Enter/Esc/^C)
- Command palette
- Push notifications via Pushover
- Session management
- iOS keyboard handling
- Swipe gestures

---

## v1.1: Voice & Notifications

### Voice Input
Speak commands to Claude instead of typing on a tiny phone keyboard.

**Why:** Typing on mobile is slow. Voice makes couch coding practical.

**Implementation:**
- Web Speech API (built into modern browsers)
- Tap-to-speak button in input bar
- Visual feedback during recording
- Fallback for unsupported browsers

**Files:** `public/app.js`, `public/index.html`, `public/style.css`

---

### Rich Notifications
Show context in push notifications with actionable buttons.

**Why:** Currently notifications just say "Claude needs input" - no context.

**Implementation:**
- Include Claude's question in notification body
- Add Y/N action buttons (Pushover supports this)
- Deep link to specific session

**Files:** `lib/notifications.js`, `server.js`

---

## v1.2: Smart Automation

### Auto-Approve Patterns
Configure automatic "Y" responses for trusted prompts.

**Why:** Reduce phone interactions for routine confirmations like "Run tests?" or "Format code?"

**Implementation:**
- Settings UI for pattern management
- Regex or substring matching
- Per-session or global rules
- Audit log of auto-approvals

**Files:** `lib/sessions.js`, `public/app.js`, new `lib/auto-approve.js`

**Example config:**
```json
{
  "autoApprove": [
    "Run tests?",
    "Format code?",
    "Install dependencies?"
  ]
}
```

---

### Dark/Light Mode
System theme matching plus manual override.

**Why:** Current dark-only theme is hard to read outdoors.

**Implementation:**
- CSS custom properties already in place
- Add `prefers-color-scheme` media query
- Toggle in command palette
- Persist preference in localStorage

**Files:** `public/style.css`, `public/app.js`

---

## v1.3: Organization & Insights

### Session Templates
Quick-start templates for common workflows.

**Why:** Reduce repetitive setup for common tasks.

**Templates:**
- **Code Review** - Starts with context about reviewing PR
- **Bug Fix** - Debugging-focused initial prompt
- **New Feature** - Scaffolds with project structure context
- **Refactor** - Structured approach to code improvement

**Implementation:**
- Template selector in new session dialog
- Templates stored in `public/templates.json`
- Custom template support via localStorage

**Files:** `public/app.js`, `public/index.html`, new `public/templates.json`

---

### Cost/Usage Tracking
Show estimated API usage per session.

**Why:** Help users understand Claude Code costs.

**Implementation:**
- Track session duration and message count
- Estimate token usage (rough heuristic)
- Display in session info
- Daily/weekly summaries

**Files:** `lib/sessions.js`, `public/app.js`

**Note:** This is estimation only - actual costs depend on Claude Code's internal usage.

---

## v2.0: Platform Expansion

### Apple Watch Companion
Minimal watchOS app for quick Y/N responses.

**Why:** Respond to Claude without pulling out your phone.

**Features:**
- Notification with Y/N buttons on watch
- Session status complication
- Haptic feedback

**Implementation:**
- Separate watchOS project (Swift)
- Communicates with ClaudePod server via Tailscale
- Pushover's watch app may already handle notifications

---

### Multi-Machine Support
Connect to Claude sessions on multiple Macs.

**Why:** Developers often have work + home machines.

**Implementation:**
- Machine registry in settings
- Each machine runs ClaudePod server
- Session browser organized by machine
- Tailscale handles networking

**Files:** `public/app.js`, `server.js`, new `lib/machines.js`

---

### iPad Layout
Optimized split-view for larger screens.

**Why:** iPad users get cramped phone layout.

**Implementation:**
- CSS Grid layout for wider screens
- Session list sidebar + terminal main area
- Responsive breakpoint at 768px
- Better keyboard shortcut support

**Files:** `public/style.css`, `public/index.html`

---

## Future Ideas (Backlog)

These are interesting but not yet prioritized:

| Feature | Description |
|---------|-------------|
| **iOS Shortcuts** | Siri integration for "Start Claude in project X" |
| **Session Snapshots** | Save/restore conversation bookmarks |
| **Global Search** | Search across all sessions |
| **Offline Viewing** | Cache recent session content |
| **Touch ID / Face ID** | Biometric security |
| **Session Groups** | Organize by project |
| **Collaboration** | Share sessions with teammates |
| **Widgets** | iOS home screen widgets |

---

## Contributing

Interested in implementing a feature?

1. Open an issue to discuss the approach
2. Fork the repo
3. Create a feature branch
4. Submit a PR with tests

See [README.md](README.md) for development setup.

---

## Version History

| Version | Status | Highlights |
|---------|--------|------------|
| v1.0 | ✅ Released | Core PWA, notifications, themes |
| v1.1 | 📋 Planned | Voice input, rich notifications |
| v1.2 | 📋 Planned | Auto-approve, dark/light mode |
| v1.3 | 📋 Planned | Templates, cost tracking |
| v2.0 | 💭 Future | Watch app, multi-machine, iPad |
