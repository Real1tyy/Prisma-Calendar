### Improved

- **Planning data storage**: manual virtual events and integration deletion history share a dedicated `Prisma.md` Markdown file in each planning folder, with automatic migration from legacy virtual event files and safe concurrent updates across calendars pointing to the same folder. [The Prisma.md data file](./features/events/virtual-events#storage)

### Fixed

- **Synced event deletion**: deleting a CalDAV or ICS subscription event from the calendar, Gantt view, or a batch selection keeps later syncs from recreating it. Undo restores sync eligibility. [Integrations](./features/advanced/integrations#removing-a-synced-event-locally)
