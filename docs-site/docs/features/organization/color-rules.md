# Color Rules

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
    <source src={useBaseUrl("/video/ColourRules.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Make events visually meaningful by mapping frontmatter to colors.

## How it works

- Set a Default event color as a fallback
- Add Color rules that evaluate in order; the first match sets the color
- Reference frontmatter properties directly by name

Examples:

```text
Priority === 'High'         → #ef4444
Status === 'Done'           → #22c55e
Project === 'Work'          → hsl(210,70%,50%)
Type === 'Meeting'          → #f59e0b
```

## Real use cases

- Status pipeline: `Todo` (gray), `In Progress` (blue), `Blocked` (orange), `Done` (green)
- Contexts: `Work` vs `Personal` vs `Health` colors
- Risk highlighting: `High` priority in red

## Advanced Examples

```javascript
// Multiple conditions
Priority === 'High' && Status !== 'Done'         → #ef4444

// Array checks
Tags && Tags.includes('urgent')                   → #ef4444

// Numeric comparisons
Difficulty >= 8                                   → #f59e0b

// Nested conditions
Status === 'Active' && (Priority === 'High' || DueDate < new Date())  → #3b82f6
```

## Multi-Color Events & Overflow Color Dots

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/MultiColorEventsAndColorDots.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/MultiColorEventsAndColorDots.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## Color Mode

By default, only the first matching color rule is applied to each event. The **Color mode** setting (Settings → Rules → Event colors) lets you apply multiple colors:

- **Don't color events** — no color rules are applied; events use the default color
- **Color events** — single color from the first match (default behavior)
- **Color events with two colors** — the event is split into two equal halves, each colored by the first two matching rules
- **Color events with three colors** — three equal segments
- **Color events with four colors** — four equal segments
- **Color events with five colors** — five equal segments (maximum)

If fewer rules match than the selected mode allows, only the matched colors are shown.

## Overflow Color Dots

When **Show overflow color dots** is enabled (Settings → Rules → Event colors), any matched color rules that were not applied as the event background are displayed as small color dots in the bottom-right corner of the event.

- If color mode is "Don't color events", all matched colors appear as dots
- If color mode is set to 1 and 3 rules match, the remaining 2 appear as dots
- If color mode is set to 3 and 5 rules match, the remaining 2 appear as dots

This lets you see at a glance which rules an event matches beyond the visible background colors.

### Multi-Color Across All Views

Multi-color gradients and overflow color dots are supported everywhere events are displayed:

- **Calendar view** — gradient background + overflow dots on event cards, plus day-cell color summary dots
- **Gantt chart** — gradient bars with overflow dots for events matching multiple color rules
- **Timeline** — gradient item backgrounds with inline color dots
- **Heatmap detail panel** — color dots on individual event rows when viewing a day's events
- **Event series modal** — color dots on event rows in the "By Name" tab

## Category Color Management

For a convenient way to manage category colors without writing expressions manually, use the **Categories Settings** section (Settings → Categories). This interface automatically detects all categories from your events, displays event counts, and provides color pickers for each category. Behind the scenes, category colors are stored as color rules using expressions like `Category.includes('Work')`.

📖 See [Categories](/features/organization/categories) for complete documentation on working with categories, including assignment, viewing, and statistics.

## Troubleshooting

- Rule order matters: put specific rules above general ones
- Expressions must be valid JavaScript; use property names directly
- Colors can be CSS names, hex (`#abc123`), or HSL (`hsl(...)`)
