Obsidian Vault Calendar — Architecture Guideline
0) Elevator pitch

Turn any folder of notes into a powerful, configurable calendar. Each note becomes an event (or a recurring series) using frontmatter properties you choose. Fast, themeable, write-back edits via drag/resize, filters, color rules, and multiple calendar profiles.

1) Tech choices

UI calendar: FullCalendar (vanilla build) with dayGrid, timeGrid, interaction, list.

Date/time: Luxon (timezones, durations).

Recurrence: rrule.js (RFC5545 expansion). Optionally FullCalendar’s rrule adapter later.

NLP (optional): chrono-node for “next Tue 14–16:30” parsing.

Build tooling: Vite (preferred) or esbuild. TypeScript strict mode.

Testing: Vitest + tiny “obsidian API mock” for unit tests. Manual smoke tests inside Obsidian dev mode.

License: MIT for the plugin. Only MIT/Apache deps.

2) Data model & frontmatter contract
2.1 Internal types
type ISO = string; // ISO 8601 normalised by Luxon

export interface VaultEventId {
  filePath: string;        // absolute vault path
  anchor?: string;         // optional heading/block anchor if you ever support multi-events per note
}

export interface VaultEvent {
  id: string;              // stable hash of (filePath + anchor)
  ref: VaultEventId;
  title: string;
  start: ISO;              // required (UTC normalised)
  end?: ISO;               // optional
  allDay?: boolean;        // computed if date-only
  timezone?: string;       // optional override for this event
  rrule?: string;          // raw RFC5545 string (for source of truth)
  color?: string;          // resolved by color rules
  url?: string;            // obsidian://open?path=...
  meta?: Record<string, unknown>; // any extra props (tags, project, etc.)
}

2.2 Frontmatter properties (configurable)

startProp (required, default: Start)

endProp (optional, default: End)

allDayProp (optional boolean)

rruleProp (optional, default: RRULE)

titleProp (optional; fallback to file name)

timezoneProp (optional; default calendar TZ)

Parsing formats: ISO + user-provided formats; NLP if enabled.

Rules:

If only start:

date-only ⇒ all-day = true (unless allDayProp: false)

date-time ⇒ timed event with defaultDurationMinutes applied unless allDayProp true.

If rrule present:

Expand within requested range.

Instance overrides: if note also has start/end, treat as rule seed (base), else rely solely on rrule with DTSTART implied/explicit.

3) Settings & profiles
export interface ColorRule {
  kind: "tag" | "folder" | "regex";
  match: string;            // e.g., "#work" | "Projects/Alpha" | ".*deadline.*"
  color: string;            // CSS color or theme var
}

export interface CalendarProfile {
  id: string;
  name: string;
  directories: string[];            // folders to index
  startProp: string;                 // default "Start"
  endProp?: string;                  // default "End"
  allDayProp?: string;               // undefined if not used
  rruleProp?: string;                // default "RRULE"
  timezone?: string;                 // "system" | IANA TZ
  defaultDurationMinutes: number;    // default 60
  enableNLP: boolean;                // chrono-node
  colorRules: ColorRule[];
  filters: {
    includeTags?: string[];
    excludeTags?: string[];
    includeFolders?: string[];
    excludeFolders?: string[];
    textQuery?: string;              // simple contains/regex
  };
  ui: {
    initialView: "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";
    hideWeekends?: boolean;
    hourStart?: number;              // e.g., 7
    hourEnd?: number;                // e.g., 22
    density?: "comfortable" | "compact";
  };
}

export interface PluginSettings {
  version: number;
  activeProfileId: string;
  profiles: CalendarProfile[];
  telemetry: { enabled: false };     // placeholder: off by default
}

4) Modules & responsibilities

SettingsStore

Load/save settings, migrate versions.

Expose reactive getters (simple event emitter).

Indexer (Vault watcher + Metadata cache reader)

Watches vault.on("create" | "modify" | "rename" | "delete").

Debounces (e.g., 300–800 ms) to batch updates.

For candidate directories, uses metadataCache.getFileCache(file)?.frontmatter to parse lightweight props.

Produces RawEventSource (one per file) including:

file path

mtime

raw frontmatter snapshot (keys of interest)

tags/folder

Parser

Transforms RawEventSource → VaultEvent[] (zero, one, or many if recurrence expands).

Handles:

Title resolution (titleProp → H1 → file name).

Date parsing: strict formats → fallback to ISO → optional NLP.

Luxon normalization to UTC ISO.

All-day inference.

RRULE expansion for requested range (defer expansion to EventStore query time).

EventStore

Caches parsed templates per file (no expansion yet), keyed by (filePath, mtime).

On query (rangeStart, rangeEnd), expands any RRULEs only as needed and returns a flat array of VaultEvent.

Optionally maintain a time-index (sorted array + binary search) for faster range filtering.

Exposes:

getEvents(range): VaultEvent[]

getEventById(id): VaultEvent | undefined

invalidate(filePath) on changes.

CalendarView (Obsidian ItemView)

Hosts FullCalendar instance.

Pulls events via EventStore for current visible range.

Hooks:

eventClick → open file.

eventDrop/eventResize → write back via fileManager.processFrontMatter.

Keeps scroll/selection state between profile switches.

Writer (Frontmatter write-back)

Canonical function updateNoteTime(file, patch):

Reads frontmatter fresh (to avoid overwriting unrelated changes).

Applies diff (respect original formatting where feasible).

Writes with processFrontMatter.

Conflict handling (see §8).

ProfileManager

Switch active profile; re-render view.

Persist last used view per profile.

Theme & CSS Layer

CSS variables for colors, density, border radius, font size.

Light/Dark support; respects Obsidian theme but can override calendar cells.

Command palette & hotkeys

Open Calendar

Switch view (Month/Week/Day/List)

Next/Prev/Today

Switch profile

Quick “New event here…” action (opens a prefilled note template).

5) Lifecycle & flows
5.1 Startup

Load settings → set active profile.

Indexer scans configured directories (shallow predicate).

Parser builds cached templates for files with relevant props.

CalendarView mounts; queries EventStore for visible range; renders.

5.2 File change

Vault event fires → Indexer invalidates that file → Parser reparses → EventStore updates cache → View refreshes (debounced).

5.3 User drag/resize

FullCalendar emits new start/end (local view TZ).

Convert to target timezone (profile or event override) using Luxon → normalise to desired format.

Writer updates frontmatter. On success, EventStore invalidates and refreshes.

5.4 Profile switch

Teardown/re-init FullCalendar with new profile UI and data pipe.

Persist last used view, filters, search.

6) Timezone, formatting, and recurrence

Storage policy: Store ISO in frontmatter (YYYY-MM-DD for all-day, YYYY-MM-DDTHH:mm for timed). If user provided a custom format string, preserve chosen format when writing (setting: “preserve user format” vs “force ISO”).

Display policy: FullCalendar shows times in profile timezone; convert from UTC with Luxon.

RRULE: Store raw RFC5545 string. Expansion done per range via rrule.js. Support UNTIL/COUNT; exdates via EXDATE property (optional later).

NLP: If enabled, parser attempts chrono-node before final fallback; store parsed ISO on write-back (not the NLP text).

7) UI/UX details

Views: dayGridMonth / timeGridWeek / timeGridDay / listWeek.

Header toolbar: prev next today | title | dayGridMonth timeGridWeek timeGridDay listWeek.

Event card: title, time range; hover tooltip with snippet (first 160 chars of note) if enabled.

Colors: apply from first matching color rule; else theme default.

Filters: quick tag/folder chips in a top bar; text search input.

Context menu on event: Open, Reveal in sidebar, Duplicate to date…, Copy link.

Empty-state: friendly message + “Pick a folder in Settings”.

Error status panel: show parsing errors per file (collapsible tray).

8) Write-back & conflict handling

Atomic update: Use processFrontMatter(file, mutator).

Conflict guard: Before mutate, compare cached mtime vs current. If mismatch:

Re-parse and re-apply the intended change.

If frontmatter no longer has target keys or user changed them radically, prompt a non-blocking toast “Couldn’t safely update; open file?”

Formatting: If “preserve format” is on and original was date-only, keep date-only when allDay or defaultDuration used.

9) Performance budget

Target vault size: 1–2k candidate notes.

Cold boot: ≤ 300 ms to initial render for 500 notes (on typical desktop).

Range query: ≤ 100 ms for month view with 1k notes (no recurrence), ≤ 200 ms with recurrence expanded.

Debounce: file change debounce 300–800 ms; re-render throttle 60–120 ms.

Memory: templates cached by (filePath, mtime); purge LRU beyond 10k.

10) Accessibility & i18n

A11y: Calendar grid supports keyboard navigation (FullCalendar handles most). Provide visible focus states and readable contrasts.

i18n: Strings isolated under lang/<locale>.json. Default English; user can override locale (affects calendar week start).

11) Security & privacy

No external network calls.

No telemetry by default (settings stub present, disabled).

Keep all processing local to Obsidian environment.

12) Packaging & versioning

SemVer: 0.y while iterating; stabilize at 1.0.

Breaking changes: Migrate settings version on load.

Distribution: manifest.json, main.js, styles.css packaged per Obsidian guidelines.

13) Directory layout (suggested)
obsidian-vault-calendar/
  src/
    main.ts
    view/CalendarView.ts
    core/
      SettingsStore.ts
      ProfileManager.ts
      Indexer.ts
      Parser.ts
      EventStore.ts
      Writer.ts
      types.ts
      time.ts           // Luxon helpers, TZ policy
      recurrence.ts     // rrule helpers
      filters.ts        // tag/folder/text filters
      colors.ts
    ui/
      SettingsTab.ts
      components/       // small controls, error tray
    lib/
      fullcalendar/     // FC init helpers
  test/
    parser.spec.ts
    recurrence.spec.ts
    eventstore.spec.ts
  styles.css
  vite.config.ts
  package.json
  manifest.json
  README.md

14) Extension points (future)

Transform hooks: user JS hook to post-process events.

Color rule API: multiple rule groups with priorities.

Multi-resource mode: resources by tag/folder.

ICS import/export: read-only import; export month to .ics.