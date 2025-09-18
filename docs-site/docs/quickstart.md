# Quick Start

1. Open Settings → Prisma Calendar and confirm your Active Calendar.
2. Set Directory to the folder where event notes should live (e.g., `Calendar/`).
3. (Optional) Adjust frontmatter property names for Start/End/AllDay/Title if you use custom keys.
4. (Optional) Set Template path to a Templater template for new events.
5. Create an event note (via your template or manually) and add frontmatter like:

```yaml
---
Title: Doctor Appointment
Start: 2025-02-10T14:00
End: 2025-02-10T15:00
AllDay: false
---

Remember insurance card.
```

6. Open the Prisma Calendar view:
- Hover to preview notes (if enabled)
- Click to open the underlying file
- Drag to move/resize; snap respects your Snap duration (Settings → UI Settings)
- Batch-select to duplicate/delete or move/clone to next week

### Recurring example

```yaml
---
Title: Standup
Start: 2025-02-03T09:30
RRule: weekly
RRuleSpec: monday, tuesday, wednesday, thursday, friday
---
```

Set “Future instances count” to control how many future notes are generated; beyond that, events appear as read-only virtual items.
