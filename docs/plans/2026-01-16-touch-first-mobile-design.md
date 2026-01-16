# ClaudePod Touch-First Mobile Overhaul

**Date:** 2026-01-16
**Status:** Approved for implementation

## Problem Statement

ClaudePod on mobile (iPhone) has critical UX gaps:
- No way to scroll up in terminal chat
- No way to select through Claude Code menus (resume picker, file approval, etc.)
- Can't navigate with arrow keys
- Keyboard doesn't auto-hide when reading
- No easy copy/paste for code snippets

## Design Goals

1. **Menu navigation first** - Primary use case is responding to Claude Code prompts
2. **Touch-native** - Everything reachable with thumbs, no desktop patterns
3. **Non-destructive** - Preserve existing tablet/desktop experience

## Layout Architecture

### Mobile Bottom Bar (< 768px)

```
┌─────────────────────────────────────────────┐
│  [Y] [N] [↵] [Esc] [^C]              [⋯]   │  Quick actions
├─────────────────────────────────────────────┤
│    [↑]                                      │
│  [←][↓][→]   [____input____]       [Send]  │  D-pad + input
└─────────────────────────────────────────────┘
```

**D-pad (left):**
- 4 directional buttons in cross pattern
- ↑ on top row, ←↓→ on bottom row
- Each tap sends corresponding arrow key escape sequence
- Haptic feedback on press

**Text input (center):**
- Single-line by default, expands on focus
- Always visible (not hidden like current mobile)
- Supports autocorrect/prediction

**Send button (right):**
- Sends input + newline
- Disabled state when input empty

**Quick actions (top row):**
- Y, N, Enter, Escape, Ctrl+C
- Palette button (⋯) for full command access

## Tap-to-Select Menu System

### Detection Patterns

Parse terminal output for:
- `❯` or `>` prefix (selection indicator)
- `[ ]` / `[x]` checkboxes
- `?` prompt lines followed by indented options
- `(Y/n)` or `(y/N)` confirmation patterns

### Overlay Rendering

When menu detected:
1. Calculate bounding box of each option line
2. Render transparent tap targets over terminal
3. Show subtle highlight on each tappable option
4. Display floating indicator (e.g., touch icon)

```
┌──────────────────────────────────────┐
│ ? Resume a previous conversation     │
│ ┌──────────────────────────────────┐ │
│ │❯ fix-auth-bug (2h ago)      [TAP]│ │
│ │  add-dark-mode (yesterday)  [TAP]│ │
│ │  refactor-api (3 days)      [TAP]│ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Tap Action Logic

When option tapped:
1. Determine current selection position (find ❯)
2. Calculate delta to tapped option
3. Send N arrow key presses (↑ or ↓)
4. Send Enter key
5. Haptic feedback (medium)
6. Dismiss overlay

### Auto-dismiss

Overlay clears when:
- Selection made
- Menu disappears from terminal buffer
- User scrolls significantly
- 10 second timeout with no interaction

## Copy/Paste System

### Code Block Detection

Scan terminal for fenced code blocks:
```
```language
code here
```
```

When detected:
- Render floating [Copy] button at top-right of block
- Tap copies content (without fence markers)
- Success haptic + toast

### Text Selection

- Long-press (500ms) on terminal enters selection mode
- Drag handles appear for start/end
- Floating toolbar: [Copy] [Copy as Code]
- Tap outside to cancel

### Paste Support

When clipboard has content:
- Show [Paste] chip next to input field
- Tap to insert at cursor
- Auto-show/hide based on clipboard state

## Keyboard Behavior

### Auto-dismiss on Scroll

- Track scroll direction on terminal viewport
- If scrolling UP (reading history): dismiss keyboard
- If scrolling DOWN (following output): keep keyboard
- Threshold: 50px of upward scroll triggers dismiss

### Implementation

```javascript
let lastScrollTop = 0;
viewport.addEventListener('scroll', () => {
  const delta = viewport.scrollTop - lastScrollTop;
  if (delta < -50 && document.activeElement === input) {
    input.blur(); // Dismiss keyboard
  }
  lastScrollTop = viewport.scrollTop;
});
```

## Polish Features

### Sound Cues (Optional)

- Toggle in settings (default: off)
- Sounds for: connected, disconnected, error, Claude waiting
- Use Web Audio API, short subtle tones

### Haptic Patterns

| Event | Pattern |
|-------|---------|
| Button tap | Light (10ms) |
| Send message | Medium (25ms) |
| Menu option select | Medium (25ms) |
| Copy success | Success [10, 50, 10] |
| Error | Error [50, 100, 50] |
| Connection lost | Heavy (50ms) |

### Draft Persistence

- Save input field content to localStorage on change
- Key: `claudepod_draft_${sessionName}`
- Restore on reconnect to same session
- Clear on successful send

### Scroll Position Memory

- Save scroll position on disconnect/switch
- Key: `claudepod_scroll_${sessionName}`
- Restore when reconnecting to session
- Only restore if within last 5 minutes

### System Theme Sync

```javascript
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
prefersDark.addEventListener('change', (e) => {
  // Could auto-switch terminal theme
  // Or just ensure CSS variables respect system
});
```

For now: ClaudePod is always dark (terminal aesthetic), but could add light theme option.

## Implementation Plan

### Phase 1: Core Mobile Layout
1. Redesign mobile bottom bar with D-pad + input
2. Show input bar on mobile (currently hidden)
3. Add quick action row above input
4. Test arrow key sending

### Phase 2: Tap-to-Select
5. Build menu detection parser
6. Create overlay component
7. Implement tap-to-navigate logic
8. Add visual feedback

### Phase 3: Copy/Paste
9. Add code block detection
10. Floating copy buttons
11. Long-press selection mode
12. Paste chip UI

### Phase 4: Polish
13. Keyboard scroll-dismiss
14. Draft persistence
15. Scroll position memory
16. Enhanced haptics
17. Optional sound cues

## Files to Modify

- `public/style.css` - Mobile layout overhaul
- `public/app.js` - D-pad handlers, menu detection, copy/paste
- `public/index.html` - New UI elements (D-pad, overlays)

## Success Criteria

- [ ] Can navigate Claude Code resume menu by tapping options
- [ ] Can use arrow keys via D-pad for any interactive prompt
- [ ] Can copy code blocks with one tap
- [ ] Keyboard dismisses when scrolling up to read
- [ ] Input draft survives reconnection
- [ ] All existing tablet/desktop functionality preserved
