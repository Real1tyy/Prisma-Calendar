# Timeline

import useBaseUrl from "@docusaurus/useBaseUrl";

A horizontal timeline showing all your events as points on a scrollable, zoomable axis. Great for getting a bird's-eye view of your schedule across days, weeks, or months.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/TimelineView.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/TimelineView.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## Toolbar

The toolbar above the timeline contains filtering controls on the left and navigation on the right.

### Filtering and Search

The timeline toolbar includes the same filter bar available in all views — filter preset dropdown, expression filter, and search bar. Filtering is applied in real time as you type. See [Rules & Filters](../organization/filtering.md) for details on filtering syntax and presets.

### Navigation

- **Year / Month / Day inputs**: Type a date and press **Enter** or click **Go** to jump directly to that date.
- **Today button**: Instantly centers the timeline on the current date and updates the input fields.
- **Pan**: Click and drag the timeline horizontally to move forward or backward in time.
- **Zoom**: Scroll up/down to zoom in (minimum 1 day) or out (maximum 10 years).

The default view shows a one-week window centered on today.

## Event Rendering

Each event appears as a colored range on the timeline:

- **Color**: Uses the event's resolved category color (from color rules or integration color).
- **Text color**: Automatically picks the primary or alternative text color based on contrast with the event's background — same logic as the calendar view.
- **All-day events**: Rendered as 4-hour blocks.
- **Stacking**: Events that overlap in time stack vertically so nothing is hidden.
- **Tooltips**: Hover over an event to see its full details — title, dates, times, and categories.
- **Visual indicators**: Skipped events and all-day events have distinct styling so you can tell them apart at a glance.

Click any event to open its **Event Preview Modal**.

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/TimelineViewForEvents.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/TimelineViewForEvents.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

## On-Demand Loading

The timeline only loads events for the time range you're currently viewing (plus a small buffer ahead and behind). As you pan or zoom, new events are fetched automatically. Ranges that have already been loaded are cached, so scrolling back to a previously visited area is instant.

This means the timeline opens fast regardless of how many events are in your vault — it never loads everything at once.

## Live Updates

The timeline updates automatically when events change — new events appear, deleted events disappear, and edits are reflected instantly.

## Command

Use **Show all events timeline** (`Prisma Calendar: Show all events timeline`) to switch directly to the Timeline tab from anywhere.

The Timeline is also available as a toolbar button (enabled by default).
