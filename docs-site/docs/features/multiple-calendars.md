# Multiple Calendars

Separate contexts with dedicated configurations.

## Why multiple calendars?

- Keep Work and Personal events in separate directories
- Use different property mappings for different workflows
- Use different filter rules for different event types
- Use different color schemes for different contexts
- Bind hotkeys to jump between calendars quickly

## Typical setup

Each calendar **must use its own separate directory** for full independence:

1. Create a Work calendar → Directory `work/`
2. Create a Personal calendar → Directory `personal/`
3. Create a Projects calendar → Directory `projects/`
4. Add different color rules (e.g., Work blue, Personal purple)
5. Assign hotkeys to switch quickly

**Important**: Each calendar needs its own directory to maintain independent filtering and property settings.

## Example Configurations

**Separate Work/Personal Events:**
```
Calendar "Work":
  Directory: work/events/
  Properties: start, end, title
  Filters: (none)
  Colors: Blue theme

Calendar "Personal":
  Directory: personal/events/
  Properties: scheduled, deadline, name
  Filters: (none)
  Colors: Purple theme
```

**Separate Project Tracking:**
```
Calendar "Active Projects":
  Directory: projects/active/
  Filters: fm.status !== 'done'
  Colors: Priority-based colors

Calendar "Archive":
  Directory: projects/archive/
  Filters: (none)
  Colors: Muted gray theme
```

## Sharing Directories: When It Works and When It Doesn't

Multiple calendars **can** point to the same directory, but with important limitations to understand.

### ✅ Great Use Case: Different Visual Perspectives

If you want multiple ways to **view and style the same events**, sharing a directory works perfectly:

```
Calendar "Work - Timeline":
  Directory: work/
  View: Month view, expanded hours
  Colors: Priority-based (High → Red, Medium → Yellow)
  Display: Show all properties

Calendar "Work - Daily":
  Directory: work/  (same directory!)
  View: Day view, 8am-6pm focus
  Colors: Project-based (Phoenix → Blue, Atlas → Green)
  Display: Show only title and time
```

**What you can customize per calendar:**
- ✅ Calendar name
- ✅ View settings (hour range, default view, time slots)
- ✅ Color rules (different colors for same events)
- ✅ Display properties (which frontmatter fields to show)
- ✅ UI preferences (event preview, contrast settings)

### ❌ Won't Work: Different Filters or Properties

You **cannot** use the same directory if you need:
- ❌ Different filter expressions (one calendar shows "active", another shows "all")
- ❌ Different property mappings (one uses `start`, another uses `scheduledDate`)
- ❌ Different recurring event settings

**Why this limitation exists**: Calendars sharing a directory share infrastructure (indexer, parser, event store) to prevent conflicts and duplicate event creation. These shared components use the **FIRST calendar's settings** for:
- Filter expressions
- Property mappings (Start, End, Date, etc.)
- Recurring event settings

### Decision Guide

**Use the SAME directory when:**
- ✅ You want different colored views of the same events
- ✅ You need different time ranges or view types (month vs. day)
- ✅ You want to show/hide different properties on events
- ✅ All calendars can use the same filters and property mappings

**Use SEPARATE directories when:**
- ✅ You need different filter expressions
- ✅ You need different property mappings
- ✅ You're organizing completely different types of events

## Performance Considerations

The plugin currently supports up to 10 calendars. While technically more could be added, this limit is in place to ensure smooth performance, as each calendar adds indexing and filtering overhead.
