# Configuration

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/SettingConfig.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>
*Prisma Calendar settings with tabs for General, Properties, Calendar, Event Groups, Configuration, Notifications, Rules, Categories, Bases, and Integrations*

## Settings Search

A search input sits to the right of the section tabs (General, Properties, Calendar, etc.). Type a keyword to filter settings across **all sections** at once — only matching settings and their headings are shown. This is useful when you know the name of a setting but not which tab it's under.

- **Debounced**: filters automatically after a short delay (300ms) while typing
- **Enter**: applies the filter immediately
- **Clear**: remove the search text or click any tab to return to normal tabbed navigation

## Calendar Management

- Add, clone, or delete calendars from Settings → Prisma Calendar
- Each calendar is isolated: its own directory, filters, colors, and UI options
- Maximum calendars: 10 (configurable limit in code, UI will disable buttons at the max)

### Active Calendar

Pick the calendar you want to configure. Actions like Clone Current and Delete Current affect the active calendar only.

### Create / Clone / Delete

- Create New: generates a unique ID and default name (e.g., "Calendar 2") with sensible defaults
- Clone Current: duplicates the entire configuration to a new calendar (ID and name change)
- Delete Current: removes the calendar and re-selects the next available one (at least one calendar must remain)

---

## Settings Sections

### [General](./general)
Calendar directory, parsing options, time tracker, statistics display, read-only mode, event presets, and break time for statistics.

### [Properties](./properties)
Core event properties, sorting normalization, identification & tracking, notification property names, recurring event properties, frontmatter display, and auto-mark past events.

### [Calendar UI](./calendar-ui)
View configuration, time display, visual appearance, event interaction, and event overlap.

### [Toolbar & Menus](./toolbar-and-menus)
Desktop and mobile toolbar button visibility, batch selection action buttons, context menu item toggles, and performance settings.

### [Notifications](./notifications)
Desktop notification settings, skip newly created events, timing defaults, snooze, and per-event overrides.

### [Rules](./rules)
Event color rules, expression-based filtering, untracked event filtering, filter presets, category color management, and auto-assign categories.

### [Bases](./bases)
Default view type, additional property columns, and where Bases views are used throughout the plugin.

### [Event Groups](./event-groups)
Recurring instance generation horizon, event markers, and frontmatter propagation for recurring, name, and category series.

### [Integrations](./integrations)
ICS export/import, CalDAV two-way sync, ICS URL subscriptions, and public holiday display.
