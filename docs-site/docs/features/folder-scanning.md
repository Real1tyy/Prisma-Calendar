# Folder Scanning

Each calendar watches a folder for event notes.

## Setup

- Set Directory in General Settings (e.g., `Calendar/`)
- Subfolders are included automatically

## How notes become events

- Notes with a valid Start property (per your Properties Settings) appear on the calendar
- Optional End/AllDay/Title are read if present

### Example

```yaml
---
Start Date: 2025-12-18T08:45:00.000Z
End Date: 2025-12-18T11:30:00.000Z
All Day: false
---
```

## Edge cases

- Files outside the Directory are ignored
- Malformed frontmatter is skipped gracefully
