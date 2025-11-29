# Statistics

Track how you spend your time with visual insights and detailed breakdowns of your events across different time periods.

## Screenshots

### Statistics by Event Name

![Weekly Statistics - Event Name Mode](/img/weekly_stats_pie.png)

*Pie chart and breakdown table showing time distribution grouped by event name*

### Statistics by Category

![Weekly Statistics - Category Mode](/img/weekly_stats_pie_category.png)

*Pie chart showing time distribution grouped by frontmatter category property*

### Detailed Breakdown Table

![Statistics Table](/img/weekly_stats_table.png)

*Complete breakdown with event count, duration, and percentage for each category*

## Overview

The Statistics feature provides comprehensive time tracking visualizations that show how your time is distributed across different event categories. Choose from three different views:

- **📅 Weekly Statistics**: Analyze a specific week (Monday-Sunday)
- **📆 Monthly Statistics**: Review an entire month's time allocation
- **🌍 All-Time Statistics**: See lifetime totals across all your events

Each view generates a pie chart and detailed statistics table, making it easy to understand your time allocation patterns at different scales.

## Key Features

- **📊 Visual Pie Chart**: Color-coded pie chart showing duration distribution across event categories
- **📋 Paginated Breakdown Table**: Detailed table with event count, duration, and percentage (20 entries per page for better performance)
- **🔄 Period Navigation**: Browse through weeks, months, or view all-time totals
- **🎯 Smart Grouping**: Automatic grouping of events by name and type
- **⏱️ Timed Events Focus**: Only includes timed events for meaningful duration tracking

## Statistics Types

### Weekly Statistics

Analyze time spent during a specific week (Monday-Sunday).

**Opening:**
1. **Command Palette**: `Show weekly statistics`
2. **Hotkey**: Assign a custom hotkey in Obsidian settings

**Navigation:**
- **← Previous**: Jump back 7 days
- **Next →**: Jump forward 7 days
- **Today**: Return to the current week

The modal opens showing statistics for the current week based on the calendar's displayed date.

### Monthly Statistics

Review time allocation across an entire calendar month.

**Opening:**
1. **Command Palette**: `Show monthly statistics`
2. **Hotkey**: Assign a custom hotkey in Obsidian settings

**Navigation:**
- **← Previous**: Jump to previous month
- **Next →**: Jump to next month
- **Today**: Return to the current month

Perfect for monthly reviews, billing periods, or monthly goal tracking.

### All-Time Statistics

View cumulative statistics across all events in your vault.

**Opening:**
1. **Command Palette**: `Show all-time statistics`
2. **Hotkey**: Assign a custom hotkey in Obsidian settings

**Features:**
- No navigation controls (shows everything)
- Pagination automatically enabled for large datasets
- Great for lifetime productivity analysis and long-term pattern identification

The modal shows statistics for all events across your entire calendar history.

## How Event Grouping Works

### Aggregation Modes

Statistics support two aggregation modes, toggled via the mode button in the statistics modal:

1. **Event Name Mode** (default): Groups events by their cleaned title names
2. **Category Mode**: Groups events by their frontmatter category property

### Recurring Events (Name Mode)

All recurring (virtual) events are automatically grouped together under a single "Recurring Events" category, regardless of their individual names. This provides a clear view of how much time your recurring activities take up.

**Example:**
```yaml
# Daily standup instances (recurring)
- 2025-02-03 09:00-09:15: Daily Standup
- 2025-02-04 09:00-09:15: Daily Standup
- 2025-02-05 09:00-09:15: Daily Standup

# Grouped as: "Recurring Events" (45 minutes total)
```

### Non-Recurring Events (Name Mode)

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

### Multi-Category Support (Category Mode)

When using **Category Mode**, events with multiple comma-separated categories are counted under **each category separately**. This enables flexible categorization where a single event can contribute to multiple statistical groupings.

#### How It Works

If an event has `Category: Work, Learning`, its full duration is added to both the "Work" and "Learning" categories in statistics. This reflects the reality that many activities serve multiple purposes.

**Example:**
```yaml
---
Title: Team Workshop
Start Date: 2025-02-03T09:00
End Date: 2025-02-03T12:00
Category: Work, Learning, Team Building
---
```

This 3-hour event contributes:
- **Work**: 3 hours
- **Learning**: 3 hours
- **Team Building**: 3 hours

#### Category Format

Categories can be specified in several formats:

```yaml
# Single category
Category: Work

# Multiple categories (comma-separated)
Category: Work, Personal

# Multiple categories (no spaces)
Category: Work,Personal,Health

# Whitespace is trimmed automatically
Category:   Work  ,  Personal  ,  Health
```

#### Use Cases

**Cross-functional activities:**
```yaml
---
Title: Gym with Coworkers
Category: Health, Work, Social
---
# Counts toward Health, Work, AND Social statistics
```

**Project overlap:**
```yaml
---
Title: Client Meeting
Category: Client A, Sales, Q4 Planning
---
# Tracks time for client work, sales activities, and quarterly planning
```

**Learning on the job:**
```yaml
---
Title: Python Workshop
Category: Work, Learning, Development
---
# Shows contribution to work hours and professional development
```

#### Total Duration Note

When viewing statistics in Category Mode with multi-category events, the **total duration** displayed at the top sums all category entries. This means multi-category events contribute their duration multiple times to the total—once per category. This is intentional, as it shows the total "category-hours" tracked.

**Example:**
- One 2-hour event with `Category: Work, Learning`
- **Work**: 2h, **Learning**: 2h
- **Total**: 4h (representing 2 category-hours for Work + 2 category-hours for Learning)

To see actual unique time spent, use **Name Mode** instead.

#### Events Without Categories

Events without a category property (or with an empty category) are grouped under **"No Category"** when viewing statistics in Category Mode.

## Break Time Property

Track actual productive time by subtracting breaks from event duration.

### Overview

When you have long events that include breaks (like lunch breaks during work sessions), you can specify a `Break` property to exclude that time from statistics. This gives you accurate time tracking without needing to split events into multiple smaller ones.

### Usage

Add the `Break` property to your event's frontmatter with the break time in minutes:

```yaml
---
Title: Work Session
Start Date: 2025-02-03T09:00
End Date: 2025-02-03T17:00
Break: 60  # 1 hour lunch break
---
```

**Result:** This 8-hour event will show as **7 hours** in statistics (8h - 1h break).

### Features

- **Decimal Support**: Use decimal values for precise break times (e.g., `30.5` for 30 minutes 30 seconds)
- **Per-Event Configuration**: Set break time individually for each event in the Create/Edit Event modal
- **Automatic Calculation**: Break time is automatically subtracted when calculating statistics
- **Custom Property Name**: Configurable in Settings → Properties → "Break property" (default: `Break`)
- **Non-Destructive**: Original event duration remains unchanged in calendar view; break subtraction only affects statistics

### Examples

**Half-day with lunch break:**
```yaml
---
Title: Morning Work
Start Date: 2025-02-03T09:00
End Date: 2025-02-03T14:00
Break: 30  # 30-minute lunch
---
# Duration: 5 hours → Statistics: 4.5 hours
```

**Full day with multiple breaks:**
```yaml
---
Title: Workshop
Start Date: 2025-02-03T09:00
End Date: 2025-02-03T18:00
Break: 90  # 1 hour lunch + 30 min coffee breaks
---
# Duration: 9 hours → Statistics: 7.5 hours
```

**Gym session with rest periods:**
```yaml
---
Title: Gym Session
Start Date: 2025-02-03T10:00
End Date: 2025-02-03T12:30
Break: 15.5  # 15.5 minutes of rest between sets
---
# Duration: 2.5 hours → Statistics: ~2.25 hours
```

### Setting Break Time in Event Modal

1. Open the Create or Edit Event modal
2. Find the **Break (minutes)** field below the Category input
3. Enter the break time in minutes (decimals supported)
4. Save the event

The break time is stored in frontmatter and automatically applied to all statistics calculations.

### Automatic Break Tracking with Time Tracker

For automatic break time calculation, use the [Time Tracker](./time-tracker.md) feature:

1. Open the Create Event modal
2. Expand the **Time tracker** section
3. Click **▶ start** when you begin working
4. Click **⏸ break** when you take a break
5. Click **▶ resume** to continue working
6. Click **⏹ stop** when finished

The time tracker automatically calculates and fills in the Break field with your total break time.

### Best Practices

- **Be Consistent**: Use the same break conventions for similar events
- **Include All Breaks**: Add up lunch, coffee, and rest breaks together
- **Use Realistic Values**: Round to nearest minute for simplicity
- **Document Large Breaks**: Add a note in the event content explaining what the break time covers

## What Gets Included

### ✅ Included in Statistics

- **Timed Events**: Events with specific start and end times
- **Events with Duration**: Only events that have a meaningful duration (start + end time)
- **Events in Week Range**: Events that fall within Monday to Sunday of the selected week
- **Break Adjustment**: Duration minus break time (if configured)

### ❌ Excluded from Statistics

- **All-Day Events**: Events marked as all-day don't have meaningful durations for time tracking
- **Events Without End Time**: Timed events missing an end time (duration = 0)
- **Events Outside Week**: Events that don't overlap with the selected week
- **Break Time**: The break property value is subtracted from event duration

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
- **Percentage**: Proportion of total time

**Sorting:**
- Entries are automatically sorted by duration (longest first)
- Helps you quickly identify your biggest time commitments

**Pagination:**
- Tables display **20 entries per page** for optimal performance
- Navigation controls appear when more than 20 categories exist:
  - **← Previous**: Go to previous page
  - **Page X of Y (Z entries)**: Current position indicator
  - **Next →**: Go to next page
- Especially useful for all-time statistics with many event categories

### Period Summary

At the top of each modal, see:

- **Period Range**: Week dates, month name, or "All Time"
- **Total Duration**: Sum of all timed events (⏱ emoji)
- **Total Events**: Count of all included events (📅 emoji)
- **Navigation Controls**: Period-specific navigation buttons (weekly/monthly only)

## Navigation

### Weekly Statistics

- **← Previous**: Jump back 7 days
- **Next →**: Jump forward 7 days
- **Today**: Return to the current week

### Monthly Statistics

- **← Previous**: Jump to previous month
- **Next →**: Jump to next month
- **Today**: Return to the current month

### All-Time Statistics

No navigation controls (shows all events across all time).

The period displayed updates automatically, and statistics recalculate instantly based on the new date range.

## Use Cases

### 🎯 Weekly Time Tracking
Monitor how much time you spend on different activities throughout the week.

**Example (Weekly):**
```
Weekly Statistics (Feb 3 - Feb 9)
- Meetings: 12h 30m (35%)
- Deep Work: 18h 45m (53%)
- Recurring Events: 4h 15m (12%)
```

**Use:** Perfect for weekly reviews, sprint retrospectives, or time blocking adjustments.

### 📊 Monthly Productivity Analysis
Review entire months to understand broader patterns and trends.

**Example (Monthly):**
```
Monthly Statistics (February 2025)
- Client Work: 120h 30m (60%)
- Internal Projects: 50h 15m (25%)
- Learning: 30h 45m (15%)
Total: 201h 30m
```

**Use:** Ideal for monthly reports, billing summaries, or monthly goal reviews.

### 🌍 Lifetime Pattern Identification
Analyze cumulative statistics to understand long-term time allocation.

**Example (All-Time):**
```
All-Time Statistics
- Development: 1,240h (42%)
- Meetings: 680h (23%)
- Learning: 520h (18%)
- Planning: 490h (17%)
Total: 2,930h across 1,247 events
```

**Use:** Great for annual reviews, career reflection, or understanding long-term priorities.

### ⚖️ Work-Life Balance
Ensure you're allocating time appropriately across work, personal, and recurring activities.

**Weekly Example:**
```
- Work Events: 40h (70%)
- Personal Events: 12h (21%)
- Recurring Events: 5h (9%)
```

**Monthly Example:**
```
- Work Events: 165h (75%)
- Personal Events: 45h (20%)
- Recurring Events: 10h (5%)
```

### 🔍 Category Comparison
Compare time allocation across different periods to spot trends.

**Examples:**
- Compare this week vs. last week's "Deep Work" time
- Review this month vs. last month's "Meeting" hours
- Analyze all-time category distribution to identify career focus areas

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

- **[Time Tracker](./time-tracker.md)**: Track work sessions with precision using the built-in stopwatch
- **[Global Event Search](./global-search.md)**: Search and filter events across your calendar
- **[Filtering](./filtering.md)**: Filter events by properties and expressions
- **[Recurring Events](./recurring-dsl.md)**: Set up recurring event series
- **[Event Previews](./event-previews.md)**: View detailed event information

## Technical Details

### Period Definitions

**Weekly:**
- **Start**: Monday at 00:00:00 (local timezone)
- **End**: Following Monday at 00:00:00 (local timezone)
- **Duration**: Exactly 7 days

**Monthly:**
- **Start**: First day of month at 00:00:00 (local timezone)
- **End**: First day of next month at 00:00:00 (local timezone)
- **Duration**: Varies by month (28-31 days)

**All-Time:**
- **Start**: None (includes all events)
- **End**: None (includes all events)
- **Duration**: Entire event history

### Event Inclusion Criteria

An event is included if:
1. It's a timed event (`allDay === false`)
2. It has an end time (or duration > 0)
3. For weekly/monthly: It overlaps with the period range
   - Event starts before period ends AND
   - Event ends after period starts
4. For all-time: Always included (no date filtering)

### Duration Calculation

- **With End Time**: `end - start` (in milliseconds)
- **With Break Time**: `(end - start) - (break * 60000)` (break in minutes converted to ms)
- **Without End Time**: 0 (excluded from stats)
- **All-Day Events**: Excluded entirely
- **Minimum Duration**: 0 (duration never goes negative even if break > event duration)

### Pagination

- **Threshold**: 20 entries per page
- **When Applied**: Automatically when more than 20 categories exist
- **Performance**: Only renders visible rows for optimal speed
- **Navigation**: Previous/Next buttons with page counter

### Data Source

- **Weekly/Monthly**: Queries events within the specific period range
- **All-Time**: Retrieves all events from the vault cache (no date filtering)
