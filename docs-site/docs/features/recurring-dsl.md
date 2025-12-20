# Recurring Events (DSL)

Create repeating events using `RRule` and `RRuleSpec` in frontmatter.

## How It Works

One **configuration node** serves as the master template. Defines recurrence pattern, all frontmatter properties, and complete content (headings, text, checkboxes). System copies entire file structure to create each instance.

### Generated Instances

**Physical Events**: Actual note files (controlled by "Future instances count")
**[Virtual Events](./virtual-events)**: Read-only calendar entries beyond generation horizon

**Inheritance**: All frontmatter properties, complete file content, exact formatting. Only `Start`/`End` dates and `RRuleID` are adjusted automatically.

**Frontmatter Propagation**: Changes to custom frontmatter properties (Category, Priority, Status, etc.) in the source event automatically propagate to all existing physical instances. Time-related and system-managed properties are never propagated. This feature is enabled by default and can be toggled in Settings → Calendar → Recurring Events.

### Start Date as Calculation Point

For `weekly`/`biweekly`, system finds first day matching `RRuleSpec` on or after `Start` date. For `daily`/`monthly`/`yearly`, `Start` is typically the first instance.

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

![Recurring Events Modal](/img/recurring_events_list_modal.png)

*Centralized modal to view, filter, enable/disable, and navigate to all recurring events*

## Recurrence Patterns

### Available RRule Values
- `daily` - Every day
- `weekly` - Every week
- `biweekly` - Every 2 weeks
- `monthly` - Every month
- `bimonthly` - Every 2 months
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

### Moving Physical Recurring Events

Drag and drop updates date properties and renames filename. Normal instances preserve original `Recurring Instance Date`. Duplicated/ignored instances update `Recurring Instance Date` to match new date.

### Disabling and Deleting

Confirmation modal appears when disabling or deleting source with physical instances. Choose to delete all associated physical events or preserve them while stopping future generation.

## Best Practices

1. **Start Simple**: Begin with basic patterns, expand as needed
2. **Use Meaningful Templates**: Configuration node is complete template - include all structure, frontmatter, and content
3. **Don't Touch System Properties**: Never modify `RRuleID`, don't manually create/delete instance files
