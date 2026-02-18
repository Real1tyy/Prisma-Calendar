# Notifications Settings

Configure desktop notifications and alerts for upcoming events.

## General

- **Enable notifications**: turn on desktop notifications for events (enabled by default)
- **Notification sound**: play sound when notifications appear (disabled by default)
- **Skip newly created events**: automatically mark events as notified if they were created within the last minute. Prevents notification spam when creating events via Create Event, Stopwatch, or other creation methods (enabled by default)

## Timing

- **Default minutes before** (timed events): minutes before timed events to notify (optional, leave empty for no default notification. 0 = notify when event starts, 15 = notify 15 minutes before)
- **Default days before** (all-day events): days before all-day events to notify (optional, leave empty for no default notification. 0 = notify on the day of the event, 1 = notify 1 day before)
- **Snooze duration (minutes)**: how many minutes to snooze notifications when pressing the Snooze button (default: 15 minutes, range: 1–200)

## Property Names

Notification property names are configured in the [Properties](./properties#notification-property-names) settings tab:

- **Minutes before property** (default: `Minutes Before`)
- **Days before property** (default: `Days Before`)
- **Already notified property** (default: `Already Notified`)

## Per-Event Overrides

Each event can specify its own notification timing via frontmatter:

```yaml
---
Title: Important Meeting
Start Date: 2025-01-15T14:00
Minutes Before: 30  # Notify 30 minutes before this event
---
```

For all-day events:

```yaml
---
Title: Birthday
Date: 2025-01-15
Days Before: 1  # Notify 1 day before this all-day event
---
```
