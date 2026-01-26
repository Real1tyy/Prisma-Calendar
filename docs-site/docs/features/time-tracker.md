# Time Tracker

Built-in stopwatch in Create/Edit Event modal for precise time tracking with automatic break tracking.

## Quick Start

1. Open Create Event modal
2. Expand **▶ Time tracker** header
3. Click **▶ start** (fills Start Date with current time and End Date with start time + default duration, starts tracking)
4. Work on your task - watch the **Session** timer at the bottom track your current work session
5. Click **⏸ break** when you need a break - the **Current Break** timer appears at the bottom
6. Click **▶ resume** (on pause button) when ready to continue - the **Session** timer restarts from zero
7. Click **⏹ stop** when done (updates End Date to current time and fills Break field with accumulated break time)
8. **Optional**: Click **▶ resume** (new button) to continue tracking without resetting start time
9. Save event

**Tip**: Use the **Session** timer to track individual work sessions, and the **Total Break** timer to see cumulative break time across your entire tracking session.

## Interface

![Time Tracker Stopwatch](/img/stopwatch.png)

**Collapsed** (default): Click **▶ Time tracker** header to expand

**Controls**:
- **▶ start**: Begin tracking, fills Start Date with current time and End Date with start time + default duration (configured in settings). Starts both the total timer and session timer.
- **▶ start new**: (After stopping) Start a completely new tracking session with a fresh start time and auto-filled end time.
- **▶ continue**: (Optional, when enabled in settings) Continue tracking from the existing start date in the event. Calculates elapsed time based on the event's start time and resumes tracking from that point. Perfect for resuming work on existing events.
- **⏸ break**: Pause productive time and start tracking break time. The total timer continues, but the session timer pauses and the current break timer starts.
- **▶ resume** (during break): End break and resume productive time. The current break time is added to total break time, and the session timer restarts from zero.
- **▶ resume** (after stop): Continue tracking from where you left off without resetting the start time. Perfect for resuming work after interruptions while maintaining accurate time tracking.
- **⏹ stop**: End session, fills End Date and Break field. Stops all timers and saves the accumulated break time.
- **− minimize**: Save modal state, continue tracking internally. Restore via "Restore minimized event modal" command

## Start vs Continue

**▶ start**: Creates a new start time (now) and end time (now + default duration) and begins tracking. Use this when:
- Creating a brand new event
- Starting work exactly when you click the button
- You want both start and end times to be auto-filled based on the current time

**▶ continue**: Uses the existing start time from the event and continues from there. Use this when:
- Resuming work on an existing event
- The event already has a start time you want to preserve
- You want the timer to show elapsed time since the original start

**Example**: An event has `Start: 10:00 AM` and it's now `10:30 AM`. Assume default duration is 60 minutes.
- Click **▶ start**: Start time changes to 10:30 AM, End time set to 11:30 AM (10:30 + 60 min), timer starts from 00:00:00
- Click **▶ continue**: Start time stays 10:00 AM, End time unchanged, timer shows 00:30:00 and continues

## Resume After Stopping

**How it works**:
1. Click **⏹ stop** - the timer stops and fills the End Date field
2. The **▶ resume** button appears alongside **▶ start new** buttons
3. Click **▶ resume** to continue tracking from where you left off
4. The start time remains unchanged, and the timer continues accumulating time accurately

**Difference from Break**:
- **Break** (⏸): Pauses the timer but keeps it in an active state. The total timer continues running. Best for short breaks during active work.
- **Resume** (after stop): Restarts the timer after it has been completely stopped. The end time was filled, but you want to continue. Best for resuming work after interruptions.

## Minimize & Auto-Save

**Manual Minimize**: Click **−** to save modal state (pre-configure events for later)

**Auto-Save**: When timer is running, closing modal (ESC, click outside, Cancel) automatically saves state. Timer continues in background.

**Restore**: `Ctrl/Cmd+P` → "Restore minimized event modal"

**Quick Category Assignment**: `Ctrl/Cmd+P` → "Assign categories to minimized event" - Update categories without restoring the full modal

**Auto-Updates**: While tracking time with a minimized modal, the modal automatically stays in sync with the event file:
- **File Changes**: If you edit the event from another window (e.g., rename the file, change properties), the minimized modal updates automatically with the new information
- **File Deletion**: If the event file is deleted, the minimized modal is cleared automatically with a notification
- **Smart Tracking**: Updates only occur when the stopwatch is actively running or paused, ensuring preset saves aren't overwritten

**Notes**: Only one modal at a time. State lost if Obsidian closed.

## Displays

The stopwatch displays multiple timers to give you complete visibility into your time tracking:

### Top Row Timers

**Total** (HH:MM:SS): Total elapsed time since you started the stopwatch, including all breaks. This represents the complete duration from when you clicked "start" until now.

**Total Break** (HH:MM:SS): Accumulated break time across all breaks taken during the session. This includes all past breaks plus the current break (if paused). Saved to the Break field in minutes (with decimal precision) when you stop the timer.

### Bottom Timer (Mid Timer)

**Session** (HH:MM:SS): Shown when the stopwatch is **running**. Displays the current session time - the time elapsed since you last clicked "start" or "resume". This timer resets each time you resume from a break, giving you visibility into how long your current work session has been.

**Current Break** (HH:MM:SS): Shown when the stopwatch is **paused** (in break mode). Displays the duration of the current active break - how long you've been on break since clicking "break". This helps you track individual break durations.

**Note**: The mid timer automatically switches between "Session" and "Current Break" based on whether you're actively working or on break. Only one is visible at a time.

## Integration

**[Statistics](./statistics)**: Break time subtracted from duration for accurate tracking

**Duration Field**: Updates automatically on start/stop

**[Event Presets](./overview#event-presets)**: Works alongside presets for template + precision timing

## Configuration

**Enable/Disable**: Settings → [Calendar] → General → "Show time tracker in event modal"

**Continue Button**: Settings → [Calendar] → General → "Show 'continue' button" (disabled by default). Enable this to show the continue button alongside the start button.

**Break Property**: Settings → [Calendar] → Properties → "Break property" (default: `Break`)

**Timed Events Only**: Only visible when "All day" is unchecked

## Related Features

- [Statistics](./statistics) - Break time subtracted from duration
- [Event Creation](./overview#event-creation--editing) - Other creation features
- [Event Presets](./overview#event-presets) - Pre-fill templates
