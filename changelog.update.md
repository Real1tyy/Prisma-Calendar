### Fixed

- **Synced event deletion**: deleting a CalDAV or ICS subscription event from the calendar, Gantt view, or a batch selection keeps later syncs from recreating it. Undo restores sync eligibility. Virtual events and permanent deletion history share `Prisma.md` in each planning folder, with automatic migration and support for calendars sharing a folder. [Integrations](./features/advanced/integrations)
