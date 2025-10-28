# Notifications

Prisma Calendar includes a comprehensive notification system that alerts you before events start, helping you stay on top of your schedule. The system integrates seamlessly with your vault indexing and supports flexible per-event customization.

---

## Overview

The notification system provides:

- **Desktop notifications** with event details
- **Rich modal interface** showing complete event information
- **Flexible timing** with separate settings for timed events and all-day events
- **Per-event overrides** via frontmatter properties
- **Snooze functionality** for timed events
- **Automatic tracking** to prevent duplicate notifications

---

## Basic Setup

### Enabling Notifications

Notifications are **enabled by default**. To toggle them:

1. Go to **Settings → Prisma Calendar → [Your Calendar] → Notifications**
2. Toggle **Enable notifications**
3. When enabled, you'll be prompted for notification permissions if needed

### Default Notification Times

Configure default notification times for your events:

#### Timed Events (with specific start/end times)

- **Default minutes before**: How many minutes before the event to notify
- **Examples**:
  - `0` = Notify when event starts
  - `15` = Notify 15 minutes before event
  - `60` = Notify 1 hour before event
- Leave empty for no default notification

#### All-Day Events (date-only events)

- **Default days before**: How many days before the event to notify
- **Examples**:
  - `0` = Notify on the day of the event (at midnight)
  - `1` = Notify 1 day before (at midnight)
  - `7` = Notify 1 week before
- Leave empty for no default notification

---

## Per-Event Customization

### Override Default Times

Each event can override the calendar's default notification time using frontmatter properties:

#### Timed Events

```yaml
---
Title: Important Meeting
Start Date: 2025-02-15T14:00
End Date: 2025-02-15T15:00
Minutes Before: 30  # Override: notify 30 minutes before
---
```

#### All-Day Events

```yaml
---
Title: Project Deadline
Date: 2025-03-01
All Day: true
Days Before: 3  # Override: notify 3 days before
---
```

### Disable Notifications for Specific Events

To disable notifications for a single event, you can either:

1. **Don't set the property**: If no default is configured, the event won't trigger notifications
2. **Set to empty/null**: Remove the `Minutes Before` or `Days Before` property
3. **Mark as already notified**: Set `Already Notified: true` to prevent future notifications

---

## How Notifications Work

### Notification Timing

When an event enters the notification window:

1. **System notification** appears with event title and time
2. **Notification modal** opens showing:
   - Event title and timing information
   - Start date/time
   - File path (clickable)
   - Event properties
   - Action buttons
3. **Already Notified property** is automatically set to `true` in frontmatter
4. Event is removed from the notification queue

### Notification Modal

The modal provides rich event information:

- **Timing Info**: Shows how soon the event is ("In 15 minutes → at 2:00 PM")
- **Event Details**: Start time, file location
- **Event Properties**: All configured display properties
- **Additional Properties**: Other frontmatter properties
- **Action Buttons**:
  - **Open Event**: Opens the event file
  - **Snooze**: Postpones notification (timed events only)
  - **Dismiss**: Closes the notification

---

## Snooze Functionality

### What is Snooze?

Snooze postpones a notification for a configurable duration. The notification will re-appear after the snooze period.

### Availability

- ✅ **Available**: Timed events (events with specific start/end times)
- ❌ **Not Available**: All-day events

### How Snooze Works

When you press the Snooze button:

1. The `Already Notified` property is reset to `false`
2. The `Minutes Before` value is recalculated so the notification triggers exactly X minutes from now
3. The file is automatically re-indexed
4. The notification will appear again after the snooze duration

### Smart Calculation

The snooze system uses intelligent calculation to ensure notifications always appear at the right time:

**Example Scenario:**
- Event starts at **08:30**
- Current time is **11:00** (event already started 2.5 hours ago)
- You press **Snooze** (15-minute default)

**What Happens:**
```
Original Minutes Before: -44 (doesn't matter, recalculated)
Calculation: Set notification for (current time + 15 minutes)
New Minutes Before: -165
Result: Notification at 11:15 (exactly 15 minutes from now)
```

This works for both:
- **Future events**: Adjusts relative to event start time
- **Past events**: Calculates from current time, allowing snooze to work even for events that have already started

### Configuring Snooze Duration

1. Go to **Settings → Prisma Calendar → [Your Calendar] → Notifications**
2. Find **Snooze duration (minutes)**
3. Set your preferred duration (default: 15 minutes, range: 1-120)

---

## Notification Settings Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| **Enable notifications** | Toggle | `true` | Master switch for all notifications |
| **Default minutes before** | Number | `(empty)` | Default notification time for timed events (minutes) |
| **Minutes before property** | Text | `Minutes Before` | Frontmatter property name for per-event timed notification overrides |
| **Default days before** | Number | `(empty)` | Default notification time for all-day events (days) |
| **Days before property** | Text | `Days Before` | Frontmatter property name for per-event all-day notification overrides |
| **Play notification sound** | Toggle | `false` | Whether to play system sound with notifications |
| **Snooze duration** | Slider | `15` | How many minutes to snooze notifications (1-120) |
| **Already notified property** | Text | `Already Notified` | Frontmatter property used to track notification status |

---

## Notification Properties

### Frontmatter Properties

The notification system uses these frontmatter properties:

```yaml
---
# Notification timing (per-event overrides)
Minutes Before: 30        # For timed events
Days Before: 1            # For all-day events

# Notification tracking (automatically managed)
Already Notified: false   # Set to true after notification shows
---
```

### Property Behavior

- **Minutes Before** / **Days Before**:
  - Can be positive (before event) or negative (after event start)
  - Decimals are supported for precise timing (e.g., `15.5` minutes)
  - Overrides calendar default when present

- **Already Notified**:
  - Automatically set to `true` when notification is triggered
  - Prevents duplicate notifications
  - Reset to `false` when you snooze
  - Can be manually reset to `false` to get notified again

---

## Use Cases

### Meeting Reminders

```yaml
---
Title: Team Standup
Start Date: 2025-02-15T09:00
Minutes Before: 10  # 10-minute warning
---
```

### Important Deadlines

```yaml
---
Title: Project Proposal Due
Date: 2025-03-01
All Day: true
Days Before: 3  # 3-day advance notice
---
```

### Last-Minute Events

```yaml
---
Title: Quick Call
Start Date: 2025-02-15T14:30
Minutes Before: 0  # Notify right when it starts
---
```

### Multi-Stage Reminders

For important events, create multiple entries:

```yaml
---
Title: Important Presentation - 1 Week Warning
Date: 2025-03-15
Days Before: 7
---

---
Title: Important Presentation - Final Reminder
Start Date: 2025-03-15T10:00
Minutes Before: 60
---
```

---

## Best Practices

### Default Configuration

1. **Set sensible defaults**: Configure `Default minutes before` and `Default days before` that work for most of your events
2. **Don't over-notify**: Start conservative (e.g., 15 minutes for meetings, 1 day for all-day events)
3. **Adjust as needed**: Fine-tune based on your workflow

### Per-Event Overrides

1. **Use for exceptions**: Only override when an event needs different timing
2. **Important events**: Use longer notification times for critical meetings/deadlines
3. **Routine events**: Let defaults handle regular events

### Notification Management

1. **Use snooze wisely**: Great for "almost ready" situations
2. **Clear old notifications**: Delete or mark as done after events pass
3. **Test your setup**: Create a test event 5 minutes in the future to verify notifications work

### Performance

1. **Reasonable notification counts**: Avoid setting hundreds of notifications at once
2. **Clean up past events**: Archive or delete old events to reduce indexing load
3. **Notification queue**: The system maintains a sorted queue, checking every minute

---

## Troubleshooting

### Notifications Not Appearing

1. **Check browser/system permissions**: Ensure notifications are allowed
2. **Verify notifications are enabled**: Check Settings → Notifications → Enable notifications
3. **Check notification properties**: Ensure `Minutes Before` or `Days Before` is set
4. **Check "Already Notified"**: If `true`, the event won't notify again (reset to `false` to re-enable)
5. **Verify event timing**: Past events (end time before now) don't generate notifications

### Duplicate Notifications

1. **Check "Already Notified" property**: Should be automatically set to `true` after notification
2. **Multiple calendar issue**: Ensure event isn't indexed by multiple calendars
3. **File system issues**: Rare, but file watcher might trigger duplicate indexing

### Snooze Not Working

1. **All-day event**: Snooze is only available for timed events
2. **Check Minutes Before value**: After snooze, this should be negative if event has started
3. **File write permissions**: Ensure the plugin can write to your vault

### Wrong Notification Time

1. **Verify timezone**: Check Settings → General for timezone override
2. **Check property values**: Ensure `Minutes Before` / `Days Before` are numbers, not strings
3. **Decimal precision**: Remember decimals are supported (e.g., `-180.23` is valid)

---

## Technical Details

### How It Works

1. **Indexer Integration**: The notification manager subscribes to file changes from the vault indexer
2. **Notification Queue**: Maintains a sorted array of pending notifications by time
3. **Periodic Checking**: Checks queue every minute for notifications to trigger
4. **Smart Calculation**: Uses precise millisecond timing for accurate notifications
5. **Frontmatter Updates**: Uses Obsidian's `processFrontMatter` API for reliable property updates

### Notification Lifecycle

```
1. File indexed → 2. Calculate notification time → 3. Add to queue
                                                          ↓
4. Check queue (every minute) ← 5. Notification time reached?
                                          ↓ YES
6. Trigger notification → 7. Mark as notified → 8. Remove from queue
          ↓ (if snoozed)
9. Reset "Already Notified" → 10. Recalculate timing → Back to queue
```

### Decimal Support

The system fully supports decimal values for `Minutes Before`:

```yaml
Minutes Before: -180.2332  # 3 hours + 14 seconds after event start
```

This is particularly useful for snooze calculations, where precise timing is automatically calculated.

---

## Related Features

- **[Event Previews](./event-previews)**: Rich hover and modal previews for events
- **[Filtering](./filtering)**: Filter which events appear in your calendar
- **[Configuration](../configuration)**: Complete settings reference
