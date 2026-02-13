---
sidebar_position: 14
---

# Calendar Title Property

Prisma Calendar can automatically assign a **Calendar Title** property to event files, stripping ZettelID suffixes for cleaner display names in the calendar and Bases views.

## How It Works

When configured (enabled by default), event files that use the [ZettelID naming system](./zettelid-naming) will automatically receive a Calendar Title property containing a clean wiki link with the ZettelID stripped.

### Example

Given an event file named `Team Meeting-20250106143022.md`:

**Before** (no calendar title property):
```yaml
# Events/Team Meeting-20250106143022.md
---
Start Date: 2025-01-06T09:00
End Date: 2025-01-06T10:00
ZettelID: 20250106143022
---
```

**After** (calendar title property enabled):
```yaml
# Events/Team Meeting-20250106143022.md
---
Start Date: 2025-01-06T09:00
End Date: 2025-01-06T10:00
ZettelID: 20250106143022
Calendar Title: "[[Events/Team Meeting-20250106143022|Team Meeting]]"
---
```

The Calendar Title property is a wiki link that:
- Points to the event file itself
- Displays the clean name with the ZettelID and recurring instance dates stripped

## Where Title Is Used

### Calendar View

The calendar uses the Calendar Title property as the primary display name. Since the clean title is pre-computed and stored in frontmatter, no runtime stripping is needed — the title is always accurate and up to date.

### Bases View

When using Obsidian Bases to query your events, the Calendar Title property renders as a clickable wiki link showing the clean event name. This is much more readable than raw filenames with ZettelID suffixes.

### Event Modals, Context Menus & Notifications

All UI surfaces that display event names — edit modals, context menus, notifications, series views, and the Events Browser — use the Calendar Title property for consistent, clean display.

## Configuration

### Calendar Title Property Name

**Setting**: Settings → Properties → Calendar title property
**Default**: `Calendar Title`

The frontmatter property name used to store the auto-computed title. You can customize this if "Calendar Title" conflicts with existing properties in your vault.

The property is automatically maintained — it updates whenever the file is indexed (on creation, rename, or modification). No manual setup or rescanning is needed.

## How It Differs from Title Property

| Aspect | Calendar Title | Title Property |
|--------|---------------|----------------|
| **Purpose** | Auto-computed clean display name | Manual override for event name |
| **Value** | Wiki link (e.g., `[[path\|Clean Name]]`) | Plain text (e.g., `My Custom Name`) |
| **Updated** | Automatically on every index | Manually by the user |
| **Priority** | Used first when available | Fallback if Calendar Title is missing |

Both properties can coexist. The Calendar Title takes priority for display, but if you set a manual Title property, it serves as a fallback.
