# Tabbed Views

import useBaseUrl from "@docusaurus/useBaseUrl";

The calendar view features a tab bar in the view header with eight tabs. Each tab provides a different perspective on your calendar data. Tabs render lazily — content loads only when you switch to a tab for the first time.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/LandingPageUnifiedViews.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/LandingPageUnifiedViews.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/TabbedViewsManagement.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/TabbedViewsManagement.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## Calendar

The default tab. Shows the full Prisma Calendar with all views (month, week, day, list), toolbar buttons, filters, batch selection, and keyboard shortcuts — exactly as before.

## [Timeline](./timeline.md)

Displays all events on a horizontal vis-timeline. Navigate by date, pan and zoom directly.

## [Heatmap](./heatmap.md) (Pro)

A GitHub-style contribution heatmap showing event density over time.

## [Daily + Stats](./daily-stats.md)

A two-column resizable layout with a daily calendar on the left and live statistics on the right.

## [Monthly + Stats](./monthly-calendar-stats.md)

A two-column resizable layout pairing a month-locked calendar on the left with monthly statistics on the right. The monthly analogue of Daily + Stats.

## [Heatmap Monthly + Stats](./heatmap-monthly-stats.md) (Pro)

A two-column resizable layout pairing a month-locked heatmap on the left with a monthly pie chart and breakdown table on the right. Hidden by default in favor of Monthly + Stats; restore via the tab manager.

## [Dual Daily](./dual-daily.md)

Two independent daily calendars side by side for comparing days or dragging events between dates.

## [Dashboard](./dashboard.md) (Pro)

A group tab with three subtabs — By Name, By Category, and Recurring — with pie charts, summary stats, rankings, and sortable tables.

## [Gantt](./gantt.md) (Pro)

A Gantt chart showing events as horizontal bars with dependency arrows between prerequisite pairs.

## Managing Tabs

- **Switch tabs** by clicking a tab in the header bar, or use the `Prisma Calendar: Go to tab` commands.
- **Reorder tabs** by right-clicking a tab and selecting Move left/right, or use the settings gear to open the tab manager.
- **Hide/show tabs** via the tab manager (gear icon) or right-click context menu.
- **Edit tabs** via the tab manager — click the pencil icon on any row to expand an inline edit form where you can change the tab's **name**, **icon**, **icon color**, and **text color**. Icon color tints the icon; text color tints the label. Each has its own reset button that restores the default. This is the same edit form used by header actions and context menu items, and it applies to **subgroup tabs** too — expand a group and edit any child the same way.
- **Reset to defaults** via the **Reset to defaults** button at the top of the tab manager, sitting next to the "Show settings button" toggle. The button shows a confirmation dialog before clearing your custom tab order, visibility, names, icons, and colors.

Tab state — active tab, visibility, order, custom names, icon overrides, icon-color overrides, and text-color overrides — persists across sessions.

## Tab Icons and colors

Tabs support optional icons shown to the left of the label. When an icon is provided, a small inline icon renders before the tab name. Tabs without icons display label text only — the icon is always optional and never required.

You can tint the **icon** and the **label text** independently from the edit form: set an *icon color* to recolor just the glyph, and a *text color* to recolor just the label. Both are optional and apply to top-level tabs, subgroup children, header actions, and context menu items alike.

Context menu items and header actions also support optional icons. When editing an icon via the item manager or action manager, a **visual icon picker** opens showing all available icons as a rendered grid — click any icon to apply it, or click **No icon** to remove it. Choosing **No icon** in the tab manager genuinely clears the icon (the tab shows label text only); the reset button is what restores the original default icon.
