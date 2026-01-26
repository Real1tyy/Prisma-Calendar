# Recurring Events (DSL)

Create repeating events using `RRule` and `RRuleSpec` in frontmatter.

## How It Works

One **configuration node** serves as the master template. Defines recurrence pattern, all frontmatter properties, and complete content (headings, text, checkboxes). System copies entire file structure to create each instance.

### Visual Markers

Recurring events display visual indicators in the top-right corner to distinguish between source events and physical instances (shown by default):

- **Source Events** (⦿): The original recurring event template that defines the recurrence pattern
- **Physical Instances** (🔄): Actual generated note files created from the source event

Both markers and their visibility can be customized in Settings → Calendar → Recurring events → Event markers. You can:
- Toggle markers on/off for source events and physical instances independently
- Customize the marker symbol/emoji for each type
- Use any Unicode character or emoji (e.g., ⚙️, 🔁, 📍, ⭐, 📌)

This makes it instantly clear which events are source templates versus generated instances when viewing your calendar.

### Generated Instances

**Physical Events**: Actual note files (controlled by "Future instances count")
**[Virtual Events](./virtual-events)**: Read-only calendar entries beyond generation horizon

**Inheritance**: All frontmatter properties, complete file content, exact formatting. Only `Start`/`End` dates and `RRuleID` are adjusted automatically.

**Frontmatter Propagation**: Changes to custom frontmatter properties (Category, Priority, Status, etc.) in the source event automatically propagate to all existing physical instances. The system intelligently detects three types of changes (added, modified, deleted) and can accumulate multiple rapid changes within a configurable debounce window. Time-related and system-managed properties (Start, End, Date, RRule, RRuleID, Source, etc.) are never propagated to preserve instance-specific timing and system integrity.

### Propagation Modes

You can control how frontmatter changes are propagated in Settings → Calendar → Recurring Events:

1. **Automatic Propagation**: Changes are automatically applied to all physical instances without confirmation. Multiple rapid changes within the debounce window are accumulated and merged together.

2. **Ask Before Propagating**: A confirmation modal appears showing all accumulated changes (added, modified, deleted properties) with their old and new values. You can review the changes before confirming or canceling the propagation.

![Frontmatter Propagation Modal](/img/frontmatter_propagation_modal.png)

3. **Both Disabled**: Frontmatter changes are not propagated to instances. Each instance maintains its own independent frontmatter.

### How Propagation Works

1. When you modify frontmatter in a source recurring event, the system detects the changes by comparing the current frontmatter with the previous state.

2. If multiple changes occur within the debounce window, they are accumulated and merged together. For example:
   - Change 1: `Category: "Work"` → `Category: "Personal"`
   - Change 2: `Priority: 1` → `Priority: 2`
   - Change 3: Add `Status: "In Progress"`
   - Result: All three changes are merged and propagated together

3. If a property is changed and then reverted to its original value within the debounce window, that change is automatically removed from the propagation (no unnecessary update).

4. The system only propagates the specific changes detected, preserving any instance-specific properties that weren't changed in the source.

5. If "Ask before propagating" is enabled, a modal shows all accumulated changes before applying them. If "Propagate frontmatter to instances" is enabled, changes are applied automatically after the debounce delay.

📖 See [Frontmatter Propagation Settings](../configuration#frontmatter-propagation) for detailed configuration options including debounce delay and excluded properties.

### Start Date as Calculation Point

For `weekly`/`biweekly`, system finds first day matching `RRuleSpec` on or after `Start` date. For `daily`/`monthly`/`quarterly`/`semiannual`/`yearly`, `Start` is typically the first instance.

### RRuleID Management

⚠️ **Never modify `RRuleID`** - system-managed unique identifier that maintains series integrity.

### Duplicate Prevention

Deterministic file paths based on (RRuleID, Instance Date) prevent duplicates. Format: `[Title] [YYYY-MM-DD]-[14-digit-hash].md`. Filesystem itself acts as deduplication gate - if file exists, creation skipped. Resilient to race conditions, plugin reloads, vault sync, and indexer restarts.

## Creating Recurring Events

**Calendar Interface** (Recommended): Right-click time slot → "Create Event" → Set RRule properties → Create

**Manual**: Create note with frontmatter. Add `RRule` property last (indexer starts generating immediately when detected).

## Source Navigation & Instance Management

![Recurring Instance Modal](/img/view_recurring_events_modal.png)

**Source Button**: Navigate to source event from instances
**Instance Dropdown**: View all physical instances with "Show Past" filter
**[Virtual Events](./virtual-events)**: Click to show source event

The instance list modal includes:
- **Category-Colored Background**: When the source event has a category assigned, the modal displays a subtle gradient background using the category's color
- **Search & Filtering**: Search instances and toggle visibility of past/skipped events
- **Statistics**: View completion rate with counts of past, skipped, and completed instances
- **Click to Open**: Click any instance to open its file directly

![Recurring Events Modal](/img/recurring_events_list_modal.png)

*Centralized modal to view, filter, enable/disable, and navigate to all recurring events*

### Managing Recurring Events

The recurring events modal (accessible via command palette: "Show recurring events") provides powerful management tools:

- **Category Color Backgrounds**: Recurring events with assigned categories display a semi-transparent background across the entire row in the category's color with a left border accent, making it easy to visually identify event types at a glance
- **Category Button**: Assign or change categories using the unified category assignment command. Categories automatically propagate to all physical instances based on your propagation settings
- **Navigate Button**: Jumps to the source event in the calendar view and highlights it for 5 seconds, useful for locating events in crowded calendars
- **Enable/Disable**: Toggle recurring event generation without deleting files
- **Type Filtering**: Filter by recurrence pattern (daily, weekly, monthly, etc.)
- **Disabled Events View**: Toggle to show only disabled recurring events for quick re-activation
- **Clean Display**: Event titles automatically strip Zettelkasten IDs for improved readability (handles both prefix and suffix formats like `20250930193327-Title` and `Title-20250930193327`)

## Recurrence Patterns

### Available RRule Values
- `daily` - Every day
- `weekly` - Every week
- `biweekly` - Every 2 weeks
- `monthly` - Every month
- `bimonthly` - Every 2 months
- `quarterly` - Every 3 months
- `semiannual` - Every 6 months
- `yearly` - Every year

### RRuleSpec for Weekly Patterns
When using `weekly` or `biweekly`, specify days with `RRuleSpec`:

```yaml
RRuleSpec: monday, wednesday, friday
RRuleSpec: tuesday, thursday
RRuleSpec: saturday, sunday
```

## Generation Control

**Future Instances Count** (1-52): How many physical files created ahead. Recommended: 1-2 for most events.

**Weekly counting**: Count = weeks, not days. `monday, wednesday, friday` + Count=2 → 6 files (2 weeks × 3 days)

**Ranges**: 1-2 (most users), 3-8 (intensive planning), 12+ (extensive prep)

### Per-Event Override

**Modal**: Enable "Recurring Event" → Set "Future instances count" field
**Frontmatter**: Add `Future Instances Count: 10` property

Use for critical events needing more instances or infrequent events needing fewer. Dynamic updates on reload.

### Virtual Events
Beyond generation horizon, read-only [virtual events](./virtual-events) show complete pattern without creating files.

### Duplicating Recurring Instances

Right-click physical instance → "Duplicate recurring instance"

Duplicate preserves frontmatter (RRuleID, Source, Instance Date), gets new [ZettelID](./zettelid-naming), and receives `Ignore Recurring: true` property. Tracked in instance list but not counted toward "Future instances count" limit.

**Multiple Instances Per Date**: The system supports multiple physical instances sharing the same instance date. When you duplicate an event, both the original and the duplicate appear on the calendar for the same day. This allows you to:
- Create variations of a recurring event for the same day (e.g., multiple meetings based on the same template)
- Duplicate an instance and later move it to a different day
- Track both events independently in the instance list

### Moving Physical Recurring Events

Drag and drop updates date properties and renames filename. Normal instances preserve original `Recurring Instance Date`. Duplicated/ignored instances update `Recurring Instance Date` to match new date.

### Disabling and Deleting

Confirmation modal appears when disabling or deleting source with physical instances. Choose to delete all associated physical events or preserve them while stopping future generation.

## Best Practices

1. **Start Simple**: Begin with basic patterns, expand as needed
2. **Use Meaningful Templates**: Configuration node is complete template - include all structure, frontmatter, and content
3. **Don't Touch System Properties**: Never modify `RRuleID`, don't manually create/delete instance files
