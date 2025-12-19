# FAQ

## About This Documentation

### Is the documentation completely up to date and accurate?

We strive for perfection, but Prisma Calendar is a **large, feature-rich project** with extensive documentation. It's quite complex for one person to manage everything perfectly, so there may be occasional inaccuracies or outdated information.

**If you spot something wrong, please help us!**
- Create a [Pull Request](https://github.com/Real1tyy/Prisma-Calendar/pulls) to fix it
- [Open an issue](https://github.com/Real1tyy/Prisma-Calendar/issues) to report it
- Suggest improvements or clarifications

Community contributions help us continuously improve the documentation and keep it accurate. Every correction, no matter how small, makes the docs better for everyone. Thank you for helping us improve! 🙏

---

## Getting Started

### How do I open the calendar view?

See the [Quick Start guide](/quickstart) for detailed instructions on opening your calendar, including ribbon icons, command palette, hotkeys, and more.

---

## General Questions

### Can I use multiple calendars at once?

Yes. Calendars can use separate directories for full isolation, or share the same directory for different visual perspectives of the same events.

### What happens if multiple calendars use the same directory?

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

### Are recurring events real notes?

Yes. Prisma Calendar generates real notes up to your configured "Future instances count." Farther-out instances show as read-only virtual events to keep your vault lean.

### Why do my event files have timestamps in their names, but the calendar shows clean titles?

This is one of Prisma Calendar's core UX features: **hidden ZettelID naming**.

**📝 What You See vs. What's Stored:**

- **In the calendar**: `Team Meeting` (clean, readable)
- **On disk**: `Team Meeting-20250106143022.md` (unique, timestamped)

**🎯 Why This Matters:**

The ZettelID (timestamp suffix like `-20250106143022`) acts as a unique identifier, allowing you to:

1. **Create multiple events with the same name** - Have ten "Team Meeting" events without conflicts
2. **Maintain uniqueness automatically** - The timestamp ensures every file is unique
3. **Work with clean names** - You never see the timestamp when editing, viewing, or previewing events
4. **Avoid manual naming** - No need to add "Team Meeting 1", "Team Meeting 2", etc.

**🔧 How It Works:**

1. When you create an event called "Team Meeting", the file is saved as `Team Meeting-20250106143022.md`
2. The calendar automatically strips the `-20250106143022` part when displaying events
3. When editing, enlarging, previewing, or interacting with the event, you only see "Team Meeting"
4. The ZLID stays hidden in the background, ensuring uniqueness

**💡 Example Use Case:**

You have a recurring daily standup:
```
Files in vault:
- Standup-20250103090000.md
- Standup-20250104090000.md
- Standup-20250105090000.md

What you see in calendar:
- Standup
- Standup
- Standup
```

All have the same clean "Standup" title in the UI, but unique filenames on disk.

### How do I change which frontmatter keys the calendar uses?

Go to Properties Settings and set your Start/End/AllDay/Title keys.

### My event isn't showing up — what should I check?

- Confirm the note is inside the calendar's Directory (subfolders included)
- Ensure the Start property exists and is a valid ISO datetime (or your parser defaults)
- Verify filters aren't excluding it (Rules → Event Filtering)
- Check color rules or filters for typos (expressions use property names directly)

### Why did my weekly recurring event start on a different day than its `Start` date?

The `Start` date is a **calculation starting point**, not always the first event's date. For weekly/bi-weekly rules, the system finds the first day **on or after** the `Start` date that matches your `RRuleSpec` (e.g., the first "sunday"). If your start date is a Friday but the rule is for every Sunday, the first event will be created on the following Sunday.

### How do color rules work?

Color rules are evaluated top-to-bottom. The first expression that evaluates to true sets the color. Example: `Priority === 'High' → red`.

### Can I preview notes on hover?

Yes. Enable "Enable event preview" in Calendar Settings (UI).

### Is external calendar integration supported?

Yes! Prisma Calendar supports integration with external calendars through two methods:

1. **CalDAV Sync (Read-Only)** - Automatically sync events from CalDAV servers (Fastmail, Nextcloud, iCloud, and other CalDAV-compatible services) into Obsidian. Events are imported as markdown notes with full frontmatter support.

2. **ICS Import/Export** - Manually exchange calendar files with any calendar application (Apple Calendar, Outlook, Thunderbird, etc.) using the standard ICS/iCalendar format.

**Current Status:**
- ✅ **CalDAV**: Read-only sync (server → Obsidian)
- ✅ **ICS**: Full import/export support
- 🔄 **Planned Improvements**: Two-way sync, write support for CalDAV, and enhanced sync capabilities

For detailed setup instructions and configuration, see the [Integrations documentation](/features/integrations).

### Is Google Calendar integration supported?

Google Calendar integration is planned for the future. Currently, you can use **ICS import/export** to exchange events with Google Calendar. Export your Prisma Calendar events as ICS files and import them into Google Calendar, or import Google Calendar exports into Prisma Calendar. See the [Integrations documentation](/features/integrations) for detailed instructions.

### Can I use Prisma Calendar with Templater?

Yes. Configure your template path in both Templater (folder template) AND Prisma Calendar settings (General → Template path) to ensure templates apply consistently whether you create events through the calendar or manually. See [Troubleshooting - Templater Integration](troubleshooting.md#templater-integration).
