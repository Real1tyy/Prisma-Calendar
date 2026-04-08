# Event Naming

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
    <source src={useBaseUrl("/video/Zettelid.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Prisma Calendar uses two complementary systems to manage event naming: **ZettelID** for unique file storage and **Calendar Title** for clean display.

---

## ZettelID Naming System

Create unlimited events with identical display names while maintaining unique file storage behind the scenes.

### How It Works

Prisma Calendar uses **timestamp-based unique identifiers (ZettelIDs)** that are automatically appended to filenames but stripped from the calendar display.

**Display**: `Team Meeting` (everywhere in the calendar UI)

**Storage**: `Team Meeting-20250106143022.md` (file system and vault browser)

### ZettelID Format

**Regular events**: `-YYYYMMDDHHmmss` (14-digit timestamp)

Example: `Team Meeting-20250106143022.md`

**Physical recurring instances**: `[Title] [YYYY-MM-DD]-[14-digit-hash].md`

Example: `Team Meeting 2025-02-03-00001125853328.md`

Recurring instances include the instance date between the title and ZettelID hash. This date is preserved when editing or renaming the event — only the title portion changes.

This ensures every filename is unique, even when creating multiple events rapidly.

### Auto-Assign ZettelID

You can configure Prisma to automatically add ZettelIDs to files in the calendar directory that don't have one. Three modes are available in Settings → General:

- **Disabled** (default) — no automatic assignment
- **Calendar events only** — timed and all-day events
- **All events** — including untracked events

When active, files like `My Event.md` are renamed to `My Event-20260216120000.md` as they are indexed. Folder notes (notes with the same name as their parent folder, e.g., `tasks/tasks.md`) are automatically skipped to preserve the folder structure.

### ZettelID Property

**Optional**: Configure a ZettelID property in Settings → Properties to store the ZettelID in frontmatter.

ZettelID filenames work automatically whether or not you configure the property. The property adds the ZettelID to frontmatter for additional tracking.

```yaml
---
Title: Weekly Planning
ZettelID: 20250106143022
---
```

### Benefits

- Create unlimited events with identical names
- Clean UI without timestamp clutter
- Automatic collision prevention
- Works with all calendar features ([recurring events](../events/recurring-dsl.md), [batch operations](./batch-operations.md), [undo/redo](./undo-redo.md))

### Manual Events

**Prisma format** (`-YYYYMMDDHHmmss`): ZettelID is recognized and stripped from display. When cloning, the existing ZettelID is preserved.

**Other formats** (e.g., `Meeting-2025-01-06.md`): Full filename displayed. Cloning adds a new ZettelID, resulting in double timestamps.

**Recommendation**: Create events via the calendar interface for best results.

---

## Calendar Title Property

Prisma Calendar automatically assigns a **Calendar Title** property to event files — a clean wiki link with the ZettelID and recurring instance dates stripped.

### How It Works

When configured (enabled by default), event files receive a Calendar Title property containing a wiki link that displays the clean event name.

Given a file named `Team Meeting-20250106143022.md`:

```yaml
---
Start Date: 2025-01-06T09:00
End Date: 2025-01-06T10:00
ZettelID: 20250106143022
Calendar Title: "[[Events/Team Meeting-20250106143022|Team Meeting]]"
---
```

The Calendar Title property:
- Points to the event file itself
- Displays the clean name with the ZettelID and recurring instance dates stripped

### Where Calendar Title Is Used

- **Calendar view** — primary display name for all events
- **Bases view** — renders as a clickable wiki link, much more readable than raw filenames
- **Modals, context menus, notifications** — all UI surfaces use this for consistent clean display

### Configuration

**Setting**: Settings → Properties → Calendar title property
**Default**: `Calendar Title`

The property is automatically maintained — it updates on creation, rename, or modification. No manual setup needed.

### Calendar Title vs Title Property

| Aspect | Calendar Title | Title Property |
|--------|---------------|----------------|
| **Purpose** | Auto-computed clean display name | Manual override for event name |
| **Value** | Wiki link (e.g., `[[path\|Clean Name]]`) | Plain text (e.g., `My Custom Name`) |
| **Updated** | Automatically on every index | Manually by the user |
| **Priority** | Used first when available | Fallback if Calendar Title is missing |

Both properties can coexist. Calendar Title takes priority for display; the Title property serves as a fallback.
