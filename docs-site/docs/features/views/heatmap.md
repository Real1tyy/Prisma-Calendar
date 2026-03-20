---
sidebar_label: Heat Map
---

# Heat Map (Pro)

:::info Pro Feature
The Heat Map tab requires [Prisma Calendar Pro](../free-vs-pro.md).
:::

A GitHub-style contribution heatmap showing event density over time. The heatmap is centered in the view. The "Show all events heatmap" command navigates directly to this tab. The tab uses a two-row layout:

- **Top row**: The heatmap visualization with yearly/monthly mode toggle and navigation controls.
- **Bottom row**: Appears when you click a day cell, showing all events for that day with times and frontmatter properties. Each event row is tinted with its resolved color (from color rules or integration color) so you can visually identify categories at a glance.
- **Keyboard navigation**: Use **Left/Right arrow keys** to navigate between years (yearly mode) or months (monthly mode). Works immediately when the tab is active — no click needed.

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/HeatmapView.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/HeatmapView.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

### Events Modal Heatmap

The heatmap is also available inside the events modal, giving you a quick density overview without leaving the event view.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/HeatmapViewForEvents.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/HeatmapViewForEvents.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>
