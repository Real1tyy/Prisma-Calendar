<div align="center">

[![Prisma Calendar Demo](https://img.youtube.com/vi/JjZmNJkQlnc/hqdefault.jpg)](https://www.youtube.com/watch?v=JjZmNJkQlnc)

# Prisma Calendar

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Real1tyy/Prisma-Calendar/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-vitest-yellow.svg)](tests/)
[![Obsidian](https://img.shields.io/badge/obsidian-plugin-purple.svg)](https://obsidian.md)

**Feature-rich, fully configurable calendar plugin for Obsidian with multiple calendars, templater integration, color rules, batch operations, and recurring events.**

</div>

## 📚 Documentation

**[View Full Documentation →](https://real1tyy.github.io/Prisma-Calendar/)**

Quick Links:
- [Installation](https://real1tyy.github.io/Prisma-Calendar/installation) • [Quickstart](https://real1tyy.github.io/Prisma-Calendar/quickstart) • [Configuration](https://real1tyy.github.io/Prisma-Calendar/configuration)
- [Features Overview](https://real1tyy.github.io/Prisma-Calendar/features/overview) • [FAQ](https://real1tyy.github.io/Prisma-Calendar/faq) • [Troubleshooting](https://real1tyy.github.io/Prisma-Calendar/troubleshooting)

## ✨ Key Features

### 🗓️ **Multiple Isolated Calendars**
- **Up to 10 separate calendars** with independent configuration
- **Dedicated folders** - each calendar scans its own directory tree
- **Custom hotkeys** - instant switching between calendars
- **Clone & duplicate** calendars with all settings intact

### 📁 **Advanced Event Management**
- **Folder-based scanning** - any note with frontmatter becomes an event
- **Templater integration** - scaffold consistent event metadata automatically
- **Batch operations** - select multiple events to delete, duplicate, move, or clone to next/previous week
- **Undo/Redo system** - command pattern with semantic undo for all operations ("Undo Create Event", "Undo Batch Delete")
- **File linking** - click events to open notes, batch-open multiple files in tabs

### 🔄 **Powerful Recurring Events**
- **DSL-powered recurrence** - `daily`, `weekly`, `bi-weekly`, `monthly`, `yearly` with custom specifications
- **Real note generation** - creates actual Obsidian notes (not just calendar entries)
- **Virtual event previews** - see future instances beyond generation horizon without cluttering vault
- **Weekday specifications** - `monday, wednesday, friday` for flexible weekly patterns
- **Stable RRuleID tracking** - maintain recurring series across edits

### 🎨 **Dynamic Visual Customization**
- **JavaScript-powered color rules** - `fm.Priority === 'High' → #ef4444`
- **Property-based filtering** - show/hide events with complex expressions
- **Frontmatter Display** - show extra frontmatter properties inside event chips
- **Multiple view modes** - month, week, day, list with customizable time ranges
- **Zoom controls** - CTRL+scroll with configurable zoom levels (1-60 minutes)

### ⚡ **Performance & UX**
- **Reactive settings** - changes apply instantly without restart
- **Event previews** - hover to see content without opening files
- **Smart defaults** - timezone-aware with system/custom timezone support
- **Debounced scanning** - efficient file watching and processing
- **Compact/comfortable** display density options

## Support & Sponsorship

If you find Prisma Calendar useful and want to support its ongoing development, please consider becoming a sponsor. Your contribution helps ensure continuous maintenance, bug fixes, and the introduction of new features.

-   [Sponsor on GitHub](https://github.com/sponsors/Real1tyy)
-   [Buy Me a Coffee](https://www.buymeacoffee.com/real1ty)

Every contribution, no matter the size, is greatly appreciated!

## Contributing

MIT-licensed. PRs welcome! Please run `mise run ci` before pushing.

---

[Repository](https://github.com/Real1tyy/Prisma-Calendar) • [Documentation](https://real1tyy.github.io/Prisma-Calendar/) • [Issues](https://github.com/Real1tyy/Prisma-Calendar/issues)
