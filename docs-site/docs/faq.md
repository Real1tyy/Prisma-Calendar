# FAQ

**Can I use multiple calendars at once?**
Yes. Each calendar is fully isolated with its own directory, filters, color rules, and UI settings. Use shortcuts to switch quickly.

**Are recurring events real notes?**
Yes. Prisma Calendar generates real notes up to your configured “Future instances count.” Farther-out instances show as read-only virtual events to keep your vault lean.

**How do I change which frontmatter keys the calendar uses?**
Go to Properties Settings and set your Start/End/AllDay/Title keys. You can also specify a per-note Timezone property and a ZettelID property if you want automatic IDs.

**My event isn’t showing up — what should I check?**
- Confirm the note is inside the calendar’s Directory (subfolders included)
- Ensure the Start property exists and is a valid ISO datetime (or your parser defaults)
- Verify filters aren’t excluding it (Rules → Event Filtering)
- Check color rules or filters for typos (expressions use `fm` for frontmatter)

**Why did my weekly recurring event start on a different day than its `Start` date?**
The `Start` date is a **calculation starting point**, not always the first event's date. For weekly/bi-weekly rules, the system finds the first day **on or after** the `Start` date that matches your `RRuleSpec` (e.g., the first "sunday"). If your start date is a Friday but the rule is for every Sunday, the first event will be created on the following Sunday.

**How do color rules work?**
Color rules are evaluated top-to-bottom. The first expression that evaluates to true sets the color. Example: `fm.Priority === 'High' → red`.

**Can I preview notes on hover?**
Yes. Enable “Enable event preview” in Calendar Settings (UI).

**Is Google Calendar integration supported?**
Planned for a future Pro tier.
