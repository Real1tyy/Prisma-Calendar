# Multiple Planning Systems

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
    <source src={useBaseUrl("/video/MultipleCalendarsSupport.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Separate contexts with dedicated configurations. The free plan supports up to 3 planning systems. [Upgrade to Pro](../free-vs-pro.md) for unlimited planning systems.

## Why multiple planning systems?

- Keep Work and Personal events in separate directories
- Use different property mappings for different workflows
- Use different filter rules for different event types
- Use different color schemes for different contexts
- Bind hotkeys to jump between planning systems quickly

## Typical setup

Every planning system is fully isolated. You can use separate directories or point multiple planning systems at the same directory. Both approaches work.

1. Create a Work planning system → Directory `work/`
2. Create a Personal planning system → Directory `personal/`
3. Configure different property mappings, filters, and color rules per planning system
4. Assign hotkeys to switch quickly

**Separate directories** give you content separation — different notes live in different folders. **Shared directories** let you view the same notes through different lenses (different properties, filters, or color schemes).

## Managing planning systems

All management happens in Settings at the top of the page — create, clone, rename, configure, or delete planning systems from the action buttons.

- **Settings remember your last-used system** — opening settings pre-selects the planning system you last interacted with.
- **Creating or deleting** a planning system is instant and never disrupts other open systems — no re-indexing, no settings closing.
- **Renaming** immediately updates the ribbon icon tooltip and command palette entries.
- **Configure current** opens a focused modal that scans your vault for date-like properties and lets you set the directory and property names with auto-detection.

## Example Configurations

**Separate Work/Personal Events:**
```
Planning System "Work":
  Directory: work/events/
  Properties: start, end, title
  Filters: (none)
  Colors: Blue theme

Planning System "Personal":
  Directory: personal/events/
  Properties: scheduled, deadline, name
  Filters: (none)
  Colors: Purple theme
```

**Separate Project Tracking:**
```
Planning System "Active Projects":
  Directory: projects/active/
  Filters: status !== 'done'
  Colors: Priority-based colors

Planning System "Archive":
  Directory: projects/archive/
  Filters: (none)
  Colors: Muted gray theme
```

**Same Directory, Different Properties:**
```
Planning System "Meetings":
  Directory: work/
  Properties: meetingStart, meetingEnd, meetingTitle
  Filters: type === 'meeting'
  Colors: Blue theme

Planning System "Deadlines":
  Directory: work/  (same directory!)
  Properties: dueDate, deadline, taskName
  Filters: type === 'deadline'
  Colors: Red theme
```

## Sharing Directories

Planning systems never interfere with each other, even when pointing at the same directory with completely different configurations.

**Same directory, different properties:** Each planning system only sees events matching its configured property names. A planning system looking for `meetingStart` and another looking for `dueDate` in the same folder will each find only the notes relevant to them.

**Same directory, same properties:** Both planning systems see the same events independently. Changes made in one are picked up by the other. There are no conflicts or overrides — each operates on its own copy of the data.

**Subdirectories:** A planning system pointing at `work/` and another at `work/projects/` work independently. Each indexes only the notes in its configured path.

**What you can customize per planning system (all independent):**
- Property mappings (Start, End, Date, Title, etc.)
- Filter expressions
- Color rules and themes
- View settings (hour range, default view, time slots)
- Display properties (which frontmatter fields to show)
- Recurring event settings
- UI preferences (event preview, contrast settings)

### Decision Guide

**Use the SAME directory when:**
- You want different views of the same notes (e.g., timeline vs. daily focus)
- You want to read different properties from the same notes (e.g., meetings vs. deadlines)
- You want different color schemes or filter rules for the same content

**Use SEPARATE directories when:**
- You want content separation — different notes for different contexts
- You're organizing completely different types of events (work vs. personal)
- You prefer a clean folder structure in your vault
