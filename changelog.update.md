### Added
- **Filter what you import, export and sync**: exporting or importing an `.ics` file, and every CalDAV account and ICS subscription, now takes a **Filter expression** — the same JavaScript-style rule the calendar's expression filter uses, e.g. `Category.includes('Work')` — plus a **Filter preset** dropdown that fills it from the calendar's saved presets. Only matching events are exported or imported, and the import preview shows how many of the file's events match. On a sync the filter is saved with the account or subscription: events that don't match are never created, and a previously synced note that stops matching is removed on the next sync. An invalid expression is reported instead of filtering everything out, and a sync with one changes nothing. See [Filtering imports, exports and syncs](./features/advanced/integrations.md#filtering-imports-exports-and-syncs).

### Improved

- The Prisma logo now appears in the app — beside the title of the welcome screen you see on first launch, in the top-right corner of the settings header, and beside "Prisma Calendar" in the settings sidebar — the same logo the docs site uses.

- **Image previews**: the logo and Pro feature screenshots stay available offline after loading once, and share the same full-screen preview controls. See [Free vs Pro](./docs-site/docs/features/free-vs-pro.md#feature-previews).

### Fixed
- The **Export calendar** modal opens with **Exclude skipped events** switched on and **UTC** selected, matching what the export actually used — the toggle used to look off and the timezone blank.
