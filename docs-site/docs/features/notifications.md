# Notifications

Desktop alerts before events start with rich modal interface, flexible timing, per-event overrides, snooze functionality, and automatic duplicate prevention.

---

## Basic Setup

**Enable**: Settings → Prisma Calendar → [Calendar] → Notifications (enabled by default)

**Timed Events**: Set default minutes before (0 = at start, 15 = 15 min before, 60 = 1 hour before)

**All-Day Events**: Set default days before (0 = day of event, 1 = day before, 7 = week before)

---

## Per-Event Customization

Override defaults with `Minutes Before` (timed) or `Days Before` (all-day) in frontmatter:

```yaml
Minutes Before: 30  # Timed event: notify 30 min before
Days Before: 3      # All-day: notify 3 days before
```

Disable for specific events by omitting the property, setting to empty, or using `Already Notified: true`.

---

## How Notifications Work

System notification appears with event title and time. Modal opens showing timing info, event details, properties, and action buttons (Open Event, Snooze, Dismiss). `Already Notified` property is automatically set to `true` in frontmatter.

![Notification Modal](/img/notification_modal.png)

*Rich notification modal with event details, snooze functionality, and quick actions*

---

## Snooze Functionality

**Available**: Timed events only (not all-day)

Postpones notification for configurable duration (default: 15 min, range: 1-120). Resets `Already Notified` to `false`, recalculates `Minutes Before`, and re-indexes file. Works for both future and past events with smart calculation.

**Configure**: Settings → Prisma Calendar → [Calendar] → Notifications → Snooze duration

For complete notification settings reference, see [Configuration](../configuration.md#notifications-settings).

## Frontmatter Properties

```yaml
Minutes Before: 30        # Timed events (supports decimals)
Days Before: 1            # All-day events
Already Notified: false   # Auto-managed tracking
```

## Related Features

- [Event Previews](./event-previews) - Rich hover and modal previews
- [Filtering](./filtering) - Filter which events appear
