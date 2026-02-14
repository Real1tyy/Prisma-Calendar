# Integrations

Sync with external calendars or exchange events using standard calendar formats.

## Overview

Prisma Calendar offers three integration methods:

1. **CalDAV Sync** - Automatic read-only synchronization from CalDAV servers (Fastmail, Nextcloud, iCloud) to Obsidian
2. **ICS URL Subscriptions** - Automatic read-only synchronization from public ICS URLs (Outlook, Google public links) to Obsidian
3. **ICS Import/Export** - Manual exchange of event files with any calendar application

**ICS Format**: Prisma Calendar stores all event times internally in **UTC**. When exporting or importing, you select a timezone for conversion. This ensures events display correctly in any calendar application.

**Compatible with**: Google Calendar, Apple Calendar (iCal), Microsoft Outlook, Nextcloud Calendar, Thunderbird, and any application supporting ICS/iCalendar format.

## Exporting Events

### How to Export

1. Open command palette (`Ctrl/Cmd + P`)
2. Run **"Prisma Calendar: Export calendar as ICS"**
3. Select export options:
   - **Calendar**: Choose which calendar to export
   - **Timezone**: Select timezone for exported events
   - **Exclude skipped events**: Toggle to include/exclude [skipped events](./event-skipping)

![Export Modal](/img/integrations_export.png)

### Exported Data

Each event includes:

| Field | Description |
|-------|-------------|
| **UID** | Unique identifier for idempotent imports |
| **SUMMARY** | Event title without Zettel ID |
| **DTSTART/DTEND** | Event timing |
| **DESCRIPTION** | Full markdown content |
| **LOCATION** | Event location (if set) |
| **ATTENDEE** | Event participants (if set) with `mailto:` URIs and common name (CN) |
| **CATEGORIES** | Event categories |
| **VALARM** | Notification reminders |
| **URL** | Obsidian URI link back to note |

**Custom Properties**: Prisma-specific metadata (X-PRISMA-FILE, X-PRISMA-VAULT, X-PRISMA-EVENT-ID) enables linking back to original notes and maintaining idempotency on re-import.

**Location and Participants**: Location is exported as the standard ICS `LOCATION` field. Participants are exported as multiple `ATTENDEE` fields with proper RFC 5545 formatting (e.g., `ATTENDEE;CN=Alice;ROLE=REQ-PARTICIPANT:mailto:Alice`). This ensures full compatibility with Google Calendar, Outlook, Apple Calendar, and other standards-compliant calendar applications.

**Output Location**: Exported files saved to `Prisma-Exports/` folder in your vault.

## Importing Events

### How to Import

1. Open command palette (`Ctrl/Cmd + P`)
2. Run **"Prisma Calendar: Import ICS file"**
3. Select the ICS file to import
4. Choose destination calendar
5. Select timezone for conversion
6. Click "Import" to create notes

![Import Modal](/img/integrations_import.png)

### Import Process

For each imported event, Prisma Calendar:

1. Creates a new markdown note in the calendar's folder
2. Generates a [Zettel ID](./zettelid-naming) timestamp for the filename
3. Populates frontmatter:
   - Start/End dates
   - All-day flag
   - Location (from `LOCATION` field)
   - Participants (from `ATTENDEE` fields, extracting common names or email addresses)
   - Categories (from `CATEGORIES` field)
   - Notification settings (from `VALARM` if present)
4. Adds event description as note content

### Recurring Event Support

Recurring events defined with ICS `RRULE` properties are automatically converted to Prisma's internal recurring event system. The following recurrence patterns are supported:

| ICS RRULE | Prisma Recurrence Type |
|-----------|----------------------|
| `FREQ=DAILY` | Daily |
| `FREQ=DAILY;INTERVAL=2` | Bi-daily (every 2 days) |
| `FREQ=WEEKLY` | Weekly |
| `FREQ=WEEKLY;INTERVAL=2` | Bi-weekly |
| `FREQ=MONTHLY` | Monthly |
| `FREQ=MONTHLY;INTERVAL=2` | Bi-monthly |
| `FREQ=MONTHLY;INTERVAL=3` | Quarterly |
| `FREQ=MONTHLY;INTERVAL=6` | Semi-annual |
| `FREQ=YEARLY` | Yearly |

For weekly and bi-weekly events, `BYDAY` values (e.g., `BYDAY=MO,WE,FR`) are mapped to weekday selections. Once imported, recurring events generate instances automatically via the existing [recurring event system](./recurring-dsl).

Unsupported RRULE patterns (e.g., `INTERVAL=3` on weekly) are imported as single non-recurring events.

This applies to all import paths: manual ICS import, ICS URL subscriptions, and CalDAV sync.

**Compatibility**: Import automatically handles ICS files from Google Calendar, Outlook, Apple Calendar, Fastmail, Nextcloud, and any RFC 5545-compliant calendar application. Location and participant data is preserved during round-trip export/import.

## Timezone Handling

**Internal Storage**: All events stored in UTC (`2025-01-15T14:00:00Z`)

**Export Conversion**: When exporting with timezone `Europe/Prague (UTC+1)`, event displays as `15:00-16:00` in Prague time. ICS file includes `X-WR-TIMEZONE:Europe/Prague`

**Import Conversion**: Times converted from source timezone to UTC, stored in frontmatter as UTC timestamps

## CalDAV Integration

### Overview

CalDAV integration enables read-only synchronization from external CalDAV servers to Prisma Calendar. Connect your Fastmail, Nextcloud, iCloud, or any CalDAV-compatible calendar to automatically import events into Obsidian.

**Key Benefits**:
- Automatic one-way sync (server → Obsidian)
- Create Obsidian notes for external events
- Incremental sync using ETags for efficiency
- No manual import/export required

**Important**: CalDAV sync is currently **read-only**. Events created or modified in Obsidian are not synced back to the CalDAV server.

### Setting Up CalDAV

:::danger Security Warning
**CalDAV credentials are stored in PLAINTEXT in `.obsidian/plugins/prisma-calendar/data.json`**

- ⚠️ **Passwords are NOT encrypted**
- ⚠️ **Anyone with access to your vault can read credentials**
- ⚠️ **Synced vaults (iCloud, Dropbox, Git) expose credentials**

**Mandatory Security Practices**:
- ✅ **ALWAYS use app-specific passwords** - never your main account password
- ✅ Use a dedicated CalDAV account with limited permissions
- ✅ Enable filesystem encryption (BitLocker, FileVault, LUKS)
- ✅ Be cautious when syncing vault to cloud services
:::

#### Adding an Account

1. Open **Prisma Calendar Settings → Integrations → CalDAV**
2. Click **"Add CalDAV account"**
3. Configure account details:
   - **Account name**: Display name (e.g., "Work Calendar")
   - **Server URL**: CalDAV server endpoint
   - **Auth method**: Basic or OAuth 2.0
   - **Username**: Your account username
   - **Password**: ⚠️ **STORED IN PLAINTEXT** - Use app-specific password
   - **Timezone**: Timezone for event conversion
   - **Calendar icon** (optional): Icon/emoji to display on synced events (e.g., 📅, 🔄, ☁️)
4. Click **"Test connection"** to verify credentials
5. Click **"Save"**

![CalDAV Account Setup](/img/caldav_setup.png)

#### Selecting Calendars

After adding an account:
1. Click **"Select calendars"** for the account
2. Browse available calendars from the server
3. Check calendars you want to sync
4. Each account can sync multiple calendars to a single Prisma calendar

### Sync Configuration

Configure automatic synchronization behavior:

| Setting | Default | Description |
|---------|---------|-------------|
| **Allow auto-sync** | `true` | Enable periodic background syncing |
| **Sync on startup** | `true` | Sync when Obsidian starts |
| **Sync interval** | 15 minutes | How often to sync (1-1440 minutes) |
| **Show sync notifications** | `true` | Display sync status messages |
| **Integration event color** | Purple | Color applied to CalDAV-synced events (overrides color rules) |
| **Calendar icon** | None | Optional icon/emoji displayed on synced events to identify the source calendar |

**Manual Sync**: Use **"Sync now"** button in CalDAV settings to trigger immediate synchronization.

**Calendar Icons**: When you set an icon for a CalDAV account, it appears in the top-right corner of all events synced from that calendar. This makes it easy to visually identify which external calendar each event came from. Icons use the same marker system as recurring events and holidays.

### How CalDAV Sync Works

#### Initial Sync

1. Fetches all events from selected calendars
2. For each event:
   - Creates markdown note in calendar's folder
   - Generates [Zettel ID](./zettelid-naming) for conflict-free filename
   - Populates frontmatter with event data
   - Adds CalDAV metadata for tracking

#### Incremental Updates

On subsequent syncs:
1. **ETag comparison**: Check if server event changed
2. **If unchanged**: Skip processing (efficient)
3. **If changed**: Update frontmatter, rename file if title changed (preserve Zettel ID), update timestamps

#### Event Metadata

Synced events include CalDAV tracking in frontmatter:
- `accountId`: Which CalDAV account manages this event
- `calendarHref`: Source calendar URL
- `objectHref`: Specific event resource URL
- `etag`: Version tag for change detection
- `uid`: iCalendar unique identifier
- `lastModified`: When event was last changed on server
- `lastSyncedAt`: When Prisma last synced this event

### Visual Integration

CalDAV-synced events display with a custom color:
1. Open **Settings → Integrations → CalDAV**
2. Set **"Integration event color"** (default: purple `#8b5cf6`)
3. Calendar immediately updates all CalDAV events

**Color Priority**: CalDAV integration color overrides other [color rules](./color-rules).

### Title Changes and File Renaming

When an event title changes on the CalDAV server:
- Prisma detects title change via ETag
- Renames file with preserved [Zettel ID](./zettelid-naming)
- Updates frontmatter automatically

**Example**: `Team Meeting - 20250115140000.md` → `Weekly Standup - 20250115140000.md`

## ICS URL Subscriptions

### Overview

ICS URL subscriptions enable read-only synchronization from public ICS URLs to Prisma Calendar. Subscribe to Outlook, Google Calendar, or any service that provides a public `.ics` URL to automatically import events into Obsidian.

**Key Benefits**:
- Automatic one-way sync (URL → Obsidian)
- Create Obsidian notes for external events
- Full sync with deletions — events removed from the source are deleted locally
- No authentication needed — works with public sharing links

### Setting Up ICS Subscriptions

#### Adding a Subscription

1. Open **Prisma Calendar Settings → Integrations → ICS URL Subscriptions**
2. Click **"Add subscription"**
3. Configure subscription details:
   - **Subscription name**: Display name (e.g., "Work Calendar")
   - **ICS URL**: Public URL to the `.ics` file
   - **Sync interval**: How often to sync (1-1440 minutes, default: 60)
   - **Timezone**: Timezone for event conversion
   - **Calendar icon** (optional): Icon/emoji to display on synced events (e.g., 📅, 🔄, ☁️)
4. Click **"Test URL"** to verify the URL and preview event count
5. Click **"Add subscription"** to save

### Sync Configuration

Configure automatic synchronization behavior:

| Setting | Default | Description |
|---------|---------|-------------|
| **Allow auto-sync** | `true` | Enable periodic background syncing |
| **Sync on startup** | `true` | Sync when Obsidian starts |
| **Sync interval** | 60 minutes | How often to sync (per subscription) |
| **Show sync notifications** | `true` | Display sync status messages |
| **Integration event color** | Purple | Color applied to ICS subscription-synced events (overrides color rules) |
| **Calendar icon** | None | Optional icon/emoji displayed on synced events to identify the source calendar |

**Manual Sync**: Use **"Sync now"** button in subscription settings or run the **"Prisma Calendar: Sync ICS subscriptions"** command.

**Calendar Icons**: When you set an icon for an ICS subscription, it appears in the top-right corner of all events synced from that subscription. This makes it easy to visually identify which external calendar each event came from. Icons use the same marker system as recurring events and holidays.

### How ICS URL Sync Works

#### Sync Process

1. Fetches the ICS file from the URL
2. Parses events from the ICS content
3. For each event (identified by UID):
   - **New event**: Creates markdown note with event data and sync metadata
   - **Changed event** (lastModified differs): Updates frontmatter, renames file if title changed
   - **Unchanged event**: Skipped for efficiency
4. **Deleted events**: Events present locally but missing from the remote ICS are deleted

#### Event Metadata

Synced events include ICS subscription tracking in frontmatter:
- `subscriptionId`: Which subscription manages this event
- `uid`: iCalendar unique identifier
- `lastModified`: When event was last changed on the source
- `lastSyncedAt`: When Prisma last synced this event

### Deleting a Subscription

When deleting a subscription that has synced events, you'll be prompted to choose:
- **Delete subscription and events**: Removes the subscription and all locally synced event notes
- **Delete subscription only**: Removes the subscription but keeps the synced notes in your vault

## Related Features

- [Event Skipping](./event-skipping) - Hide events without deleting
- [Multiple Calendars](./multiple-calendars) - Manage separate calendars
- [Notifications](./notifications) - Configure event reminders
