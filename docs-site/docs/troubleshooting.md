# Troubleshooting

Use this checklist to diagnose common issues.

## Events not appearing

- Plugin enabled and vault reloaded
- Calendar Directory points to the correct folder (subfolders included)
- Note has a valid `Start` property (ISO format recommended, e.g., `2025-02-10T14:00`)
- Filters aren't excluding your note (Rules → Event Filtering)
- Frontmatter keys match your Properties Settings (e.g., `Start` vs `start`)
- **Try refreshing**: Open command palette (Ctrl/Cmd+P) and run "Refresh calendar" to force a full resync

## Wrong colors or no color applied

- The first matching color rule wins — check rule order
- Expressions use property names directly (e.g., `Priority === 'High'`)
- Color value is valid CSS (hex/name/HSL)

## Templater not working

- Templater plugin is installed and enabled
- Template path in General Settings is correct
- Your template render outside Prisma Calendar (sanity check)

## Recurring events missing

- `RRule` is set (e.g., `weekly`) and valid `RRuleSpec` for week-based schedules
- "Future instances count" is high enough to cover the date you expect
- Virtual events show beyond the generation horizon (read-only)

## Calendar stuck on "Indexing calendar events..." after duplicating

**Problem**: After duplicating a calendar or creating a second calendar that points to the same directory, one or both calendars hang on "Indexing calendar events..." and never complete.

**Root Cause**: When multiple calendars share the same directory, they share infrastructure (indexer, parser, event store). The initialization flow when duplicating calendars can cause synchronization issues where the shared infrastructure doesn't properly notify all calendar views.

**Solution**: Reload the plugin after creating/duplicating calendars:

1. **Option 1**: Disable and re-enable the plugin
   - Go to Settings → Community Plugins
   - Toggle "Prisma Calendar" off then on

2. **Option 2**: Restart Obsidian

**Prevention**: If you frequently create multiple calendars for the same directory, consider:
- Creating all calendars at once, then reloading the plugin once
- Using different directories for different calendars if you don't need them to share events

## Multiple calendars creating duplicate events

If you're seeing duplicate events or recurring instances being created multiple times, this may be caused by multiple calendars using overlapping directories.

**Automatic Conflict Prevention:**
When multiple calendars use the **exact same directory path**, they automatically share the same indexer and recurring event manager. This prevents duplicates and conflicts.

**Known Limitation - Directory Subsets:**
The system **cannot detect** when one calendar uses a parent directory and another uses a subdirectory. For example:
- Calendar A uses `tasks`
- Calendar B uses `tasks/homework`

These will create **separate indexers** that may conflict, potentially causing:
- Duplicate recurring event instances
- File change events processed multiple times
- Inconsistent event states

**Solutions:**
1. **Recommended**: Use the same exact directory path for all calendars that should see the same events, then use filters to differentiate views
2. **Alternative**: Use completely separate directory trees (e.g., `work/` and `personal/`) with no overlap
3. **Workaround**: Keep parent/child directory calendars, but disable recurring events in one of them

**Example - Good Configuration:**
```
Calendar "Work - Tasks":    Directory: tasks/
Calendar "Work - Calendar":  Directory: tasks/
Filter: fm.type === 'task'   Filter: fm.type === 'event'
```

**Example - Problematic Configuration:**
```
Calendar A: Directory: tasks/          ❌ Will conflict
Calendar B: Directory: tasks/homework/ ❌ Will conflict
```

## Calendars sharing directory have different frontmatter property settings

**Problem**: You have two calendars pointing to the same directory, but want Calendar 1 to use `start` property and Calendar 2 to use `scheduledDate` property. However, both calendars seem to use the same property mappings.

**Root Cause**: When multiple calendars share the same directory, they share the Parser and Indexer. These components are created with the FIRST calendar's settings and are reused by all subsequent calendars pointing to that directory.

**What's Shared**:
- Frontmatter property mappings (Start, End, Date, Title, etc.)
- Event filtering expressions
- Recurring event settings (RRule properties)
- Skip property, Source property, etc.

**What's Individual**:
- Calendar name
- View settings (hour range, default view, slot duration)
- Color rules
- Display properties (which frontmatter fields to show)
- UI preferences

**Solution**: Use separate directories for calendars that need different property mappings:
```
Calendar "Tasks":          Directory: tasks/
  Properties: start, end, due

Calendar "Schedule":       Directory: schedule/
  Properties: scheduledDate, deadline
```

**Alternative**: If events truly belong in the same directory, standardize on one set of property names and use that across all calendars viewing that directory.

## Templater integration

### Templates not applying to Prisma-created events

**Problem**: Templater folder templates work for manually created notes, but not for events created through Prisma Calendar.

**Root Cause**: Prisma creates files programmatically, which can bypass Templater's folder trigger or cause race conditions.

**Solution**: Configure templates in BOTH places:

1. **Templater Settings**: Set up your folder template as usual
2. **Prisma Calendar Settings**: Go to `General` → `Template path` and set the same template file

This ensures the template is applied atomically when Prisma creates the event file.

### Inconsistent date properties for sorting

**Problem**: Events have different property names (`Start Date` for timed events, `Date` for all-day events) and formats (`2025-02-10T14:00:00.000Z` vs `2025-02-10T14:00:00`), making it impossible to sort chronologically in other tools like Bases or Dataview.

**Root Cause**: Prisma uses different properties based on event type, and ISO format includes `.000Z` suffix.

**Solution**: Create a "watcher" script that normalizes dates into a dedicated sort property.

**Result**: Consistent `sort_date` property across all events for reliable chronological sorting in Bases, Dataview, or other tools.

## Events appearing as all-day when they should be timed (or vice versa)

**Problem**: You duplicate a timed event, but the duplicate appears as an all-day event. Or you have events that show start/end times in frontmatter but display as all-day on the calendar.

**Root Cause**: The `All Day` property is the **source of truth** for determining event type. Prisma ignores `Start`/`End` properties when `All Day: true` is set, and ignores the `Date` property when `All Day: false` (or unset).
