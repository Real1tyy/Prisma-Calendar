# Prisma Calendar

Prisma Calendar is a feature-rich, fully configurable calendar plugin for Obsidian.

## Documentation

Full docs live in the Docusaurus site:
- Local: `docs-site/`
- Hosted: coming soon (GitHub Pages)

Repository: https://github.com/Real1tyy/Prisma-Calendar

Key pages:
- Introduction
- Installation
- Quickstart
- Features Overview
- Configuration
- FAQ, Troubleshooting, Roadmap, Changelog

## Demo Video

[![Watch the demo](https://img.youtube.com/vi/YOUR_VIDEO_ID/0.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)

## Features

- Multiple isolated calendars (each with its own folder, filters, colors, hotkey)
- Folder-based event scanning
- Templater integration (requires Templater plugin)
- Color rules and default fallback
- Event previews on hover; open on click
- Batch operations: delete, duplicate, move/clone to next week
- Recurring events DSL that generates real notes
- Virtual events (read-only) beyond generation horizon
- Reactive settings

## Installation

- Obsidian Community Plugins: Search "Prisma Calendar"
- Manual: Download release ZIP and copy to `.obsidian/plugins/prisma-calendar/`

```bash
pnpm install
mise run dev-watch
```

Build once and copy to vault:

```bash
mise run build-plugin
```

Run CI locally:

```bash
mise run ci
```

## Contributing

MIT-licensed. PRs welcome. Please run `mise run ci` before pushing.

## License

MIT
