# Integrations

Sync with external calendars or exchange events using standard calendar formats.

## Overview

Prisma Calendar offers two integration methods:

1. **CalDAV Sync** - Automatic read-only synchronization from CalDAV servers (Fastmail, Nextcloud, iCloud) to Obsidian
2. **ICS Import/Export** - Manual exchange of event files with any calendar application

### ICS Format

Prisma Calendar stores all event times internally in **UTC**. When exporting or importing events, you select a timezone for conversion. This ensures events display correctly in any calendar application regardless of your local timezone.

ICS files work with:
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

![Export Modal](/img/integrations_export.png)

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
5. Select the timezone for conversion
6. Click "Import" to create notes

![Import Modal](/img/integrations_import.png)

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

## CalDAV Integration

### Overview

CalDAV integration enables read-only synchronization from external CalDAV servers to Prisma Calendar. Connect your Fastmail, Nextcloud, iCloud, or any CalDAV-compatible calendar to automatically import events into Obsidian.

**Key Benefits:**
- Automatic one-way sync (server → Obsidian)
- Create Obsidian notes for external events
- Keep Obsidian calendar up-to-date with external events
- Incremental sync using ETags for efficiency
- No manual import/export required

**Note:** CalDAV sync is currently **read-only**. Events created or modified in Obsidian are not synced back to the CalDAV server.

### Supported Providers

CalDAV integration works with any standard CalDAV server:

| Provider | Server URL Example | Auth Method |
|----------|-------------------|-------------|
| **Fastmail** | `https://caldav.fastmail.com/dav/` | Basic |
| **Nextcloud** | `https://cloud.example.com/remote.php/dav/` | Basic |
| **iCloud** | `https://caldav.icloud.com/` | Basic (app-specific password) |
| **SOGo** | `https://sogo.example.com/SOGo/dav/` | Basic |

### Setting Up CalDAV

:::danger Security Warning
**CalDAV credentials are stored in PLAINTEXT in your vault's `.obsidian/plugins/prisma-calendar/data.json` file.**

- ⚠️ **Passwords are NOT encrypted**
- ⚠️ **Anyone with access to your vault can read your credentials**
- ⚠️ **Synced vaults (iCloud, Dropbox, Git) will expose credentials**

**Recommended Security Practices:**
- Use **app-specific passwords** (available for iCloud, Google, Fastmail)
- Never use your primary account password
- Use a dedicated CalDAV account with limited permissions
- Keep your vault secure with filesystem encryption
- Be cautious when syncing your vault to cloud services
:::

#### Adding an Account

1. Open **Prisma Calendar Settings → Integrations → CalDAV**
2. Click **"Add CalDAV account"**
3. Configure account details:

| Field | Description |
|-------|-------------|
| **Account name** | Display name (e.g., "Work Calendar") |
| **Server URL** | CalDAV server endpoint |
| **Auth method** | Basic or OAuth 2.0 |
| **Username** | Your account username |
| **Password** | ⚠️ **STORED IN PLAINTEXT** - Use app-specific password |
| **Timezone** | Timezone for event conversion |

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

#### Auto-sync Settings

Configure automatic synchronization behavior:

| Setting | Default | Description |
|---------|---------|-------------|
| **Allow auto-sync** | `true` | Enable periodic background syncing |
| **Sync on startup** | `true` | Sync when Obsidian starts |
| **Sync interval** | 15 minutes | How often to sync (1-1440 minutes) |
| **Show sync notifications** | `true` | Display sync status messages |

#### Manual Sync

Use **"Sync now"** button in CalDAV settings to trigger immediate synchronization for any account.

### How CalDAV Sync Works

#### Initial Sync

1. Prisma Calendar fetches all events from selected calendars
2. For each event:
   - Creates a new markdown note in the calendar's folder
   - Generates Zettel ID for conflict-free filename
   - Populates frontmatter with event data
   - Adds CalDAV metadata for tracking

#### Incremental Updates

On subsequent syncs:

1. **ETag comparison**: Check if server event changed
2. **If unchanged**: Skip processing (efficient)
3. **If changed**:
   - Update note frontmatter
   - Rename file if title changed (preserve Zettel ID)
   - Update lastModified and lastSyncedAt timestamps

#### Event Creation

New events from CalDAV appear as:

```yaml
---
Title: Team Meeting
Start Date: 2025-01-15T14:00:00Z
End Date: 2025-01-15T15:00:00Z
Category: Work, Meetings
_ZettelID: 20250115140000
CalDAV:
  accountId: fastmail-work
  calendarHref: https://caldav.fastmail.com/.../calendar/
  objectHref: https://caldav.fastmail.com/.../event.ics
  etag: "abc123def456"
  uid: unique-event-id-12345
  lastModified: 1737038400000
  lastSyncedAt: 1737038450000
---

Meeting agenda imported from external calendar...
```

**Filename format:** `Team Meeting - 20250115140000.md`

### Sync State Management

#### Frontmatter-Based State

Sync state is stored **directly in note frontmatter**. This enables:
- Easy vault migration (state travels with notes)
- Transparent tracking (inspect sync metadata in any note)
- Efficient ETag-based sync

#### Tracked Metadata

Each synced event stores:

| Field | Purpose |
|-------|---------|
| `accountId` | Which CalDAV account manages this event |
| `calendarHref` | Source calendar URL |
| `objectHref` | Specific event resource URL |
| `etag` | Version tag for change detection |
| `uid` | iCalendar unique identifier |
| `lastModified` | When event was last changed on server |
| `lastSyncedAt` | When Prisma last synced this event |

### Timezone Handling

#### Per-Account Timezone

Each CalDAV account has a timezone setting:

```yaml
timezone: Europe/Prague  # UTC+1
```

**Purpose:**
- Convert server events to UTC for internal storage
- Preserve original times when timezone matches server
- Display events correctly in calendar view

**Example:**

Server event (Europe/Prague):
```
DTSTART: 20250115T140000  (14:00 Prague time)
```

If account timezone is `Europe/Prague`:
- Stored as UTC: `2025-01-15T13:00:00Z`
- Displays as: `14:00` in Prague

### Visual Integration

#### Integration Event Color

CalDAV-synced events display with a custom color:

1. Open **Settings → Integrations → CalDAV**
2. Set **"Integration event color"** (default: purple `#8b5cf6`)
3. Calendar **immediately** updates all CalDAV events

**Color Priority:**
- CalDAV integration color overrides other color rules
- Applies to all events with CalDAV metadata
- Reactive - changes apply instantly without refresh

### Title Changes and File Renaming

When an event title changes on the CalDAV server:

**Before:**
- Server: `Team Meeting`
- File: `Team Meeting - 20250115140000.md`

**After server update to `Weekly Standup`:**
- Prisma detects title change via ETag
- Renames file: `Weekly Standup - 20250115140000.md`
- Preserves Zettel ID for consistency
- Updates frontmatter automatically

### Troubleshooting

#### No Events Syncing

**Cause:** Time range filter too narrow or calendar selection incorrect.

**Solution:**
1. Check selected calendars in account settings
2. Verify calendar URL is correct
3. Test connection to ensure authentication works
4. Check server calendar actually contains events

#### Events Show Wrong Time

**Cause:** Timezone mismatch between server and account settings.

**Solution:**
1. Check CalDAV account timezone setting
2. Ensure it matches the server's timezone
3. Re-sync to apply correct conversion

#### Duplicate Events

**Cause:** Sync state lost or corrupted.

**Solution:**
1. Delete duplicate events manually
2. Verify CalDAV metadata is present in frontmatter
3. Re-sync to restore proper tracking

#### Connection Failed

**Cause:** Invalid credentials or server URL.

**Solution:**
1. Verify server URL format (must end with `/`)
2. Check username and password
3. For iCloud, use app-specific password
4. Click "Test connection" to validate

### Read-Only Sync

**Current Limitation:** CalDAV sync is **read-only** (server → Obsidian only).

**What This Means:**
- ✅ Events from server are synced to Obsidian
- ✅ Server changes update Obsidian notes
- ❌ Changes in Obsidian notes don't sync back to server
- ❌ Events created in Obsidian don't appear on server

**Future Enhancement:** Two-way sync is planned for a future release.

### Security Considerations

#### Credential Storage

:::danger CRITICAL: Plaintext Password Storage
**CalDAV credentials are stored UNENCRYPTED in `.obsidian/plugins/prisma-calendar/data.json`**

**This means:**
- ❌ Passwords are stored in **plaintext** - anyone who can read the file can see your credentials
- ❌ Cloud sync services (iCloud, Dropbox, Syncthing, Git) will sync your credentials
- ❌ Vault backups contain your credentials
- ❌ Shared vaults expose credentials to all users with access
- ❌ No encryption is applied - this is Obsidian's standard plugin data storage

**This is a significant security risk if your vault is:**
- Synced to cloud services
- Backed up to untrusted locations
- Accessible to other users
- Stored on shared/multi-user systems
:::

**Mandatory Security Practices:**
- ✅ **ALWAYS use app-specific passwords** - never your main account password
  - iCloud: [Generate app-specific password](https://support.apple.com/en-us/HT204397)
  - Google: [App passwords](https://myaccount.google.com/apppasswords)
  - Fastmail: [App passwords](https://www.fastmail.help/hc/en-us/articles/360058752854)
- ✅ **Use a dedicated CalDAV account** with minimal permissions
- ✅ **Enable filesystem encryption** (BitLocker, FileVault, LUKS)
- ✅ **Revoke app-specific passwords** when no longer needed
- ✅ **Be extremely cautious** when syncing vault to cloud services

**What happens if credentials are compromised:**
- Attacker can read all your calendar events
- Attacker can delete calendar events (if write access is ever added)
- Attacker can access other data on the CalDAV server
- Your main account password may be at risk if you didn't use app-specific passwords

#### Network Security

All CalDAV connections use HTTPS:
- Encrypted communication with server
- TLS certificate validation
- Secure credential transmission

## Related Features

- [Event Skipping](./event-skipping.md) - Hide events without deleting
- [Multiple Calendars](./multiple-calendars.md) - Manage separate calendars
- [Notifications](./notifications.md) - Configure event reminders
