### Improved

- **Debug entries are always in the logs**: Prisma keeps every debug entry in memory from the moment it loads, so the detail behind a problem is already there when you open the logs — no need to turn anything on and reproduce it first. The Logs window hides debug lines until you press the **debug** chip, and **Reset filters** hides them again. Debug has its own share of memory, so it never pushes out a warning or an error. The **Minimum level** setting is replaced by **File level**, which only decides what goes into the log file and starts at Info. See [General → Logging](./configuration/general.md#logging).

### Fixed

- **Notes with a property listed twice**: when a sync tool or an editor reload left an event with the same property twice (for example two `Calendar Title` lines), the event dropped off the calendar and every edit to it failed — "Fill end time from next event" included. Prisma now repairs such a note on its own, keeping each property's last non-empty value in your configured order, and new events created from a template are written in their final shape in one go. The Doctor's new **Frontmatter integrity** row shows every repair, and the logs record the value kept and any value replaced — on your device only, hidden from diagnostics you share unless you include full detail. See [Troubleshooting → Events](./troubleshooting.md).
