# Troubleshooting

Use this checklist to diagnose common issues.

## Can't find the calendar ribbon icon

**Problem**: After installing and enabling Prisma Calendar, there's no calendar icon in the left sidebar.

**Solution**: Check if the ribbon icon setting is enabled:

1. Go to `Settings` → `Prisma Calendar`
2. Select your calendar from the dropdown
3. Go to `General` tab
4. Enable `Show ribbon icon`

**Alternative**: Open the calendar using Obsidian's command palette:

1. Press `Ctrl/Cmd + P` to open the command palette
2. Type: `Prisma Calendar: Open [Calendar Name]`
3. Press Enter

**Tip**: Set a custom hotkey for quick access (Settings → Hotkeys → search "Prisma Calendar: Open").

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
- Your template tokens render outside Prisma Calendar (sanity check)

## Timezone issues

- Default timezone set to `system` or a valid IANA name (e.g., `Europe/Berlin`)
- If using a per-note Timezone property, confirm the value is valid

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
