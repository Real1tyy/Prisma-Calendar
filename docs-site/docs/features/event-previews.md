# Event Previews

See note content and navigate links without opening files.

## Hover Previews

![Hover Preview](/img/hover_event.png)

*Quick hover preview showing event time, title, and configured display properties*

- Enable in Calendar Settings (UI) → "Enable event preview"
- Hover over any event to see a quick preview
- Shows note title and first few lines of content

## Enlarged Modal Preview

![Enlarged Event Preview](/img/enlarge.png)

*Expanded modal view showing complete event details, properties, and clickable links*

**Access:** Shift+Click event, or right-click → "Enlarge"

**Shows:**
- Complete frontmatter with all properties
- Clickable wikilinks, tags, and URLs in frontmatter

**Special features:**
- **Recurring instances (physical)**: Source button to navigate to source event in calendar, or right-click → "Go to source" (navigates to source event in week view)
- **Virtual events**: Shows the source event configuration, right-click → "Go to source" to navigate to source event in calendar
- **Source events**: Instance dropdown to view all generated instances with past filter

## Opening Event Files

Right-click on any event to access file operations:

- **Open file**: Opens the event file in the current workspace tab
- **Open file in new window**: Opens the event file in a detached popout window, making it easier to edit complex properties like checkboxes and list properties directly in the markdown editor while keeping the calendar view visible

## Clickable Frontmatter

All frontmatter properties in enlarged preview are interactive:

```yaml
---
Project: [[Alpha Project]]        # Click to navigate
Tags: [work, meeting]             # Click tags to search
VideoCall: https://zoom.us/...    # Click to open in browser
---
```

Works with wikilinks, tags, URLs, and file paths.
