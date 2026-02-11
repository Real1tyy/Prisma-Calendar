# Event Series

Track, group, and analyze related events through the Event Series system. Events are grouped in three ways — by recurring event rules (automatic), by a frontmatter series property (explicit), and by shared name with ZettelID stripped (automatic). All three perspectives are accessible from a single unified modal.

## Overview

Event Series gives you:
- **Three grouping strategies** — recurring instances, explicit series tags, and automatic name-based grouping
- **Unified Series Modal** — view all related events from any perspective, switch between tabs
- **Completion tracking** — statistics showing how many past events were completed vs skipped
- **Series assignment** — tag events with series values via context menu, just like categories
- **Filter and search** — hide past events, hide skipped events, debounced search by title
- **Color-coded rows** — each event row reflects the event's resolved color from your color rules
- **Smart sorting** — ascending for future events, descending when showing all

## How Events Are Grouped

### 1. Recurring (Automatic)

Events linked by a shared `RRuleID` are automatically part of a recurring series. This includes the source event template and all generated physical instances. See [Recurring Events](./recurring-dsl) for details on setting up recurrence.

### 2. By Series Property (Explicit)

Tag events with a frontmatter property (default: `Series`) to explicitly group them. Events sharing the same value appear together. Supports multiple values — an event can belong to several series at once.

```yaml
# Single series
Series: ProjectX

# Multiple series (YAML array)
Series:
  - ProjectX
  - Q1-Goals
  - Client-A
```

### 3. By Name (Automatic)

Events whose cleaned title (with [ZettelID](./zettelid-naming) stripped) matches are automatically grouped. No configuration needed — if you have events named "Morning Routine 20260210123456" and "Morning Routine 20260211134567", they appear together under "Morning Routine". This is useful for tracking recurring activities that aren't formally set up as recurring events.

## Setting Up the Series Property

1. Go to **Settings → [Your Calendar] → Properties**
2. Set the **Series property** field (default: `Series`)
3. Add the property to your event frontmatter as shown above

Events sharing the same series value will appear together in the "By Series" tab.

## Assigning Series

You can assign series values to events via the context menu, using the same workflow as category assignment:

1. Right-click an event on the calendar
2. Select **"Assign series"**
3. The assignment modal appears with:
   - **Search** — filter existing series or type a new name
   - **Checkboxes** — select/deselect series, each showing event count (e.g., "12 events")
   - **Create new** — if your search doesn't match an existing series, create it on the fly
4. Click **"Assign series"** to save, or **"Remove series"** to clear all

Changes are written to the event's frontmatter and are **undoable** via `Ctrl/Cmd+Z`.

The "Assign series" context menu item can be toggled on/off in **Settings → Context menu items**.

## The Event Series Modal

Right-click any event on the calendar and select **"View series"** to open the modal. The modal determines which tabs to show based on the clicked event's properties:

- **Recurring** tab appears if the event belongs to a recurring series (has an `RRuleID`)
- **By Series** tab appears if the event has a series property value
- **By Name** tab appears always

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

### By Series Tab

Shows all events sharing the same series property value.

**Single series value:** Opens directly into the event list with the series name as a header.

**Multiple series values:** Shows a **series chooser** first — a list of all series the event belongs to, each showing the event count. Click one to drill in. An **"All series"** button appears in the tab bar to navigate back.

**What you see (after selecting a series):**
1. **Series name** — header
2. **Statistics bar** — past events, skipped, completion percentage
3. **Filter toggles** — "Hide past events" and "Hide skipped events" (both OFF by default)
4. **Search** — filter by title with debounced input
5. **Event list** — color-coded rows showing date and cleaned title; click to open

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

All three tabs display a statistics bar computed from the **full unfiltered event list** (filters don't affect the counts):

```
Past events: 24  •  Skipped: 3  •  Completed: 87.5%
```

- **Past events** — events with a start date before today
- **Skipped** — past events with the Skip property set to true
- **Completed** — percentage of past events that were not skipped: `(past - skipped) / past`

### Filter Toggles

Two toggle filters are available on every tab:

| Filter | Effect |
|--------|--------|
| **Hide past events** | Hides events with a start date before today |
| **Hide skipped events** | Hides events marked as skipped |

The Recurring tab has filters enabled by default (showing future events). The By Name and By Series tabs have filters disabled by default (showing all events).

Filter state is preserved independently per tab — switching between Recurring, By Series, and By Name won't reset your filters.

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

In the By Name and By Series tabs, each event row is color-coded based on the event's resolved color from your [color rules](./color-rules). The row displays a subtle tinted background and a colored left border, matching the colors you see on the calendar itself.

### Event Navigation

Click any event row to open the corresponding note file and close the modal.

## Frontmatter Propagation

You can automatically keep custom frontmatter properties in sync across series members. When you change a property on one event, the change propagates to all other events in the same series.

Two independent propagation scopes are available for series:

- **Name series propagation** — propagates changes across events with the same cleaned title
- **Property series propagation** — propagates changes across events sharing the same series property value

Each scope has two mutually exclusive modes:

- **Auto-propagate** — changes are applied immediately without confirmation
- **Ask before propagating** — a confirmation modal shows the changes before applying

Configure these in **Settings → [Your Calendar] → Name series propagation** and **Property series propagation**. The **Excluded properties** and **Propagation debounce delay** settings (under "Shared propagation settings") apply to all propagation types including series.

Loop prevention ensures that when a change propagates from event A to events B and C, the updates to B and C do not trigger further propagation back to A.

See [Frontmatter Propagation](../configuration#frontmatter-propagation) for full configuration details.

## Context Menu Items

Two context menu actions relate to series:

| Action | Description |
|--------|-------------|
| **View series** | Opens the Event Series Modal for the clicked event |
| **Assign series** | Opens the series assignment modal to tag the event with series values |

Both can be toggled on/off in **Settings → Context menu items**.
