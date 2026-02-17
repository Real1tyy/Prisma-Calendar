# Event Model

Developer-facing reference for Prisma Calendar's event classification and recurring event architecture.

## Note Classification

Every note in the calendar directory is classified as one of:

| Classification | Condition                                                   |
| -------------- | ----------------------------------------------------------- |
| **Untracked**  | No start date property in frontmatter                       |
| **Timed**      | Has start date with a time component                        |
| **All-day**    | Has start date without a time component (or `allDay: true`) |

Timed and all-day notes are "tracked" — they appear on the calendar and participate in indexing, stats, and recurrence.

## Recurring Events

A recurring event series consists of two roles:

- **Source file**: Defines the recurrence rule (`rruleType`, `rruleSpec`, `rruleId`). Acts as the template — its frontmatter propagates to instances.
- **Physical instance**: A concrete note for a single occurrence. Linked to its source by `rruleId` and distinguished by `instanceDate`.

### Uniqueness Invariant

Each physical instance is uniquely identified by the pair `(rruleId, instanceDate)`. The `RecurringEventManager` enforces this as a map keyed by `dateKey` (ISO date string) per `rruleId`.

If two files claim the same `(rruleId, instanceDate)` — from vault copies, sync conflicts, or race conditions — self-healing trashes the newcomer. The first file indexed wins; the duplicate is moved to trash without ever being registered in the instance map. This matches the "first wins" convention used by the ICS and CalDAV sync managers.

### Virtual Instances

Beyond physical instances, the manager generates virtual (ephemeral) instances for future dates that don't yet have files. These appear on the calendar but have no backing note until materialized.
