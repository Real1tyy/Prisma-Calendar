# Multiple Devices and Sync

Prisma Calendar works on every device your vault is synced to — desktop, laptop, tablet, phone — with any file-level sync tool: Self-hosted LiveSync, Obsidian Sync, iCloud, Syncthing, Google Drive, or git. Prisma does not coordinate devices with each other. Instead, everything it does on its own is **deterministic**: given the same notes and the same settings, every device computes the same file names and the same property values, so when the sync tool merges the two sides there is nothing to conflict over.

## What Prisma does on its own

These are the automatic writes — the ones that happen without you clicking anything — and how each stays identical across devices:

| Automatic write | What makes it the same everywhere |
|---|---|
| **Recurring instance notes** | The file name is a function of the series id and the date (`Standup 2026-09-04-<id>.md`), so two devices generate the same file. If the other device's copy arrives while an instance is being created, that copy is used as-is — never re-created with a ` 1` suffix. |
| **Series id** (`RRuleID`) | Derived from the source note: its [ZettelID](../management/zettelid-naming.md) when the name carries one, otherwise a stable hash of its path. Two devices that both index a new series before the other's write has synced agree on the id. An id that a sync conflict changed on disk is adopted, and the instances are migrated to it. |
| **Marking past events done** | Writes the configured done value and nothing else — no timestamp — so both devices produce byte-identical files. Which device writes first only depends on which one is open. |
| **Sort Date** | Computed from the event's own start and end strings, never from the device clock or timezone. An all-day event's date is the same on every device. |
| **Calendar Title** | Computed from the file path. |
| **Duplicate cleanup** | When two notes hold the same recurring instance or the same synced CalDAV/ICS event (UID), every device keeps the same survivor — the canonical name: the shortest path, then the alphabetically first — and trashes the other. |
| **Property order** | Prisma's own properties are written in the order configured under [Properties](../../configuration/properties.md#property-order), so files converge to identical bytes. |

Anything you do yourself — editing a note on two devices at once — is the sync tool's job to merge, exactly as with any other note.

## What to sync

- **Your notes** — of course.
- **Prisma's settings** (`.obsidian/plugins/prisma-calendar/data.json`). The property order, the done value, the recurring-instance count and the property names are inputs to every automatic write; devices with different settings produce different files. Most sync tools sync plugin settings by default; LiveSync needs *Sync hidden files* / plugin settings sync turned on.
- Do **not** sync per-device state. Prisma keeps CalDAV sync tokens in the browser's local storage and the read-only flag in `sync.json`, both of which are meant to differ per device.

## How automatic writes reach your notes

Every automatic write goes through one queue per note: it waits until Obsidian has finished indexing the vault, runs after any earlier write to the same note, writes Prisma's properties in the configured order, and is dropped when the note already holds exactly what it would write. A note another device already updated is therefore never rewritten just to end up identical, and a write queued for a note that is renamed in the meantime follows the note.

## Limiting writes to one device

If you prefer that only one device generates instances, syncs external calendars, and marks events done, turn on **Read-only mode** under **Settings → General** on every other device. A read-only device shows and lets you edit events normally, but performs no automatic writes of its own: no recurring instances, no marking done, no **Sort Date** or **Calendar Title** normalisation, no CalDAV/ICS sync, no series propagation, no time-tracker progress saves, no reminder flags. Edits you make by hand are written as usual.

## Reminders on several devices

A reminder fires on every device that has the vault open at that moment; each one shows its own notification and writes the same **Already Notified** flag, so the note converges. Prisma does not elect one device to own reminders — there is no reliable way to tell which device you are looking at.

## Templater and other plugins

An automatic write is only deterministic if everything it copies is. A Templater template that inserts the current time or a random value into recurring instances makes each device's copy different, and the sync tool will report a conflict on such notes. Keep instance templates free of `tp.date.now()`-style calls, or generate instances on one device only.

## Related

- [Integrations → Syncing and vault indexing](./integrations.md#syncing-and-vault-indexing) — nothing is written before Obsidian has finished indexing.
- [Properties → Property order](../../configuration/properties.md#property-order) — byte-identical frontmatter.
- [Recurring events](../events/recurring-dsl.md) — how instances are generated.
