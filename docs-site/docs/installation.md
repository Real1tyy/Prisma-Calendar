# Installation

## From Obsidian Community Store
1. Open Settings → Community plugins → Browse.
2. Search Prisma Calendar.
3. Install and enable.

## Manual (from GitHub Releases)
1. Download the latest release ZIP.
2. Unzip to your vault’s `.obsidian/plugins/prisma-calendar/` folder.
3. Enable in Settings → Community plugins.

## Requirements
- Obsidian 1.5+
- For templating features, install the Templater plugin

## First-time setup checklist

- Create or pick a folder for your calendar notes (e.g., `Calendar/`)
- (Optional) Create a Templater template for new events
- Open Settings → Prisma Calendar and choose your Active Calendar
- Set Directory to your chosen folder
- Review frontmatter property names (Start/End/AllDay/Title) and adjust if you already use different keys

### Optional: Minimal Templater template

```md
---
Title: <% tp.file.title %>
Start: <% tp.date.now("YYYY-MM-DDTHH:mm") %>
End: <% tp.date.now("YYYY-MM-DDTHH:mm", 60*60*1000) %>
AllDay: false
Status: Inbox
---

# <% tp.file.title %>

Notes here...
```
