# Batch Operations

Quickly make changes to many events at once.

![Batch Selection Mode](/img/batch_select.png)

*Select multiple events across your calendar for bulk operations*

## Entering Selection Mode

**Activate:** Toolbar button, keyboard shortcut, or right-click → "Enter Selection Mode"

**Select:** Click events to add to selection. Use "Select All Visible" to grab everything on screen.

**Note:** Virtual events (far future) are excluded from selection.

## Available Actions

### Delete Selected
- Permanently removes event files (with confirmation)
- Clean up old or placeholder events

### Duplicate Selected
- Creates exact copies at same time/date
- Useful for template copies

### Move to Next/Previous Week
- Shifts events ±7 days
- Original events are moved (not copied)

### Clone to Next/Previous Week
- Creates copies ±7 days away
- Keeps originals in place
- Perfect for repeating weekly patterns

### Skip Selected
- Mark events as skipped without deletion
- Preserves recurring series
- View/restore via Calendar menu → "View Skipped Events"

### Mark Done / Mark as Not Done
- **Mark Done**: Marks all selected events as done by setting the status property
- **Mark as Not Done**: Marks all selected events as not done by setting the status property
- Uses the status property and done/not done values configured in Settings → Properties
- Undoable operations
- Useful for quickly marking completed tasks or past events
- **Tip:** You can also mark individual events as done/undone by right-clicking them in the calendar

### Move By
- Opens a dialog to move selected events by a custom number of days
- Supports positive values (move forward) and negative values (move backward)
- Example: Enter `7` to move events one week forward, or `-3` to move them 3 days back

### Open All in Tabs
- Opens all selected event files in editor tabs
- Quick access for batch reviewing/editing

## Customizing Batch Action Buttons

By default, not all batch action buttons are shown in the toolbar to keep the interface compact and prevent the toolbar from spanning multiple rows. The following buttons are **disabled by default**:

- **Move By**: Custom time offset movement
- **Open All**: Open all selected events in tabs
- **Move Prev**: Move to previous week
- **Clone Prev**: Clone to previous week

You can customize which buttons appear in the batch selection toolbar by going to **Settings → Calendar → Batch Selection → Batch action buttons**. Enable or disable any combination of buttons to match your workflow. The counter and exit buttons are always shown and cannot be disabled.

**Note:** Enabling all available buttons will cause the toolbar to span two rows. The default selection is optimized to show the most commonly used actions while keeping the interface on a single row.

## Typical Workflows

**Shift meetings by one week:**
1. Switch to Week view
2. Toggle selection mode
3. Select relevant meetings
4. Move → Next week

**Skip holiday week:**
1. Navigate to holiday week
2. Select all recurring instances
3. Click "Skip"
4. Series continues after

## Tips

- Use "Select All Visible" to quickly grab everything on screen
- Filter before selecting to narrow down to intended events
- Batch selection not available in List view
- Snap duration and slot duration affect drag/resize behavior after cloning
- **Keyboard Access**: All batch operations can be performed using Obsidian commands, which can be assigned custom hotkeys for faster access. See the [Hotkeys documentation](/features/hotkeys) for a complete list of available commands and how to assign hotkeys.