# Folder Scanning

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/FolderScan.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

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

## Date Property Normalization

Enable "Normalize date property for sorting" in Properties Settings to make external tools (Dataview, Bases, etc.) sort all events chronologically.

**The Problem**: External tools can only sort by one field. Prisma uses separate properties for timed events and all-day events, making chronological sorting impossible.

**The Solution**: Automatically copy the start or end time into a single `Date` property for timed events.

### Options

- **None**: Default behavior, no changes
- **Copy start datetime**: Sort events by when they start
- **Copy end datetime**: Sort events by when they end

## Edge cases

- Files outside the Directory are ignored
- Malformed frontmatter is skipped gracefully
