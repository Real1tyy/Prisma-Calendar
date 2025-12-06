# Fill Time from Adjacent Events

Quickly connect event times by filling start/end values from neighboring events. Perfect for scheduling back-to-back meetings or eliminating gaps in your calendar.

## Overview

Fill time operations automatically set an event's start or end time to match an adjacent event's time, creating seamless time continuity between consecutive events.

**Supported event types:** Timed events only (not all-day events)

## Access Methods

### Context Menu (Right-Click)

Right-click any timed event to access:

- **Fill end time from next event**: Sets this event's end time to the next event's start time
- **Fill start time from previous event**: Sets this event's start time to the previous event's end time

**Undo/Redo Support:** These operations are fully integrated with the command history. Use `Ctrl+Z` to undo or `Ctrl+Shift+Z` to redo.

### Event Modal (Create/Edit)

When creating or editing a timed event, use the fill buttons next to the "Now" buttons:

- **Fill prev** (Start Date input): Fills from previous event's end time
- **Fill next** (End Date input): Fills from next event's start time

These buttons appear alongside the existing "Now" buttons for quick access.

## How It Works

### Finding Adjacent Events

The system searches for adjacent events within ±1 day of the current event:

1. Retrieves all timed events (excludes all-day events and skipped events)
2. Finds the current event's position in the chronologically sorted list
3. Iterates forward (for "next") or backward (for "previous") through the list
4. Returns the first valid adjacent event

The system automatically skips adjacent events that already have the same time value, preventing redundant operations when clicking fill multiple times.

**How it works:**
- **Fill end time from next**: Uses the next event's **start time**
- **Fill start time from previous**: Uses the previous event's **end time**
- If the candidate event's time matches your current value, it's skipped automatically

**Example:**
```yaml
Event A: 09:00 - 10:00
Event B: 10:00 - 11:00  # End already matches next event's start
Event C: 11:00 - 12:00
```

When filling Event B's end time:
1. First candidate is Event C (start: 11:00)
2. Event B already has end time 11:00 (same as Event C's start)
3. System skips Event C and continues to the next event
4. Prevents no-op operations and finds the next meaningful change

This allows you to repeatedly click "Fill" to chain-fill through multiple adjacent events until all gaps are closed.

## Use Cases

### Back-to-Back Meetings

Schedule consecutive meetings without gaps:

```yaml
# Before
Meeting 1: 09:00 - 09:45
Meeting 2: 10:00 - 11:00

# After: Fill Meeting 1's end time from Meeting 2
Meeting 1: 09:00 - 10:00  ← Filled
Meeting 2: 10:00 - 11:00
```

### Time Block Planning

Connect work blocks to eliminate calendar gaps:

```yaml
# Before
Deep Work: 08:00 - 10:30
Code Review: 11:00 - 12:00

# After: Fill Code Review's start time from Deep Work
Deep Work: 08:00 - 10:30
Code Review: 10:30 - 12:00  ← Filled
```

### Accurate Time Tracking

Ensure time logs cover all working hours:

```yaml
# Before
Task A: 14:00 - 15:30
Task B: 16:00 - 17:00

# After: Fill Task B's start from Task A
Task A: 14:00 - 15:30
Task B: 15:30 - 17:00  ← Filled (captures the 30-minute gap)
```

## Best Practices

**When to use fill operations:**
- Scheduling consecutive meetings
- Closing gaps in time tracking
- Planning continuous work blocks
- Ensuring accurate duration reporting

**When to avoid:**
- Events that genuinely have breaks between them
- All-day events (not supported)
- Events across different days (may find wrong neighbor)

## Configuration

No additional configuration required. Fill time operations use your calendar's existing:
- Start property (configured in calendar settings)
- End property (configured in calendar settings)
- Event scanning directory

## Keyboard Workflow

1. Right-click event
2. Select "Fill end time from next event" or "Fill start time from previous event"
3. Time is updated immediately
4. Use `Ctrl+Z` to undo if needed

## Related Features

- [Undo/Redo](./undo-redo.md) - All fill operations support undo/redo
- [Batch Operations](./batch-operations.md) - Move/clone multiple events at once
- [Event Previews](./event-previews.md) - View event details before filling
- [Time Tracker](./time-tracker.md) - Track event duration with stopwatch
