# Event Groups

Track, group, and analyze related events through the Event Groups system. Events are grouped in three ways — by recurring event rules (automatic), by shared category (automatic), and by shared name with ZettelID stripped (automatic). All perspectives are accessible from a single unified modal.

## Overview

Event Groups gives you:
- **Three grouping strategies** — recurring instances, category-based grouping, and automatic name-based grouping
- **Unified Series Modal** — view all related events from any perspective, switch between tabs
- **Completion tracking** — statistics showing how many past events were completed vs skipped
- **Filter and search** — hide past events, hide skipped events, debounced search by title
- **Color-coded rows** — each event row reflects the event's resolved color from your color rules
- **Smart sorting** — ascending for future events, descending when showing all

## How Events Are Grouped

### 1. Recurring (Automatic)

Events linked by a shared `RRuleID` are automatically part of a recurring series. This includes the source event template and all generated physical instances. See [Recurring Events](./recurring-dsl) for details on setting up recurrence.

### 2. By Category (Automatic)

Events sharing the same category property value are grouped together. If an event has multiple categories (YAML array), it appears in each category's group. This uses the same Category property configured in your calendar settings.

### 3. By Name (Automatic)

Events whose cleaned title (with [ZettelID](./zettelid-naming) stripped) matches are automatically grouped. No configuration needed — if you have events named "Morning Routine 20260210123456" and "Morning Routine 20260211134567", they appear together under "Morning Routine". This is useful for tracking recurring activities that aren't formally set up as recurring events.

## The Event Series Modal

The modal determines which tabs to show based on the event's properties:

- **Recurring** tab appears if the event belongs to a recurring series (has an `RRuleID`)
- **By Category** tab appears if the event has one or more categories assigned
- **By Name** tab appears if the event has a name

When multiple tabs are available, they appear in the order above (Recurring first). If only one grouping applies, the modal opens directly into that view with no tab bar.

### Recurring Tab

Shows all physical instances of a recurring event series.

**What you see (top to bottom):**
1. **Source title** — clickable header that opens the source recurring event file
2. **Recurrence info** — the recurrence type (daily, weekly, etc.) and days of the week if applicable
3. **Statistics bar** — past events, skipped count, completion percentage
4. **Filter toggles** — "Hide past events" and "Hide skipped events" (both ON by default)
5. **Search** — filter instances by title
6. **Instance list** — each row shows date and title; click to open the note

If the source event has a category, the modal background is tinted with the category color.

### By Category Tab

Shows all events sharing the same category value.

If the event has **multiple categories**, a category chooser is displayed first — click a category to view its events. A back button lets you return to the chooser. If the event has a **single category**, the event list is shown directly.

**What you see:**
1. **Category name** — header showing the category value
2. **Statistics bar** — same format as other tabs
3. **Filter toggles** — "Hide past events" and "Hide skipped events"
4. **Search** — filter by title
5. **Event list** — color-coded rows

### By Name Tab

Shows all events whose cleaned title matches.

**What you see:**
1. **Event name** — header showing the cleaned title (ZettelID stripped)
2. **Statistics bar** — same format as other tabs
3. **Filter toggles** — "Hide past events" and "Hide skipped events"
4. **Search** — filter by title
5. **Event list** — color-coded rows

## Modal Features

### Statistics Bar

All tabs display comprehensive statistics computed from the **full unfiltered event list** (filters don't affect the counts).

**First row (main statistics):**
```
Total: 45  •  Past: 32  •  Skipped: 3  •  Completed: 90.6%
```

- **Total** — total number of events in the series
- **Past** — events with a start date before today
- **Skipped** — past events with the Skip property set to true
- **Completed** — percentage of past events that were not skipped: `(past - skipped) / past × 100`

**Second row (time breakdown & frequency):**
```
This year: 28  •  This month: 8  •  This week: 2  •  Frequency: 3.2x/week
```

- **This year** — past events that occurred in the current calendar year
- **This month** — past events that occurred in the current calendar month
- **This week** — past events that occurred in the current calendar week (starting Monday)
- **Frequency** — automatic calculation of how often events occur, displayed in the most appropriate unit:
  - **Daily**: "2.3x/day" (multiple times per day)
  - **Weekly**: "3.5x/week" (several times per week)
  - **Monthly**: "1.2x/month" (roughly monthly)
  - Requires at least 2 past events to calculate

The frequency is calculated by analyzing the time span between the first and last past event and computing the average occurrence rate.

### Filter Toggles

Two toggle filters are available on every tab:

| Filter | Effect |
|--------|--------|
| **Hide past events** | Hides events with a start date before today |
| **Hide skipped events** | Hides events marked as skipped |

The Recurring tab has filters enabled by default (showing future events). The By Category and By Name tabs have filters disabled by default (showing all events).

Filter state is preserved independently per tab — switching between tabs won't reset your filters.

### Smart Sorting

The event list sorts intelligently based on your filter state:
- **Hide past enabled** — ascending order (nearest future event first)
- **Hide past disabled** — descending order (most recent event first)

### Search

Press `Ctrl/Cmd+F` to focus the search input from anywhere in the modal. Type to filter events by title.

- **Debounced** — triggers after 350ms of inactivity
- **Enter** — submits the search immediately
- **Escape** — clears the query (press again to close the modal)

Focus is automatically restored to the search input after the list re-renders.

### Color-Coded Rows

In the By Category and By Name tabs, each event row is color-coded based on the event's resolved color from your [color rules](./color-rules). The row displays a subtle tinted background and a colored left border, matching the colors you see on the calendar itself.

### Event Navigation

Click any event row to open the corresponding note file and close the modal.

## Frontmatter Propagation

You can automatically keep custom frontmatter properties in sync across series members. Propagation is available for both name series and category series.

### Name Series Propagation

When you change a property on one event, the change propagates to all other events sharing the same cleaned title.

**Two mutually exclusive modes:**
- **Auto-propagate** — changes are applied immediately without confirmation
- **Ask before propagating** — a confirmation modal shows the changes before applying

Configure in **Settings → [Your Calendar] → Name series propagation**.

### Category Series Propagation

When you change a property on one event, the change propagates to all other events sharing the same category value.

**Two mutually exclusive modes:**
- **Auto-propagate** — changes are applied immediately without confirmation
- **Ask before propagating** — a confirmation modal shows the changes before applying

Configure in **Settings → [Your Calendar] → Category series propagation**.

### Shared Settings

The **Excluded properties** and **Propagation debounce delay** settings (under "Shared propagation settings") apply to all propagation types: recurring instances, name series, and category series.

Loop prevention ensures that when a change propagates from event A to events B and C, the updates to B and C do not trigger further propagation back to A.

See [Frontmatter Propagation](../configuration#frontmatter-propagation) for full configuration details.

## Events Browser

The **"Events"** button in the calendar toolbar opens the Events Browser — a unified modal that lists all recurring events, category groups, and name-based groups in three tabs.

### Opening the Events Browser

- Click the **"Events"** button in the toolbar (always visible)
- Use the **"Show recurring events"** command (bindable to a hotkey)

### Tabs

| Tab | Content | Click action |
|-----|---------|--------------|
| **Recurring (N)** | All recurring event sources (enabled and disabled) with recurrence type badge and instance count | Opens the Event Series Modal for that recurring event. Ctrl+Click opens the source file. |
| **By Category (N)** | All category-based groups with event count | Opens the Event Series Modal for that category group |
| **By Name (N)** | All name-based groups (2+ events sharing a cleaned title) with event count | Opens the Event Series Modal for that name group |

Each tab label shows the total count of items in parentheses.

### Recurring Tab Features

The Recurring tab includes additional controls:

- **Type filter** — dropdown to filter by recurrence type (Daily, Weekly, Bi-weekly, Monthly, Yearly, etc.)
- **Show disabled only** — toggle to view only disabled recurring events (appears when disabled events exist)
- **Action buttons** per item:
  - **Category** — assign categories to the source event
  - **Nav** — navigate the calendar to the source event's date and highlight it
  - **Disable/Enable** — toggle the recurring event on/off

### Search

A shared search input at the top filters items across whichever tab is active. Press `Ctrl/Cmd+F` to focus search from anywhere in the modal.

### Sorting

A sort dropdown next to the search input lets you control the list order. Available options:

| Sort | Description |
|------|-------------|
| **Count ↓** (default) | Most instances/events first |
| **Count ↑** | Fewest instances/events first |
| **Name A→Z** | Alphabetical ascending |
| **Name Z→A** | Alphabetical descending |

The selected sort applies to all tabs.

## Bases View Integration

The Event Series Modal includes a **Bases** footer that lets you view the current event series in Obsidian's Bases plugin with powerful table, list, or card views.

### Opening Bases Views

At the bottom of the Event Series Modal, you'll see a footer with:
- **"Bases"** label on the left
- Three view type buttons on the right: **Table**, **List**, **Cards**

Click any button to open a Bases view filtered to show only events from the current series:
- **Recurring tab** — filters by `RRuleID` property (shows all instances of the recurring event)
- **By Name tab** — filters by `Calendar Title` property using `.contains()` (shows all events with matching names)
- **By Category tab** — filters by your category property using `.contains()` (shows all events in that category)

### What You Get in Bases

The generated Bases view includes:
- **Filtered dataset** — only events from the current series
- **Sorted by date** — descending order (most recent first)
- **Configured columns** — shows your calendar's date property, status property, and any additional properties configured in Bases view settings
- **Editable** — full Bases editing capabilities (inline editing, bulk operations, etc.)

### Requirements

The Bases view feature requires:
- Obsidian Bases plugin installed and enabled
- At least one calendar configured in Prisma Calendar settings
