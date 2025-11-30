# Integrations

Export and import events using the ICS format for compatibility with external calendar applications.

## Overview

Prisma Calendar stores all event times internally in **UTC**. When exporting or importing events, you select a timezone for conversion. This ensures events display correctly in any calendar application regardless of your local timezone.

### Supported Applications

Exported ICS files work with:
- **Google Calendar**
- **Apple Calendar (iCal)**
- **Microsoft Outlook**
- **Nextcloud Calendar**
- **Thunderbird**
- Any application supporting the ICS/iCalendar format

## Exporting Events

### How to Export

1. Open the command palette (`Ctrl/Cmd + P`)
2. Run **"Prisma Calendar: Export calendar as ICS"**
3. Select export options in the modal:
   - **Calendar**: Choose which calendar to export
   - **Timezone**: Select the timezone for exported events
   - **Exclude skipped events**: Toggle to include/exclude skipped events

![Export Modal](/img/export_modal.png)

### Timezone Selection

Events are stored in UTC but displayed in your selected timezone:

| Timezone | Offset | Region |
|----------|--------|--------|
| UTC | +0 | Universal |
| Europe/London | UTC | United Kingdom |
| Europe/Paris | UTC+1 | France, Belgium |
| Europe/Prague | UTC+1 | Czech Republic |
| America/New_York | UTC-5 | US Eastern |
| America/Los_Angeles | UTC-8 | US Pacific |
| Asia/Tokyo | UTC+9 | Japan |

### Exported Data

Each event includes:

| Field | Source | Description |
|-------|--------|-------------|
| **UID** | File path | Unique identifier for idempotent imports |
| **SUMMARY** | Event title | Title without Zettel ID prefix |
| **DTSTART/DTEND** | Start/End Date | Event timing |
| **DESCRIPTION** | Note content | Full markdown content of the note |
| **CATEGORIES** | Category property | Event categories |
| **VALARM** | Minutes Before | Notification reminders |
| **URL** | Obsidian URI | Link back to the original note |

### Custom Properties

Exported ICS files include Prisma-specific metadata:

```
X-PRISMA-FILE: Events/Meeting-20250115.md
X-PRISMA-VAULT: MyVault
X-PRISMA-EVENT-ID: event-id-123
URL: obsidian://open?vault=MyVault&file=Events%2FMeeting-20250115
```

These properties enable:
- Linking back to original Obsidian notes
- Identifying which vault the event belongs to
- Maintaining idempotency on re-import

### Output Location

Exported files are saved to `Prisma-Exports/` folder in your vault:

```
Prisma-Exports/
├── my-calendar-export-2025-01-15-14-30-00.ics
├── work-calendar-export-2025-01-16-09-00-00.ics
└── ...
```

## Importing Events

### How to Import

1. Open the command palette (`Ctrl/Cmd + P`)
2. Run **"Prisma Calendar: Import ICS file"**
3. Select the ICS file to import
4. Choose the destination calendar
5. Preview events before importing
6. Click "Import" to create notes

### Import Process

For each imported event, Prisma Calendar:

1. Creates a new markdown note in the calendar's folder
2. Generates a Zettel ID timestamp for the filename
3. Populates frontmatter with event properties:
   - Start/End dates
   - All-day flag
   - Categories (if present)
   - Notification settings (if VALARM present)
4. Adds event description as note content

### Imported Frontmatter

```yaml
---
Title: Weekly Team Standup
Start Date: 2025-01-15T09:00:00Z
End Date: 2025-01-15T09:30:00Z
Category: Work, Meetings
Minutes Before: 15
---

Meeting agenda and notes imported from external calendar...
```

## Skipped Events

### What Are Skipped Events?

Skipped events are hidden from the calendar view but remain in your vault. They're useful for:
- Cancelling individual instances of recurring events
- Temporarily hiding events without deleting
- Tracking planned vs actual activity

See [Event Skipping](./event-skipping.md) for more details.

### Skipped Events in Export

By default, skipped events are **excluded** from exports. This means:

- ✅ Active events are exported
- ❌ Skipped events are hidden from the export

To include skipped events, uncheck **"Exclude skipped events"** in the export modal.

## Timezone Handling

### Internal Storage (UTC)

All events in Prisma Calendar are stored in UTC:

```yaml
Start Date: 2025-01-15T14:00:00Z  # Z indicates UTC
End Date: 2025-01-15T15:00:00Z
```

### Export Conversion

When exporting with timezone `Europe/Prague (UTC+1)`:
- The event displays as `15:00-16:00` in Prague time
- ICS file includes: `X-WR-TIMEZONE:Europe/Prague`

### Import Conversion

When importing events:
- Times are converted from the source timezone to UTC
- Stored in frontmatter as UTC timestamps

## Troubleshooting

### Events Show Wrong Time

**Cause:** Timezone mismatch between export and import.

**Solution:**
1. Check which timezone was used for export
2. Ensure importing application uses the same timezone
3. For UTC storage, times should end with `Z`

### Missing Events in Export

**Cause:** Events may be marked as skipped.

**Solution:**
1. Uncheck "Exclude skipped events" to include them
2. Or un-skip events before exporting via the skipped events modal

## Related Features

- [Event Skipping](./event-skipping.md) - Hide events without deleting
- [Multiple Calendars](./multiple-calendars.md) - Manage separate calendars
- [Notifications](./notifications.md) - Configure event reminders
