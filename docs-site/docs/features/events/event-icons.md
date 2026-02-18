---
sidebar_position: 12
---

# Event Icons

Assign a custom icon (emoji or text) to any event via frontmatter.

## How It Works

Set the `Icon` property in an event's frontmatter. The icon appears in the top-right corner of the event chip on the calendar — the same position used by [CalDAV/ICS integration icons](../advanced/integrations) and recurring event markers.

```yaml
---
Icon: "📅"
---
```

Any string value works: emoji, Unicode characters, or short text.

The icon can also be set via the **Icon** field in the Create/Edit Event modal, and is saved as part of [event presets](../../configuration#event-presets).

## Icon Precedence

When multiple icon sources exist for an event:

| Priority | Source |
|----------|--------|
| **1 (highest)** | User-set `Icon` property |
| 2 | Recurring event marker |
| 3 | CalDAV account icon |
| 4 | ICS subscription icon |
| 5 | Holiday marker (🏳️) |

Clear the `Icon` property to fall back to integration or recurring icons.

## Configuration

**Setting**: Settings → Properties → Icon property
**Default**: `Icon`

The frontmatter property name used to read and write the event icon. Clear the setting to disable the feature entirely (hides the modal field and stops reading the property).
