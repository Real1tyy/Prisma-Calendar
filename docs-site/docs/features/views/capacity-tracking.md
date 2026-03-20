# Capacity Tracking

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/CapacityTracking.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/CapacityTracking.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

Capacity tracking shows how much of your day is filled by events versus remaining as free time. It answers the question: "How full is my calendar today/this week/this month?"

## How It Works

Capacity tracking **infers boundaries automatically** from your events. It looks at the earliest event start and latest event end in the current period to determine your active window, then calculates how much of that window is filled.

For example, if your earliest event starts at 9:00 and your latest ends at 20:00, your capacity for that day is 11 hours. If your events total 7 hours, you have 4 hours remaining (64% used).

When no timed events exist in a period, the calendar's configured day start/end hours are used as fallback boundaries.

## Where Capacity Appears

### Page Header Indicator

A compact badge in the view header shows today's capacity at a glance:

> ⏱ 7h 30m / 11h (68%)

The indicator updates automatically when events change. Hover to see the inferred time boundaries and remaining hours.

### Daily + Stats Tab

The statistics panel in the Daily + Stats tab includes a capacity label showing used vs total hours, percentage, remaining time, and the inferred time boundaries (e.g., `7:00–21:00`).

### Statistics Modals

The daily, weekly, and monthly statistics modals all include a capacity label showing used vs total hours, percentage, remaining time, and the inferred boundaries. For multi-day periods (week, month), capacity is calculated as the number of days multiplied by the inferred hours per day.

## Enabling / Disabling

Capacity tracking is enabled by default. To toggle it:

1. Open **Settings** for your calendar
2. Scroll to the **Capacity Tracking** section
3. Toggle **Enable capacity tracking** on or off

When disabled, the page header indicator and all capacity charts are hidden.

## Details

- **Only timed events count** — all-day events are excluded from the used-time calculation
- **Break time is subtracted** — if an event has break minutes configured, that time is not counted as used
- **Over-capacity is handled** — if your events exceed the inferred capacity (e.g., overlapping events), remaining time shows as 0 and percentage caps at 100%
- **Multi-day periods** — for weekly and monthly views, capacity = (number of days) × (hours per day based on inferred boundaries)
