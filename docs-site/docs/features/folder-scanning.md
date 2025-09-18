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
Start: 2025-03-10T09:00
End: 2025-03-10T10:00
Title: Project Kickoff
---
```

## Edge cases

- Files outside the Directory are ignored
- Malformed frontmatter is skipped gracefully
