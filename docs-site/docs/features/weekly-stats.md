# Weekly Statistics

Track how you spend your time with visual insights and detailed breakdowns of your events.

## Overview

The Weekly Statistics feature provides a comprehensive time tracking visualization that shows how your time is distributed across different event categories. It generates a pie chart and detailed statistics table for any given week, making it easy to understand your time allocation patterns.

## Key Features

- **📊 Visual Pie Chart**: Color-coded pie chart showing duration distribution across event categories
- **📋 Detailed Breakdown Table**: See event count, total duration, and percentage for each category
- **🔄 Week Navigation**: Easily browse through past and future weeks with arrow buttons
- **🎯 Smart Grouping**: Automatic grouping of events by name and type
- **⏱️ Timed Events Focus**: Only includes timed events for meaningful duration tracking

## Opening Weekly Statistics

Access the weekly statistics modal in two ways:

1. **Command Palette**: Open the command palette and search for `Show weekly statistics`
2. **Hotkey**: Assign a custom hotkey in Obsidian settings under Hotkeys

The modal opens showing statistics for the current week (based on the calendar's displayed date).

## How Event Grouping Works

### Recurring Events

All recurring (virtual) events are automatically grouped together under a single "Recurring Events" category, regardless of their individual names. This provides a clear view of how much time your recurring activities take up.

**Example:**
```yaml
# Daily standup instances (recurring)
- 2025-02-03 09:00-09:15: Daily Standup
- 2025-02-04 09:00-09:15: Daily Standup
- 2025-02-05 09:00-09:15: Daily Standup

# Grouped as: "Recurring Events" (45 minutes total)
```

### Non-Recurring Events

Non-recurring events are grouped by name after automatically stripping common ID patterns:

- **Zettel IDs** (14-digit timestamps): `Gym 20250203140530` → `Gym`
- **ISO Date Formats**: `Meeting - 2025-02-03` → `Meeting`
- **Trailing Timestamps**: `Task 123456789` → `Task`

This intelligent grouping allows multiple instances of the same activity (like gym sessions or meetings) to be aggregated together even if they have unique identifiers.

**Example:**
```yaml
# Multiple gym sessions with different Zettel IDs
---
Title: Gym 20250203140530
Start Date: 2025-02-03T10:00
End Date: 2025-02-03T11:00
---

---
Title: Gym 20250205150000
Start Date: 2025-02-05T10:00
End Date: 2025-02-05T11:30
---

# Both grouped as: "Gym" (2 events, 150 minutes total)
```

## What Gets Included

### ✅ Included in Statistics

- **Timed Events**: Events with specific start and end times
- **Events with Duration**: Only events that have a meaningful duration (start + end time)
- **Events in Week Range**: Events that fall within Monday to Sunday of the selected week

### ❌ Excluded from Statistics

- **All-Day Events**: Events marked as all-day don't have meaningful durations for time tracking
- **Events Without End Time**: Timed events missing an end time (duration = 0)
- **Events Outside Week**: Events that don't overlap with the selected week

## Understanding the Statistics

### Pie Chart

The pie chart visualizes time distribution with:

- **Color-Coded Slices**: Each category gets a distinct color
- **Proportional Sizing**: Slice size represents the percentage of total time
- **Interactive Tooltips**: Hover over slices to see exact durations and percentages

### Statistics Table

The breakdown table shows:

| Event Name | Count | Duration | Percentage |
|------------|-------|----------|------------|
| Gym | 3 | 4h 30m | 22.5% |
| Meetings | 5 | 7h 15m | 36.3% |
| Recurring Events | 10 | 2h 30m | 12.5% |
| Deep Work | 4 | 5h 45m | 28.7% |

**Columns:**
- **Event Name**: The grouped event category name
- **Count**: Number of individual events in this category
- **Duration**: Total time spent (formatted as days, hours, minutes)
- **Percentage**: Proportion of total weekly time

**Sorting:**
- Entries are automatically sorted by duration (longest first)
- Helps you quickly identify your biggest time commitments

### Weekly Summary

At the top of the modal, see:

- **Week Range**: Monday - Sunday dates for the current view
- **Total Duration**: Sum of all timed events in the week
- **Total Events**: Count of all included events

## Navigation

### Week Arrows

- **← Previous Week**: Jump back 7 days
- **Next Week →**: Jump forward 7 days

The week range updates automatically, and statistics recalculate instantly.

### Current Week

The modal opens showing the week containing the date currently displayed in the calendar view. If the calendar shows February 5th, you'll see statistics for the week of February 3-9.

## Use Cases

### 🎯 Time Tracking
Monitor how much time you spend on different activities throughout the week.

**Example:**
```
Weekly Statistics (Feb 3 - Feb 9)
- Meetings: 12h 30m (35%)
- Deep Work: 18h 45m (53%)
- Recurring Events: 4h 15m (12%)
```

### 📊 Productivity Analysis
Compare weeks to identify productivity patterns and time allocation trends.

**Example:**
Compare last week's "Deep Work" time (18h) vs. this week (12h) to spot changes in focus time.

### ⚖️ Work-Life Balance
Ensure you're allocating time appropriately across work, personal, and recurring activities.

**Example:**
```
- Work Events: 40h (70%)
- Personal Events: 12h (21%)
- Recurring Events: 5h (9%)
```

### 🔍 Category Review
See which activity categories dominate your schedule and adjust accordingly.

**Example:**
If "Meetings" takes up 60% of your week, you might want to reduce meeting time and increase focus work.

## Tips & Best Practices

### 📝 Consistent Naming
Use consistent base names for similar events to leverage automatic grouping:

```yaml
# Good - Will group together
Title: Gym 20250203140530
Title: Gym 20250205150000
Title: Gym 20250207110000

# Less ideal - Won't group
Title: Gym Session
Title: Workout
Title: Fitness
```

### ⏰ Always Set End Times
Events without end times are excluded (duration = 0). Always specify end times for accurate tracking:

```yaml
# ✅ Good - Included in stats
Start Date: 2025-02-03T10:00
End Date: 2025-02-03T11:30

# ❌ Missing end - Excluded from stats
Start Date: 2025-02-03T10:00
```

### 🎨 Category Strategy
Think about how you want to track time and name events accordingly:

**By Activity Type:**
- "Deep Work", "Meetings", "Admin", "Learning"

**By Project:**
- "Project Alpha", "Project Beta", "Project Gamma"

**By Client:**
- "Client A", "Client B", "Client C"

### 🔄 Regular Review
Make weekly statistics review part of your routine:

1. **Monday Morning**: Review last week's time allocation
2. **Identify Patterns**: Note which categories dominated
3. **Plan Adjustments**: Allocate time more intentionally for the new week
4. **Track Progress**: Compare week-over-week to see improvements

## Troubleshooting

### No Events Showing

**Problem:** The modal shows "No events found for this week."

**Solutions:**
- Check that you have timed events (not all-day events) in the selected week
- Verify events have end times specified
- Ensure the week range covers your events (use navigation arrows)
- Confirm events aren't filtered out by active search/filter expressions

### Events Not Grouping

**Problem:** Similar events appear as separate categories.

**Solutions:**
- Ensure event names follow consistent patterns
- Check that the base name (after stripping IDs) is identical
- Verify case sensitivity (use same capitalization)

### Unexpected Duration

**Problem:** Duration seems incorrect for an event.

**Solutions:**
- Verify start and end times in the event frontmatter
- Check for timezone issues in ISO date strings
- Ensure end time is after start time
- Confirm the event falls within the week range

### Missing Recurring Events

**Problem:** Recurring events aren't appearing in statistics.

**Solutions:**
- Check that recurring events are timed (not all-day)
- Verify recurring instances are being generated for the week
- Ensure the recurring event series isn't disabled
- Confirm instances fall within the week range

## Related Features

- **[Global Event Search](./global-search.md)**: Search and filter events across your calendar
- **[Filtering](./filtering.md)**: Filter events by properties and expressions
- **[Recurring Events](./recurring-dsl.md)**: Set up recurring event series
- **[Event Previews](./event-previews.md)**: View detailed event information

## Technical Details

### Week Definition

- **Start**: Monday at 00:00:00 (local timezone)
- **End**: Following Monday at 00:00:00 (local timezone)
- **Duration**: Exactly 7 days

### Event Inclusion Criteria

An event is included if:
1. It's a timed event (`allDay === false`)
2. It has an end time (or duration > 0)
3. It overlaps with the week range:
   - Event starts before week ends AND
   - Event ends after week starts

### Duration Calculation

- **With End Time**: `end - start` (in milliseconds)
- **Without End Time**: 0 (excluded from stats)
- **All-Day Events**: Excluded entirely

### Data Source

Statistics use events from 1 year before to 1 year after the current week to ensure all relevant events are available as you navigate between weeks.
