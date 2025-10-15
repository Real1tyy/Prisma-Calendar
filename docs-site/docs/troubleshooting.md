# Troubleshooting

Use this checklist to diagnose common issues.

## Events not appearing

- Plugin enabled and vault reloaded
- Calendar Directory points to the correct folder (subfolders included)
- Note has a valid `Start` property (ISO format recommended, e.g., `2025-02-10T14:00`)
- Filters aren’t excluding your note (Rules → Event Filtering)
- Frontmatter keys match your Properties Settings (e.g., `Start` vs `start`)

## Wrong colors or no color applied

- The first matching color rule wins — check rule order
- Expressions use `fm` (e.g., `fm.Priority === 'High'`)
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
