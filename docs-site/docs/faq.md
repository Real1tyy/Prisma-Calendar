# FAQ

**Can I use multiple calendars at once?**
Yes. Calendars can use separate directories for full isolation, or share the same directory for different visual perspectives of the same events.

**What happens if multiple calendars use the same directory?**

Multiple calendars **can** share the same directory! This is great for creating different views and color schemes of the same events.

**✅ Perfect Use Case: Different Visual Perspectives**

Example - Same events, different views:
```
Calendar "Work - Timeline"    Directory: work/
  → Month view, priority-based colors, all details

Calendar "Work - Daily Focus" Directory: work/ (same!)
  → Day view, project-based colors, minimal display
```

**What you CAN customize per calendar** (even with shared directory):
- ✅ Calendar name
- ✅ View settings (hour range, default view, time slot duration)
- ✅ Color rules (different colors for same events)
- ✅ Display properties (which frontmatter fields to show)
- ✅ UI preferences (event preview, past event contrast)

**❌ Shared Settings** (cannot differ between calendars on same directory):
- ❌ Frontmatter property mappings (Start, End, Date, Title, etc.) - uses FIRST calendar's settings
- ❌ Event filtering expressions - uses FIRST calendar's settings
- ❌ Recurring event settings (RRule properties) - uses FIRST calendar's settings

**Why some settings are shared**: Calendars pointing to the same directory share infrastructure (indexer, parser, event store) to prevent conflicts and duplicate event creation. This means one set of filters and property mappings per directory.

**When to use SEPARATE directories:**
- You need different filter expressions
- You need different property mappings (e.g., `start` vs. `scheduledDate`)
- You're managing completely different types of events

**⚠️ Known Issue**: After duplicating a calendar to the same directory, reload the plugin (Settings → Community Plugins → Disable/Enable) to avoid initialization issues.

**Additional Note**: Never use overlapping directories (e.g., `tasks` and `tasks/homework`). Use either the exact same path or completely separate directory trees to avoid conflicts.

**Are recurring events real notes?**
Yes. Prisma Calendar generates real notes up to your configured “Future instances count.” Farther-out instances show as read-only virtual events to keep your vault lean.

**How do I change which frontmatter keys the calendar uses?**
Go to Properties Settings and set your Start/End/AllDay/Title keys. You can also specify a per-note Timezone property and a ZettelID property if you want automatic IDs.

**My event isn't showing up — what should I check?**
- Confirm the note is inside the calendar's Directory (subfolders included)
- Ensure the Start property exists and is a valid ISO datetime (or your parser defaults)
- Verify filters aren't excluding it (Rules → Event Filtering)
- Check color rules or filters for typos (expressions use property names directly)

**Why did my weekly recurring event start on a different day than its `Start` date?**
The `Start` date is a **calculation starting point**, not always the first event's date. For weekly/bi-weekly rules, the system finds the first day **on or after** the `Start` date that matches your `RRuleSpec` (e.g., the first "sunday"). If your start date is a Friday but the rule is for every Sunday, the first event will be created on the following Sunday.

**How do color rules work?**
Color rules are evaluated top-to-bottom. The first expression that evaluates to true sets the color. Example: `Priority === 'High' → red`.

**Can I preview notes on hover?**
Yes. Enable “Enable event preview” in Calendar Settings (UI).

**Is Google Calendar integration supported?**
Planned for a future Pro tier.

**Why are my event times shifted by a few hours? (Timezone Configuration)**
This usually happens when your event files have UTC timestamps, but the calendar is set to display in your local timezone.

Many Obsidian plugins (like Metadata Menu) save date-time values in UTC format, which ends with a `Z`. For example: `2025-09-19T15:30:00.000Z`.

By default, Prisma Calendar will convert this UTC time to your system's local timezone. If your local timezone is UTC+2, `15:30Z` will be displayed on the calendar as `17:30`. This is the correct behavior, but it might not be what you want if you prefer to work directly with UTC.

To fix this and see the times exactly as they are written in your files, you need to tell the calendar to operate in UTC as well:
1. Go to the settings for the specific calendar.
2. Find the **General Settings** section.
3. Set the **Timezone** option to `UTC`.

Now, the calendar will interpret and display all times in UTC, matching what's in your notes.
