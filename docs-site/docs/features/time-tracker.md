# Time Tracker

Built-in stopwatch in Create/Edit Event modal for precise time tracking with automatic break tracking.

## Quick Start

1. Open Create Event modal
2. Expand **▶ Time tracker** header
3. **▶ start** (fills Start Date)
4. **⏸ break** / **▶ resume** as needed
5. **⏹ stop** (fills End Date and Break field)
6. Save event

## Interface

![Time Tracker Stopwatch](/img/stopwatch.png)

**Collapsed** (default): Click **▶ Time tracker** header to expand

**Controls**:
- **▶ start**: Begin tracking, fills Start Date
- **⏸ break**: Pause productive time, count break time
- **▶ resume**: End break, resume productive time
- **⏹ stop**: End session, fills End Date and Break field
- **− minimize**: Save modal state, continue tracking internally. Restore via "Restore minimized event modal" command

## Minimize & Auto-Save

**Manual Minimize**: Click **−** to save modal state (pre-configure events for later)

**Auto-Save**: When timer is running, closing modal (ESC, click outside, Cancel) automatically saves state. Timer continues in background.

**Restore**: `Ctrl/Cmd+P` → "Restore minimized event modal"

**Notes**: Only one modal at a time. State lost if Obsidian closed.

## Displays

**Elapsed Time** (HH:MM:SS): Total time since start, including breaks

**Break Time** (MM:SS): Accumulated break time, saved to Break field in minutes when stopped

## Integration

**[Statistics](./statistics)**: Break time subtracted from duration for accurate tracking

**Duration Field**: Updates automatically on start/stop

**[Event Presets](./overview#event-presets)**: Works alongside presets for template + precision timing

## Configuration

**Enable/Disable**: Settings → [Calendar] → General → "Show time tracker in event modal"

**Break Property**: Settings → [Calendar] → Properties → "Break property" (default: `Break`)

**Timed Events Only**: Only visible when "All day" is unchecked

## Related Features

- [Statistics](./statistics) - Break time subtracted from duration
- [Event Creation](./overview#event-creation--editing) - Other creation features
- [Event Presets](./overview#event-presets) - Pre-fill templates
