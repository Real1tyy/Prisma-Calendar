# Event Previews

See note content and navigate links without opening files.

## Hover Previews

- Enable in Calendar Settings (UI) → "Enable event preview"
- Hover over any event to see a quick preview
- Shows note title and first few lines of content

## Enlarged Modal Preview

**Access:** Shift+Click event, or right-click → "Preview Event"

**Shows:**
- Complete frontmatter with all properties
- Clickable wikilinks, tags, and URLs in frontmatter

**Special features:**
- **Recurring instances**: Source button to navigate to source event
- **Virtual events**: Shows the source event configuration
- **Source events**: Instance dropdown to view all generated instances with past filter

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
