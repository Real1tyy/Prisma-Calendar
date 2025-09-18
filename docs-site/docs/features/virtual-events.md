# Virtual Events

Show recurring events beyond your generation horizon without creating physical files.

## How Virtual Events Work

Virtual events are **read-only calendar entries** that extend your recurring series beyond the physical notes you've generated. They appear in the calendar view but don't create actual files in your vault.

### Physical vs Virtual Events

**Physical Events** (up to "Future instances count" setting):
- Actual `.md` files created in your vault
- Inherit complete structure from configuration node (frontmatter + content)
- Editable and available for batch operations
- Searchable within Obsidian
- Take up storage space

**Virtual Events** (beyond generation horizon):
- Calendar-only display items showing recurring pattern
- Visual continuation of your recurring schedule into the future
- Read-only (cannot be edited or selected for batch operations)
- Don't create physical files, have no properties, or consume storage

## Benefits

### Vault Management
- **Keep your vault lean** - avoid cluttering with hundreds of future notes
- **Reduce search noise** - only current/near-future events appear in searches
- **Faster vault performance** - fewer files to index and sync

### Planning Visibility
- **See long-term patterns** - visualize your recurring schedule months/years ahead
- **Spot scheduling conflicts** - identify overlapping events even far in the future
- **Plan around recurring commitments** - understand your availability patterns

## Configuration

### Setting Generation Horizon
Control the physical/virtual boundary with the **"Future instances count"** setting (1-52):

**Recommended: 1-2 instances** for most use cases to avoid vault clutter.

**How counting works:**
- **Daily/Monthly/Yearly**: Count = number of individual events
- **Weekly with multiple days**: Count = number of weeks, not individual days

**Examples:**
- `RRule: weekly` + `RRuleSpec: monday, wednesday, friday` + Count = 2
  → Creates **6 physical files** (2 weeks × 3 days per week)
- `RRule: monthly` + Count = 2
  → Creates **2 physical files** (2 monthly events)

**Practical ranges:**
- **1-2 instances**: Recommended for most recurring events (keeps vault lean)
- **3-8 instances**: For intensive planning periods or project phases
- **12+ instances**: Only if you need extensive advance preparation

### Converting Virtual to Physical
Need to edit a virtual event? Increase your "Future instances count" to make it physical:

1. Go to plugin settings
2. Increase "Future instances count"
3. The system automatically generates physical files for the new range
4. Previously virtual events become editable files

## Example Scenario

**Configuration**: Weekly team meetings with "Future instances count" = 2

```yaml
RRule: weekly
RRuleSpec: monday, wednesday, friday
```

**Physical Events** (2 weeks ahead):
- **6 actual `.md` files created** (2 weeks × 3 meetings per week)
- Each inherits complete meeting template (frontmatter + agenda + notes sections)
- Editable, searchable, available for batch operations
- Covers your immediate planning horizon

**Virtual Events** (week 3 onwards):
- Calendar entries showing meeting pattern continuing indefinitely
- Display the recurring schedule visually in calendar
- Read-only display only
- No files created in vault
- Full visibility without vault clutter

## Best Practices

### 1. Start with Low Counts
- **Most users**: Count = 1-2 is sufficient for regular recurring events
- **Active planners**: Count = 3-4 for events requiring advance preparation
- **Special cases**: Higher counts only for intensive project phases

### 2. Consider Multi-Day Weekly Patterns
Remember that weekly counts multiply:
- `monday, wednesday, friday` + Count = 2 → **6 files**
- `tuesday, thursday` + Count = 3 → **6 files**
- Single day + Count = 6 → **6 files**

### 3. Storage vs Accessibility Balance
Find the sweet spot between:
- Having enough physical events for immediate work (usually 1-2 intervals ahead)
- Not overwhelming your vault with dozens of future files

### 4. Dynamic Adjustment
Adjust the count as your needs change:
- Increase temporarily before intensive planning sessions
- Decrease during vault cleanup to reduce file count
- Most users find 2 instances covers their active planning horizon

### 5. Visual Distinction
Virtual events appear with:
- Different visual styling in the calendar
- Indicators showing they're read-only
- Display basic scheduling information (title, time) from the recurring pattern

Virtual events give you the best of both worlds: complete visibility of your recurring patterns while keeping your vault focused on actionable, current events.
