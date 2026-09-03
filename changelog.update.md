### Fixed

- **More robust startup**: Prisma now waits until Obsidian has finished indexing your vault before it does any work of its own — calendar-subscription and CalDAV syncs, recurring instances, marking past events done, cleaning up duplicates. The wait is progressive, so a large vault on a slow start simply takes as long as it needs, and nothing is written until the index is complete. See [Integrations → Syncing and vault indexing](./features/advanced/integrations.md#syncing-and-vault-indexing).
