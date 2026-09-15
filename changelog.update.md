### Added

- **Logs in the Doctor** — a collapsed **Logs** section under the health checks shows the same log as the Logs view, with the same filters and search, so the diagnosis and the entries behind it sit on one page. Expanding it does not re-run the checks.

### Improved

- **Logs view** — reads like a developer's log explorer. **Levels** and **Scope** sit on one row, and each level has its own color on its chip, on a severity badge and on the line itself. Structured data follows the message as one line of JSON, and clicking a line opens the full record with each value as a key and value. **From** and **To** start at the oldest and newest entry, with a slider underneath to narrow the range. Search also matches the scope and highlights what it found. The search box has focus when the view opens, `Ctrl/Cmd+F` jumps back to it, and `Ctrl/Cmd+A` selects or deselects every shown line, with **Copy selected** in the header and next to the counter. The privacy notice and **Include full detail** toggle are gone — copies and saves are still redacted.

### Fixed

- **Doctor settings spacing** — the Doctor heading in Settings → General has its normal gap below the Event presets section again.
