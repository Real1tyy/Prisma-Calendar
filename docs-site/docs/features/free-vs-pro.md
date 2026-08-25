# Free vs Pro

import useBaseUrl from "@docusaurus/useBaseUrl";

**👉 [Visit the product page](https://matejvavroproductivity.com/tools/prisma-calendar/?utm_source=docs-site&utm_medium=content&utm_content=free-vs-pro-top) to learn more or start a 30-day free trial.**

Prisma follows a freemium model, so all of the core features are completely free. For more connected, advanced workflows, Prisma Pro unlocks calendar synchronization, advanced visualizations, Bases integration for embedding views directly inside notes, and other power-user capabilities built for serious planning inside Obsidian.

## What's Free

Everything you need for a powerful, production-ready planning experience ships for free, with no account required:

- **Tabbed view navigation** — Calendar (Month, Week, Day, List), Timeline, Daily+Stats, and Dual Daily in a persistent tabbed container with CTRL+scroll zoom and density options
- **55+ header actions** — customizable one-click shortcut buttons for any command, fully reorderable with custom icons and colors
- **Up to 3 planning systems** — each with independent settings, directories, property mappings, and views
- **Up to 2 event presets** — quick event creation with pre-filled frontmatter values
- **Recurring events** — 9 built-in recurrence types + custom intervals (every N days/weeks/months) with real note generation and virtual previews
- **50-action undo/redo** — full memento history covering creates, edits, deletes, moves, clones, skips, and all batch operations
- **10+ batch operations** — multi-select with delete, duplicate, move, clone, skip, mark done/undone, assign categories, and more
- **Time tracker** — built-in stopwatch with start, continue, break, resume, and minimize to background
- **Statistics dashboard** — daily, weekly, monthly, and all-time views with pie charts and category breakdowns
- **Color rules engine** — JavaScript expressions mapping frontmatter values to colors
- **Advanced filtering** — text search + JavaScript expression filters + saved filter presets
- **Desktop notifications** — configurable lead time, snooze, and per-event overrides
- **Holidays** — 50+ countries (offline), ~20 language locales
- **Capacity tracking** — used vs total hours indicator with auto-inferred time boundaries
- **Title autocomplete** — ghost text suggestions from categories, presets, and frequent names
- **Auto-assign categories** — by exact name match or substring match (e.g., "Youtube Analysis" auto-assigns "Youtube")
- **Event groups** — auto-grouping by recurring rule, category, or name with series statistics and timeline
- **Untracked events inbox** — drag & drop undated notes onto the planning system with dedicated filtering
- **ICS import/export** — manual exchange of `.ics` files with any calendar application
- **ZettelID naming**, Templater integration, and mobile support
- **60+ hotkeys** — keyboard shortcuts for navigation, batch operations, and quick actions

## What's Pro

Pro unlocks these additional capabilities on top of everything in the free tier:

| Feature | Description |
|---------|-------------|
| [AI Chat](./advanced/ai-chat.md) | Built-in sidebar with Claude and GPT. Query your planning system, create/edit events via natural language, and auto-plan your schedule. |
| [Bases Calendar View](./views/bases-calendar-view.md) | Render Prisma Calendar events inside any Obsidian Base as a fully interactive calendar with month/week/day views, drag-and-drop, and context menus. |
| [Heatmap View](./views/heatmap.md) | GitHub-style contribution heatmap showing event density across months/year with yearly and monthly modes, category-colored gradients, and click-to-inspect details. |
| [Dashboard](./views/dashboard.md) | Full-page overview of all events with pie charts and sortable tables for recurring events, categories, and name-based series. |
| [Prerequisite Connections](./advanced/prerequisite-connections.md) | SVG arrow overlay on the Calendar tab showing directed dependency arrows between prerequisite events |
| [Gantt View](./views/gantt.md) | Gantt tab with horizontal event bars on a date timeline with Day/Week/Month/Year view modes and native dependency arrows between prerequisite pairs. "Connected only" filter shows exclusively events in prerequisite relationships. |
| [CalDAV & ICS URL Sync](./advanced/integrations.md) | One-way read-only sync from Google Calendar, Apple Calendar, Fastmail, Nextcloud, iCloud, and any CalDAV server or public ICS URL. |
| [Programmatic API](./advanced/programmatic-api/overview.md) | `window.PrismaCalendar` and URL scheme for full CRUD, batch ops, statistics, settings, and navigation from external scripts. |
| [Custom Category Assignment Presets](./organization/categories.md) | Map comma-separated event names to categories. Events auto-match on creation. |
| Unlimited Planning Systems | Remove the 3-system limit — create as many planning systems as you need. |
| Unlimited Event Presets | Remove the 2-preset limit — create as many presets as you need. |
| Priority Support | First in line for help and feature requests. |

## Limits

| | Free | Pro |
|---|---|---|
| Planning Systems | Up to 3 | Unlimited |
| Event presets | Up to 2 | Unlimited |
| ICS import/export | Included | Included |
| AI Chat | — | Included |
| Bases Calendar View | — | Included |
| Heatmap View | — | Included |
| Dashboard | — | Included |
| CalDAV & ICS URL Sync | — | Included |
| Prerequisite Connections | — | Included |
| Gantt View | — | Included |
| Programmatic API | — | Included |
| Custom category presets | — | Included |

## How to Upgrade

1. Visit [matejvavroproductivity.com/tools/prisma-calendar](https://matejvavroproductivity.com/tools/prisma-calendar/?utm_source=docs-site&utm_medium=content&utm_content=free-vs-pro-upgrade) and start a 30-day free trial
2. After subscribing, you'll receive a license key
3. Enter the license key in **Settings → General → Obsidian Secrets → License key** to unlock Pro features
4. Click **Verify now** to activate — Pro features unlock immediately, no restart required

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/PrismaActivation.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/PrismaActivation.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

Once verified, the license section in General settings shows:

- **License status** — whether your license is active, plus your **trial, renewal, or cancellation date** when applicable (a different date from the offline-grace one below)
- **Device activations** — how many of your allowed devices are active (e.g., 2/5)
- **Offline expiry** — how long the license remains valid without an internet connection (7 days from the last verification, which refreshes automatically in the background while you're online)
- **Deactivate this device** — free up this device's activation seat, for example before moving to another computer (click Verify to re-activate it later)
- **Verify now** button — manually refresh your license status at any time

If something needs your attention — an inactive subscription or a reached device limit — the License section shows a clear next step (manage billing or manage devices) that links to your account page.

## FAQ

### What happens to my data if I downgrade?

Nothing is deleted. If you created 5 planning systems or 4 presets while on Pro, they all remain. You can still delete planning systems and presets, but you can't create new ones beyond the free-tier limits until you re-subscribe.

### Does Pro work offline?

Yes. Your license is verified on startup and then re-verified quietly in the background about once a day whenever you're online, so the 7-day offline window keeps rolling forward without you doing anything. If you go offline, everything keeps working for 7 days from the last successful check — no internet required. The offline expiry date is shown in **Settings → General → License status**. If the cached token ever expires, just reconnect to the internet (the plugin re-verifies automatically, or click **Verify now**). Your notes never leave your vault.

### Can I cancel anytime?

Yes. Cancel from your account page. If you cancel during the free trial, you're never charged. After the trial, you keep Pro access until the end of your billing period.

### How do I move Pro to another computer?

Your license covers up to 5 devices. Each vault counts as one device. To free a seat — say you're retiring a machine — open **Settings → General → License** and click **Deactivate this device**. You can also manage every device from your account page. If you hit the device limit, the License section links you straight to device management.

### Does Prisma Calendar collect any data from my vault?

**No.** Prisma Calendar does not include any client-side telemetry or analytics. No vault content, file names, note content, or personal data from your Obsidian vault is ever transmitted. Your data is 100% yours and stays local.

### What data is collected for Pro license verification?

Server-side telemetry is collected **exclusively** during license verification requests. When the plugin contacts the license server, only the following data is transmitted: license key, plugin version, Obsidian version, operating system/platform, device identifier (a locally generated unique ID), and device name. This data is used solely for license validation, activation seat management (up to 5 devices), compatibility monitoring, and abuse prevention. **If you only use the free features, no telemetry data is collected at all.**

For full details, see the [Privacy Policy](https://matejvavroproductivity.com/privacy/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=content&utm_content=free-vs-pro-privacy), [Terms of Service](https://matejvavroproductivity.com/terms/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=content&utm_content=free-vs-pro-terms), and [Legal Notice](https://matejvavroproductivity.com/legal/?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=content&utm_content=free-vs-pro-legal).
