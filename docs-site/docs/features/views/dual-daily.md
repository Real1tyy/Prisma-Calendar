---
sidebar_label: Dual Daily
---

import useBaseUrl from "@docusaurus/useBaseUrl";

# Dual Daily

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/DualDailyView.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/DualDailyView.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

A two-column resizable layout with two independent daily calendars side by side. Each calendar has its own toolbar, search filter, and date state — useful for comparing two different days or dragging events between dates.

- **Independent navigation**: Each calendar navigates independently via its own prev/next/today buttons.
- **Keyboard navigation**: Use **Left/Right arrow keys** to navigate the focused calendar. Click anywhere on a calendar to focus it, then arrow keys will move that calendar's date forward or backward. Defaults to the left calendar.
- **Full calendar features**: Both calendars support the same interactions as the Daily + Stats calendar — event rendering, colors, icons, context menus, drag-and-drop, click-to-open, hover preview, and date/time selection.
- **Resizable**: Drag the divider between columns to adjust the split.
