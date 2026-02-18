# Calendar Settings (UI)

These settings control the calendar's view modes, time display, visual appearance, event interaction, and overlap behavior. For a thorough walkthrough of every calendar UI element — including toolbar buttons, view modes, event text coloring, sticky headers, and more — see the dedicated [Calendar View](../features/calendar/calendar-view) page.

## View Configuration

- **Default view**: set initial calendar view (dayGridMonth, timeGridWeek, timeGridDay, listWeek)
- **Default mobile view**: set initial calendar view for mobile devices (screen width ≤ 768px). Independent from desktop default view (dayGridMonth, timeGridWeek, timeGridDay, listWeek)
- **Hide weekends**: toggle Saturday/Sunday visibility
- **First day of week**: choose locale preference (0 = Sunday, 1 = Monday, etc.)

## Time Display

- **Day start / end hour**: visible time range in grids (default: 7–23)
- **Slot duration (minutes)**: grid slot height (default: 30 minutes, range: 1–60)
- **Snap duration (minutes)**: drag/resize snapping interval (default: 30 minutes, range: 1–60)
- **Drag edge scroll delay (ms)**: delay in milliseconds before scrolling when dragging events near the edge (default: 600ms, range: 50–2000)
- **Zoom levels (minutes)**: comma-separated list for CTRL+scroll zoom (default: `1, 2, 3, 5, 10, 15, 20, 30, 45, 60`)

## Visual Appearance

- **Display density**: `comfortable` or `compact` (default: `comfortable`)
- **All-day event height**: maximum height for all-day events before scrolling (30–500px, default: 75px)
- **Past event contrast**: visual contrast of past events (0%–100%, default: 70%)
- **Show color dots**: color indicator dots in monthly view (enabled by default)
- **Thicker hour lines**: bolder full-hour lines in day/week views (enabled by default)
- **Show duration in event title**: appends duration after event title (enabled by default)
- **Default event text color**: text color for events with dark backgrounds (default: white)
- **Alternative event text color**: text color for events with light backgrounds (default: black). See [Calendar View → Event Text Coloring](../features/calendar/calendar-view#event-text-coloring) for details.
- **Sticky day headers**: pin day/date headers when scrolling in day/week views (enabled by default)
- **Sticky all-day events**: pin all-day section when scrolling in day/week views (enabled by default)

## Event Interaction

- **Enable event preview**: hover previews inside the calendar (enabled by default)
- **Show current time indicator**: time line in day/week views (enabled by default)
- **Highlight upcoming event**: subtly highlight events that are currently active (if any), or the next upcoming event. Only visible when the current time is within the visible date range (enabled by default)
- **Skip underscore properties**: hide properties starting with `_` from event previews and edit modals (enabled by default)

## Event Overlap

- **Allow event overlap**: whether events can visually overlap in all views. When disabled, overlapping events display side-by-side in columns (default: enabled)
- **Allow slot event overlap**: whether events can overlap within the same time slot in time grid views (default: enabled)
- **Event stack limit**: maximum events to stack before "+more" link (1–10, default: 1)
- **Desktop max events per day**: maximum events per day on desktop before "+more" (0–10, 0 = unlimited, default: 0)
- **Mobile max events per day**: maximum events per day on mobile before "+more" (0–10, default: 4)
