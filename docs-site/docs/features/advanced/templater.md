# Templater Integration

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
    <source src={useBaseUrl("/video/TemplaterIntegration.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Apply a Templater template to every event note created through Prisma Calendar.

## Requirements

- [Templater](https://github.com/SilentVoid13/Templater) plugin installed and enabled
- A template file path configured in **Prisma Calendar → Settings → General → Template Path**

## How It Works

When you create an event (from the calendar UI, a command, or an ICS/CalDAV import), Prisma Calendar renders your template using Templater's engine, merges the event's frontmatter properties on top of whatever the template produces, and writes the final file in a single operation. Your event data always wins over any default values defined in the template.

## Template Path — Exclusive to Prisma Settings

Prisma Calendar uses **only** the template path configured in its own settings. Templater's built-in folder-template assignment (where you configure Templater to auto-apply a template to all new files in a specific folder) is **not used** and is actively bypassed for files created by Prisma.

This means:

- If you configure Templater to apply a template to your Tasks folder, and Prisma Calendar also creates events in that folder, Templater's folder template will **not** be applied to events created through Prisma. Only Prisma's configured template is used.
- If you create notes manually in the same folder (outside of Prisma Calendar), Prisma's template is **not** applied — those notes follow Templater's normal folder-template rules as usual.
- The template is applied exclusively when creating events through Prisma's API: the create event modal, commands, drag-to-create, ICS import, and CalDAV sync.

## Minimal Template Example

```md
---
Status: Inbox
Priority: Normal
---

# <% tp.file.title %>

Notes here...
```

Prisma's event properties (`Start Date`, `End Date`, `All Day`, etc.) are merged on top of the template's frontmatter after rendering. You do not need to include them in the template — they are added automatically. If you do include them, Prisma's values override the template's defaults.

## Supported Templater Functions

All standard `tp.*` functions work, including `tp.file.title`, `tp.file.path`, `tp.file.folder`, `tp.date.now`, `tp.system.*`, and user scripts. The following have limited behavior for newly created events:

| Function | Behavior |
|----------|----------|
| `tp.file.content` | Returns the file's initial placeholder content (the file is not yet finalized when the template renders). |
| `tp.frontmatter.*` | Returns empty/null (the metadata cache is not yet populated for the new file). |
| `tp.file.tags` | Returns empty/null (same reason as above). |

These limitations only apply to templates for new event creation. They do not affect templates used outside of Prisma Calendar.

## Recurring Event Instances

When a template is configured, [recurring event](../events/recurring-dsl.md) instances also use it. The template renders first, then any body content from the source recurring event is appended after the template body. This means your instances get the full template structure (headings, boilerplate, Templater functions) plus whatever content you wrote in the source event.

- **Event frontmatter wins**: Instance-specific properties (`Start Date`, `End Date`, `RRuleID`, etc.) override any matching template defaults, just like regular event creation.
- **Source body appended**: If the source recurring event has body content (text below the frontmatter), it is appended after the rendered template body with a blank line separator.
- **Empty source body**: If the source event has no body content, the instance contains only the rendered template.
- **Graceful fallback**: If Templater is unavailable or the template fails to render, instances are created with frontmatter and source body content as before — no instance is ever lost.
