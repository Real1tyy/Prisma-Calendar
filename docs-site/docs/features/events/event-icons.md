---
sidebar_position: 12
---

# Event Icons

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
    <source src={useBaseUrl("/video/Icons.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Assign a custom icon (emoji or text) to any event via frontmatter.

## How It Works

Set the `Icon` property in an event's frontmatter. The icon appears in the top-right corner of the event chip on the calendar — the same position used by [CalDAV/ICS integration icons](../advanced/integrations) and recurring event markers.

```yaml
---
Icon: "📅"
---
```

Any string value works: emoji, Unicode characters, or short text.

The icon can also be set via the **Icon** field in the Create/Edit Event modal, and is saved as part of [event presets](../../configuration/general#event-presets).

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

When a source recurring event has a custom icon, it is automatically propagated to newly created physical instances. Existing physical instances can also have their icon set or overridden individually.

## Configuration

**Setting**: Settings → Properties → Icon property
**Default**: `Icon`

The frontmatter property name used to read and write the event icon. Clear the setting to disable the feature entirely (hides the modal field and stops reading the property).
