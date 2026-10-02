### Fixed

- **`webcal://` links in ICS URL subscriptions**: subscription links that start with `webcal://` or `webcals://` — what Apple Calendar, iCloud and Outlook hand out when you share a calendar — failed both **Test URL** and every sync. Paste them as-is; Prisma fetches them over `https://`. See [Integrations → ICS URL Subscriptions](./features/advanced/integrations.md#adding-a-subscription).
