Product Requirements Document (PRD)
1) Product goal

Provide a flexible, high-quality calendar experience for Obsidian that maps notes to events using user-chosen properties, supports recurrence, fast rescheduling, and clean theming—without sacrificing performance or openness.

2) Personas & jobs-to-be-done

Planner: “See all project deadlines and reschedule by drag.”

Researcher/Writer: “Attach notes to dates and browse past work.”

Power user: “Define my own property names, recurrence rules, and filters.”

3) Scope
In (MVP → v1.0)

Folder-based indexing.

Configurable property names.

Month/Week/Day/List views.

Click to open file.

Colors by tag/folder/regex.

Filters (tag/folder/text).

Drag/resize with safe write-back.

RRULE read & expansion.

Timezone handling (profile level).

Out (for now)

Multi-resource lanes/timeline.

ICS write (export).

Collaboration features.

4) Functional requirements
v0.1 (MVP)

Settings

Choose a folder.

Map startProp, endProp, titleProp, allDayProp, rruleProp, timezoneProp.

Set defaultDurationMinutes, parseFormats, enableNLP.

Configure basic color rules and filters.

Index & parse

From selected folder(s), parse frontmatter quickly.

Support date-only and date-time formats; all-day inference.

UI

FullCalendar with month/week/day/list.

Click → open note; hover tooltip (optional).

Filters toolbar (tags/folders).

Performance

Debounced updates.

Caching by (filePath, mtime).

Errors

Non-blocking error tray listing parse failures.

Acceptance criteria

With Start: 2025-09-05 only → all-day on Sep 5.

With Start: 2025-09-05T10:00, no End → 60-min event by default.

Rename file updates title within one debounce cycle.

Parsing failure shows a single row in the error tray with file path.

v1.0 (Core “usable daily”)

Write-back

Drag/resize updates start/end (and allDay if crossing date-only boundary).

Honor timezone & formatting policy.

Conflict guard: if mtime changed mid-flight, re-parse then apply; show toast if unsafe.

Profiles

Multiple calendar profiles (each with directories, mappings, colors, filters, UI).

Quick switcher in header; remember last view per profile.

Filters & search

Combine include/exclude tags & folders; text query.

Persist filters per profile.

Theming

CSS variables for density, radius, accents; 2 presets (clean/compact).

Keyboard & commands

Open Calendar, Switch view, Next/Prev/Today, Switch profile, “New event here…”

Acceptance criteria

Drag an event from Sep 5 10:00 → Sep 7 12:00 updates frontmatter correctly.

Switching profiles re-renders with different directories & colors instantly.

Filters exclude/include work cumulatively.

Compact theme reduces row heights ≥20%.

v1.1 (Power features)

Recurrence Read

Support RFC5545 RRULE in rruleProp.

Expansion within view range; support COUNT/UNTIL; basic BYDAY/BYMONTH.

Optional EXDATE support (string array).

Quick duplicate

Right-click event → “Duplicate to date…” opens date picker and creates a new note with same frontmatter, adjusted start/end.

Acceptance criteria

RRULE: FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=6 displays six instances in relevant ranges.

EXDATE removes those instances from view.

v1.2 (Write recurrence)

RRULE builder

Simple UI to add weekly/monthly patterns; writes RRULE to frontmatter.

Conflict resolution UI

If write-back cannot safely preserve edits, show dialog with: Open file / Retry / Cancel.

Acceptance criteria

Creating a weekly event via builder writes a valid RRULE.

Conflicting frontmatter yields modal; choosing “Open file” focuses editor.

5) Non-functional requirements

Performance: budgets as in Architecture §9.

Stability: no crashes on invalid data; errors logged per file.

6) UX copy (key strings)

“Pick a folder to show notes as events.”

“Couldn’t safely update this note. Open it to resolve?”

“No events in this range. Try another folder or relax filters.”

7) Risks & mitigations

Parsing chaos (freeform frontmatter): provide strict formats first; NLP optional, off by default.

Recurrence complexity: ship read-only first; validate with unit tests of rrule cases.

Write-back conflicts: always re-read before write; keep changes minimal (only touched keys).

8) Test plan

Unit (Vitest)

Parser: date-only, timed, malformed, timezone overrides.

Recurrence: weekly/monthly rules, COUNT/UNTIL, BYDAY edge cases.

EventStore: range queries, cache invalidation.

Integration (dev vault fixtures)

Simulate 500 notes across folders with mixed frontmatter.

Drag/resize scenarios; verify file content diffs.

Manual smoke

Profile switching, filters, errors panel, theming toggle.

9) Deliverables & milestones

Milestone 1 (v0.1): Settings → Indexer/Parser → Read-only calendar + filters + errors.

Milestone 2 (v1.0): Write-back + Profiles + theming + commands.

Milestone 3 (v1.1): RRULE read + Duplicate to date.

Milestone 4 (v1.2): RRULE builder + conflict modal.

10) Developer tasks (initial backlog)

 Vite + TS project scaffold; Obsidian manifest.

 SettingsStore + SettingsTab UI (folder picker, property mapping).

 Indexer (watchers + debounce) → RawEventSource cache.

 Parser (formats → Luxon ISO; NLP behind flag).

 EventStore (range expansion + cache).

 CalendarView with FullCalendar plugins & data adapter.

 Writer (processFrontMatter) + conflict guard.

 Filters & color rules.

 Error tray UI.

 Basic themes (clean/compact).

 Unit tests for parser & recurrence.