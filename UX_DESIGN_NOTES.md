# Automation UX Design — Progressive Disclosure, Mobile-First, Shared Sessions

## Core Principle: The Grill-Side Experience

The user is standing next to a smoker, phone in one hand, tongs in the other. Maybe it's 5 AM and they're bleary-eyed checking on a brisket. Maybe they're at a family BBQ with beer in hand. The UI must work for both.

**Design mantra: "Glance → Tap → Dive"**

### Layer 1: Glance (0-2 seconds)
What the user sees without touching anything:
- **Is something cooking?** → Big status indicator (green pulse = active, nothing = idle)
- **What phase am I in?** → Phase name + number in large text
- **What's the current temp vs target?** → Two big numbers, color-coded (approaching = amber, reached = green, exceeded = red)
- **Do I need to do anything?** → Alarm banner at top if action needed, otherwise clean

### Layer 2: Tap (2-10 seconds)
One tap reveals more:
- **Expand current phase** → See trigger details (temp target, timer countdown, compound logic)
- **See phase timeline** → Horizontal stepper showing all phases, current highlighted
- **Quick actions** → Acknowledge alarm, skip phase, override temp — big touch targets (48px+)

### Layer 3: Dive (10+ seconds, optional)
For the curious or when configuring:
- **Full step list** → Expandable accordion with all phases, their triggers, actions, alerts
- **Variable editor** → Adjust temps, times, doneness mid-cook
- **History log** → What auto-commands fired, when phases advanced, what was overridden

## Mobile-First Layout Decisions

### Touch Targets
- All interactive elements: minimum 44px (Apple HIG) / 48px (Material Design)
- Action buttons: full-width on mobile, inline on desktop
- Swipe gestures: swipe left on a phase to skip, swipe right to acknowledge

### Responsive Breakpoints
- **< 640px (mobile)**: Single column, stacked cards, bottom-sheet for details
- **640-1024px (tablet)**: Two-column for preset library, side panel for details
- **> 1024px (desktop)**: Three-column layout possible, inline detail panels

### Information Density
- Mobile: Show only Layer 1 by default, everything else behind taps
- Desktop: Show Layer 1 + Layer 2 by default, Layer 3 behind clicks

## Step Preview — Compound Trigger Display

Each step card shows:
```
┌─────────────────────────────────────────┐
│ ① Low & Slow                           │
│ 🔥 180°F  │  🌡️ Probe → 160°F          │
│           │  ⏱️ OR 8hr fallback         │
│           │  🔔 Alarm (escalating 5°F)  │
│                                    [▼]  │
└─────────────────────────────────────────┘
```

Collapsed (Layer 1): Step name, grill temp, primary trigger
Expanded (Layer 2): Secondary trigger, alert type, entry actions, notes

The `[▼]` chevron is subtle — not a tooltip, not a popup, just an expand indicator.

## Alert vs Alarm Visual Language

| Type | Icon | Color | Behavior | Badge |
|------|------|-------|----------|-------|
| Notification | 🔔 | Blue | One-time, auto-dismiss | "Notify" |
| Alarm | 🚨 | Amber | Persistent, requires tap to dismiss | "Alarm" |
| Escalating Alarm | 🚨⬆️ | Red | Re-fires every N°F, requires tap | "Alarm +5°F" |

## Shared Session Control

### How it works:
- Multiple browsers/devices can be logged into the same Traeger account
- Each gets the same SSE telemetry stream (already works)
- Automation state is server-side (already works)
- **New**: Show a "viewers" indicator when multiple SSE connections exist for the same grill

### Control model:
- **No locking** — any connected user can acknowledge alarms, skip phases, override temps
- **Activity feed** — show "Jacob acknowledged alarm" or "Dad skipped to Phase 3" in a subtle log
- **Conflict resolution** — last write wins (same as Traeger's own app)

### Why no locking:
Locking creates frustration ("Dad's phone is locked and he's asleep!"). For a family grill, collaborative control is better than exclusive control. The activity feed provides accountability without restriction.

## Contextual Education

### First-use hints:
- On first visit to Automation page: subtle banner "Browse presets to get started, or create a custom program"
- On first preset selection: inline hint next to variables "Adjust these to match your cook"
- On first live execution: pulse animation on the acknowledge button with tiny label "Tap to silence"

### After first use:
- Hints disappear (stored in localStorage)
- Accessible via small `?` icon in section headers (not a tooltip — opens a brief inline explainer)
- Never a modal popup, never a tour, never a tooltip that blocks content

## Color Coding System

| State | Color | Usage |
|-------|-------|-------|
| Active/Running | Green (#22c55e) | Phase progress, live indicator |
| Approaching Target | Amber (#f59e0b) | Temp within 10°F of trigger |
| Target Reached | Primary (copper) | Trigger fired, action needed |
| Exceeded/Warning | Red (#ef4444) | Overcooked, temp too high |
| Idle/Waiting | Muted | Inactive phases, no cook |
| Auto-Command Sent | Blue (#3b82f6) | Grill temp changed automatically |
