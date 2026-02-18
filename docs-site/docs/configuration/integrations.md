# Integrations Settings

Integration settings for connecting with external calendar services and importing/exporting events. Access via Settings → Integrations.

## ICS Export/Import

- **Export folder**: folder where exported .ics files are saved (default: `Prisma-Exports`)
- **Export calendar**: export all events to an .ics file
- **Import .ics**: import events from an .ics file

See the [Integrations](../features/advanced/integrations) documentation for full details.

## CalDAV

Configure CalDAV accounts for two-way sync with external calendar servers. See the [CalDAV](../features/advanced/integrations#caldav) documentation.

## ICS URL Subscriptions

Subscribe to external calendars via public ICS URLs for automatic periodic syncing. See the [ICS Subscriptions](../features/advanced/integrations#ics-url-subscriptions) documentation.

## Holidays

- **Enable holidays**: display public holidays on the calendar as virtual read-only events
- **Country**: ISO country code (e.g., US, GB, DE, CA)
- **State/Province**: optional state or province code
- **Region**: optional region code for more specific holidays
- **Holiday types**: select which types of holidays to display (public, bank, school, observance, optional)
- **Timezone**: optional timezone for holiday calculations

See the [Holidays](../features/calendar/holidays) documentation for full details.
