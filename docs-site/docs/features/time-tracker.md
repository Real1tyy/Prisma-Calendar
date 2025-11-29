# Time Tracker

Track work sessions with precision using the built-in stopwatch in the Create/Edit Event modal.

## Overview

The Time Tracker is a stopwatch feature that helps you create events with accurate start and end times. Instead of manually entering times, you can:

1. **Start** the tracker when you begin working
2. **Take breaks** that are automatically tracked separately
3. **Stop** when you finish to save the exact duration

All times are automatically filled into the event form, including accumulated break time.

## Quick Start

1. Open the **Create Event** modal (click "+" in the calendar or use the command palette)
2. Click the **▶ Time tracker** header to expand the stopwatch
3. Click **▶ start** to begin tracking (fills Start Date with current time)
4. Work on your task...
5. Click **⏹ stop** when done (fills End Date with current time)
6. Fill in the event title and save

## Interface

### Collapsed State (Default)

The time tracker appears collapsed by default to keep the modal clean:

```
▶ Time tracker
```

Click the header to expand it.

### Expanded State

When expanded, you'll see:

```
▼ Time tracker
┌─────────────────────────────────────────┐
│   Elapsed: 00:00:00    Break: 00:00    │
│                                         │
│         [▶ start]                       │
└─────────────────────────────────────────┘
```

## Controls

### ▶ start

- **When visible**: Before tracking starts, or after stopping
- **Action**: Begins the timer and fills **Start Date** with the current time
- **Display text changes to**: "▶ start new" after stopping (for starting a fresh session)

### ⏸ break

- **When visible**: While tracking is running
- **Action**: Pauses productive time tracking; starts counting break time
- **Use for**: Lunch breaks, coffee breaks, interruptions, rest periods

### ▶ resume

- **When visible**: While on a break
- **Action**: Ends the break and resumes counting productive time
- **Break time**: Accumulated break time is preserved and continues to display

### ⏹ stop

- **When visible**: While tracking is running or on break
- **Action**:
  - Ends the tracking session
  - Fills **End Date** with the current time
  - Calculates total break time and fills the **Break** field
  - Stops the timer

### − minimize (modal header)

- **Location**: In the modal header, next to the "Clear" button
- **Action**: Saves the modal state and closes it; stopwatch continues tracking time internally
- **Restore**: Use the command "Restore minimized event modal" (Ctrl/Cmd+P) to bring it back
- **Use for**: Continue working in Obsidian while keeping your event form data saved

## Minimize & Auto-Save Feature

The minimize feature provides two powerful workflows for managing your event modal state. Understanding these workflows helps you track time more effectively.

### Two Workflows

#### Workflow 1: Manual Minimize (Pre-configuration)

**Use case**: You want to set up an event for later but aren't ready to start working yet.

**How it works**:
1. Open the Create/Edit Event modal
2. Fill in event details (title, categories, custom properties, etc.)
3. Click the **−** minimize button in the modal header
4. The modal closes and your configuration is saved
5. Later, restore the modal and continue editing or start the timer

**Example scenario**: You know you'll be working on "Project Report" after lunch. Open the modal now, fill in the title and category, minimize it, and restore it when you're ready to start tracking.

#### Workflow 2: Auto-Save on Close (Background Timer)

**Use case**: You're actively tracking time and want to close the modal without losing your timer.

**How it works**:
1. Open the Create/Edit Event modal
2. Start the stopwatch (click **▶ start**)
3. Close the modal **by any means**:
   - Press **ESC**
   - Click outside the modal
   - Click the **Cancel** button
4. ✨ **The timer automatically saves in the background** ✨
5. The stopwatch continues running invisibly
6. Restore the modal later—your elapsed time is preserved

**Key insight**: When the timer is running, you don't need to manually click minimize. **Just close the modal however you want**—ESC, clicking outside, whatever feels natural. The plugin automatically saves your state because it detects the active stopwatch.

**Example scenario**: You're tracking time on a task, but you need to quickly look something up in another note. Just press ESC to close the modal. The timer keeps running. When you're done, restore the modal and your time is still being tracked.

### Comparison

| Action | Timer Running | Timer NOT Running |
|--------|---------------|-------------------|
| Click **−** minimize button | ✅ State saved, timer continues | ✅ State saved |
| Press **ESC** | ✅ **Auto-saved**, timer continues | ❌ Modal closed, nothing saved |
| Click outside modal | ✅ **Auto-saved**, timer continues | ❌ Modal closed, nothing saved |
| Click **Cancel** button | ✅ **Auto-saved**, timer continues | ❌ Modal closed, nothing saved |

### How to Restore

1. Open the command palette (**Ctrl/Cmd+P**)
2. Search for **"Restore minimized event modal"**
3. Press Enter to restore the modal

The modal returns with:
- All form fields preserved (title, dates, categories, custom properties, etc.)
- Stopwatch state intact (if active: running/paused, elapsed time, break time)
- For edit modals: the same file path is used, so changes save to the original file
- Ready to continue editing or save

### Important Notes

- **Only one modal**: Only one modal can be minimized at a time. Minimizing/auto-saving a new modal discards the previously saved one.
- **Command availability**: The restore command only appears in the palette when there's a minimized modal
- **Closing Obsidian**: Minimized modal state is lost if Obsidian is closed
- **Edit vs Create**: When editing an existing event, the file path is preserved so changes save to the correct file
- **Minimize button always available**: You can always click the **−** button to manually save state, regardless of timer status

## Displays

### Elapsed Time (HH:MM:SS)

Shows the **total time since pressing start**, including breaks. This is the full duration from start to current moment.

**Format**: `HH:MM:SS` (hours, minutes, seconds)

**Example**: `01:23:45` = 1 hour, 23 minutes, 45 seconds

### Break Time (MM:SS)

Shows the **accumulated break time** across all break periods in the current session.

**Format**: `MM:SS` (minutes, seconds)

**Example**: `15:30` = 15 minutes, 30 seconds of break time

The break time is also saved to the **Break** field in minutes (with decimal precision) when you stop.

## Workflow Examples

### Simple Work Session

**Scenario**: Track a focused work session without breaks.

1. Create new event
2. Expand time tracker, click **▶ start**
3. Work for 2 hours
4. Click **⏹ stop**
5. Add title: "Deep Work - Project Alpha"
6. Save

**Result**:
```yaml
---
Title: Deep Work - Project Alpha
Start Date: 2025-02-03T09:00
End Date: 2025-02-03T11:00
---
```

### Work Session with Lunch Break

**Scenario**: Track a full morning including a 30-minute lunch.

1. Create new event, click **▶ start** at 9:00 AM
2. Work until noon
3. Click **⏸ break** at 12:00 PM (lunch break)
4. Return at 12:30 PM, click **▶ resume**
5. Continue working
6. Click **⏹ stop** at 2:00 PM
7. Add title: "Morning Work"
8. Save

**Result**:
```yaml
---
Title: Morning Work
Start Date: 2025-02-03T09:00
End Date: 2025-02-03T14:00
Break: 30  # 30 minutes automatically calculated
---
```

**Statistics**: Event shows as 4.5 hours in statistics (5h total - 30min break).

### Multiple Short Breaks

**Scenario**: Track work with several short breaks (coffee, stretch, etc.).

1. Click **▶ start** at 9:00 AM
2. Work until 10:30 AM
3. Click **⏸ break** (coffee break)
4. Click **▶ resume** at 10:40 AM
5. Work until 12:00 PM
6. Click **⏸ break** (lunch)
7. Click **▶ resume** at 12:45 PM
8. Work until 3:00 PM
9. Click **⏸ break** (stretch)
10. Click **▶ resume** at 3:05 PM
11. Work until 5:00 PM
12. Click **⏹ stop**

**Result**:
```yaml
---
Start Date: 2025-02-03T09:00
End Date: 2025-02-03T17:00
Break: 60  # 10min + 45min + 5min = 60 minutes
---
```

**Statistics**: 7 hours of productive time (8h total - 1h breaks).

### Starting a New Session

**Scenario**: Finished one task, want to track a different task.

1. After stopping the first session, click **▶ start new**
2. Timer resets to 00:00:00, break time resets to 00:00
3. Start Date updates to the new current time
4. Track your new session

**Note**: Remember to save the first event before starting a new session!

## Integration with Other Features

### Break Time in Statistics

Break time tracked by the stopwatch integrates with [Statistics](./weekly-stats.md):

- The **Break** field value is automatically subtracted from event duration
- Weekly, monthly, and all-time statistics show accurate productive time
- Your 8-hour tracked day with 1 hour of breaks shows as 7 hours

### Duration Field

If you have the **Duration field** enabled (Settings → General → Parsing):

- Duration updates automatically when you start/stop
- Duration = End Date - Start Date (doesn't subtract break time from display)
- Statistics handle the break subtraction automatically

### Event Presets

Time tracker works alongside [Event Presets](./overview.md#event-presets):

1. Select a preset to pre-fill categories, custom properties, etc.
2. Use time tracker to capture exact start/end times
3. Best of both worlds: template + precision timing

## Configuration

### Enable/Disable

Toggle the time tracker visibility in settings:

1. Go to **Settings** → **[Calendar Name]** → **General**
2. Find **"Show time tracker in event modal"**
3. Toggle on (default) or off

When disabled, the time tracker section won't appear in Create/Edit modals.

### Break Property Name

Configure the frontmatter property name for break time:

1. Go to **Settings** → **[Calendar Name]** → **Properties**
2. Find **"Break property"**
3. Default is `Break`, change if needed

## Timed Events Only

The time tracker is **only visible for timed events**:

- ✅ **Shown**: When "All day" is unchecked (timed events)
- ❌ **Hidden**: When "All day" is checked (all-day events)

All-day events don't have meaningful start/end times, so the stopwatch doesn't apply.

## Tips & Best Practices

### 🎯 Click Start Immediately

Don't wait to click start—do it right when you begin working. You can always edit the start time manually if you forgot.

### ⏸ Use Breaks Liberally

Track all interruptions as breaks:
- Phone calls
- Quick chats with coworkers
- Coffee/snack breaks
- Bathroom breaks
- Context switching time

This gives you accurate productive time tracking.

### 📝 Add Title Before Stopping

Fill in the event title while the timer is still running. This way you don't forget what you were working on.

### 🔄 One Session Per Event

Each start/stop cycle creates one event. If you're switching tasks:
1. Stop and save the current event
2. Start a new event for the next task

### 📊 Review Your Data

Use [Weekly Statistics](./weekly-stats.md) to review:
- How much time you're actually working vs. on break
- Which activities take the most time
- Patterns in your productive hours

## Troubleshooting

### Time Tracker Not Visible

**Problem**: Can't see the time tracker in the modal.

**Solutions**:
1. Check that "Show time tracker in event modal" is enabled in settings
2. Make sure "All day" is unchecked (time tracker only shows for timed events)
3. Click the "▶ Time tracker" header to expand it

### Break Time Not Saving

**Problem**: Break field is empty after stopping.

**Solutions**:
1. Ensure you have a **Break property** configured in Settings → Properties
2. Check that you actually used the break button during tracking
3. Verify the break time wasn't 0 (no breaks taken)

### Times Seem Wrong

**Problem**: Start/End times don't match when you clicked.

**Solutions**:
1. Times are captured at the moment of click—ensure you clicked at the right time
2. Check your system clock is accurate
3. Times use your local timezone

### Timer Keeps Running After Closing Modal

**Problem**: Concerned about the timer continuing after closing.

**Solution**: This is intentional! When the timer is running and you close the modal (ESC, click outside, etc.), the timer state is **automatically saved** and continues in the background. This lets you:
- Close the modal without worrying about losing your tracked time
- Continue working in Obsidian while the timer runs
- Restore the modal later with all your time preserved

To restore: Open command palette (**Ctrl/Cmd+P**) → Search **"Restore minimized event modal"**

**Note**: If the timer is NOT running when you close the modal, the state is NOT saved (unless you explicitly click the minimize button).

### Can't Find Minimized Modal

**Problem**: Minimized the modal but can't find how to restore it.

**Solutions**:
1. Open command palette (**Ctrl/Cmd+P**)
2. Search for **"Restore minimized event modal"**
3. Press Enter to restore

If the command doesn't appear:
- There may not be a minimized modal (it was closed or Obsidian was restarted)
- Start a new event and tracking session

### Minimize Button Not Visible

**Problem**: Can't see the − button in the modal header.

**Solutions**:
The minimize button should always be visible in the Create/Edit Event modal header. If you can't see it:
1. Make sure you're in the event modal (Create Event or Edit Event)
2. Look for the "−" button next to the "Clear" button in the header

## Related Features

- **[Statistics](./weekly-stats.md)**: View time breakdowns with break time accounted for
- **[Break Time Property](./weekly-stats.md#break-time-property)**: Details on how break time affects statistics
- **[Event Creation](./overview.md#event-creation--editing)**: Other event creation features
- **[Event Presets](./overview.md#event-presets)**: Pre-fill event templates alongside time tracking
