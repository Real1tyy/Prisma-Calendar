### Added

- **Event actions in Obsidian's file menu**: right-clicking a note that Prisma tracks as an event — in the file explorer or from its tab's **More options** menu — now offers **Edit event**, **Trigger stopwatch**, **Mark as done/undone** and **Skip/unskip**, so you can act on an event without switching to the calendar. Each entry point is configured separately under **Settings → Configuration**: pick which actions appear when you right-click in the file explorer, and which appear from a note's tab or header, or clear either list to add nothing there. Plain notes are untouched, the stopwatch entry follows your time-tracker setting, and the whole group can be turned off per planning system in **Settings → General → Interface**. See [File Menu Actions](./features/management/file-menu-actions.md).

### Fixed

- **A planning system no longer claims folders that merely share its name**: with a planning system rooted at `Tasks`, notes in a sibling folder like `TasksArchive` or `Tasks-old` were treated as belonging to it — **Open current note in calendar** and **Edit active note** acted on them instead of reporting them as outside the folder. Folder matching now stops at the folder boundary, so only notes genuinely inside the configured folder (at any depth) count. See [Folder Scanning](./features/calendar/folder-scanning.md).
