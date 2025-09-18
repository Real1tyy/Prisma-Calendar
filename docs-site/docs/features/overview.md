# Features Overview

- Multiple isolated calendars (own folder, filters, colors, hotkey)
  - Create and clone calendars; each has independent rules and UI settings
- Folder-based event scanning
  - Point a calendar at `Calendar/` (subfolders included) and notes with frontmatter are events
- Templater integration
  - Use a template to scaffold consistent event metadata
- Color rules (with default fallback)
  - `fm`-based expressions choose colors; first match wins
- Event previews on hover; open on click
  - Toggle previews in UI settings
- Batch operations (delete, duplicate, move/clone to next week)
  - Select multiple events to speed up planning
- Recurring events DSL that generates real notes (node-based)
  - Use `RRule`/`RRuleSpec`; control generation horizon
- Virtual events (read-only) beyond generated horizon
  - Keeps your vault light while still seeing future context
- Reactive settings (instant updates)
  - Changes reflect immediately in the calendar

### Example frontmatter

```yaml
---
Title: Sprint Planning
Start: 2025-02-03T10:00
End: 2025-02-03T11:00
RRule: bi-weekly
RRuleSpec: monday
Project: Work
Priority: High
---
```

### Example color rules

```text
fm.Priority === 'High'   → #ef4444
fm.Project === 'Work'    → #3b82f6
```
