---
title: Connect Google Calendar
description: Sync a Google Calendar into Prisma Calendar using Google's secret iCal address.
---

# Connect Google Calendar

Google Calendar syncs into Prisma through Google's **"Secret address in iCal format"** — a private `.ics` URL you add as an [ICS URL subscription](../integrations.md#ics-url-subscriptions). The sync is one-way and read-only: Google events show up in Obsidian, and changes you make in Obsidian are never written back to Google.

:::info Pro Feature
ICS URL subscriptions require [Prisma Calendar Pro](../../free-vs-pro.md).
:::

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/GoogleCalendarIntegration.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

## Step 1 — Copy the secret iCal address

The secret address is only shown in Google Calendar on the web, not the mobile app.

1. Open [Google Calendar](https://calendar.google.com) in a browser.
2. Under **My calendars**, hover the calendar to sync, then click **⋮ → Settings and sharing**.
3. Scroll to the **Integrate calendar** section.
4. Copy the **Secret address in iCal format**. It ends in `.ics`:

   ```
   https://calendar.google.com/calendar/ical/you%40gmail.com/private-1a2b3c.../basic.ics
   ```

Use the **Secret** address, not the **Public** one — the public address only returns events for calendars set to public.

:::warning Treat the secret address like a password
Anyone with this URL can read every event on the calendar. Don't put it in shared notes. To revoke it, click **Reset** next to the secret address in Google.
:::

## Step 2 — Store it as a secret in Obsidian

Subscription URLs live in Obsidian's **SecretStorage**, not `data.json`, so the token never sits in plain text in the vault.

1. Open **Obsidian Settings → General → Manage secrets**.
2. Create a secret (e.g. `google-calendar-ics`) and paste the address as its value.

## Step 3 — Add the subscription

1. Open **Prisma Calendar Settings → Integrations → ICS URL subscriptions**.
2. Click **Add subscription**.
3. Set the fields:
   - **Subscription name** — e.g. `Google Calendar`
   - **ICS URL** — the secret from Step 2
   - **Sync interval** — minutes between refreshes (default: 60)
   - **Timezone** — the local timezone for event times
   - **Calendar icon** (optional) — an emoji shown on synced events
4. Click **Test URL** to confirm the calendar is reachable and preview its event count.
5. Click **Add subscription**.

Prisma pulls in the events, creates a note per event, and re-syncs on the interval. Events deleted in Google are removed locally on the next sync, and title changes rename the matching note. See [ICS URL Subscriptions](../integrations.md#ics-url-subscriptions) for the full sync behaviour.

## Keeping it in sync

- **Sync now** refreshes a subscription immediately.
- **Auto-sync** and **Sync on startup** control automatic refreshing.
- Sync is read-only — edits, moves, and deletions in Obsidian never reach Google.

## Troubleshooting

| Symptom | Fix |
|---|---|
| **Test URL** errors | Re-copy the secret address and update the Obsidian secret. Confirm it ends in `.ics` and is the **Secret**, not Public, address. |
| No events appear | Check the secret points to the right calendar, and that the calendar has events in the synced window. |
| Wrong event times | Set the subscription's **Timezone** to the local zone and sync again. |
| Revoking access | **Reset** the secret address in Google, then update the Obsidian secret with the new URL. |

## CalDAV (advanced)

Google also supports CalDAV, but it needs OAuth 2.0 credentials and is far more involved. The secret iCal address above is the simpler path. For CalDAV, see [CalDAV Integration](../integrations.md#caldav-integration).

## Still not syncing?

If Google Calendar still isn't showing up after following these steps, [send me your feedback](https://matejvavroproductivity.com/feedback?utm_campaign=prisma_calendar&utm_source=docs&utm_medium=google_calendar&utm_content=feedback) — happy to help.

## Related

- [Integrations overview](../integrations.md)
- [ICS URL Subscriptions](../integrations.md#ics-url-subscriptions)
- [Free vs Pro](../../free-vs-pro.md)
