# Templater Integration

Generate consistent event notes with your favorite tokens.

## Requirements

- Templater plugin installed and enabled
- Template path set in Prisma Calendar → General Settings

## Minimal template example

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

Tips:
- Keep frontmatter aligned with your Properties Settings (Start/End/AllDay/Title)
- Add custom fields (e.g., `Project`, `Priority`) to use with color rules and filters
