# Event Groups Settings

## Recurring Instances (Generation Horizon)

- **Future instances count**: how many future notes to pre-generate (1–52, default: 2)
- Beyond that, events appear as read-only virtual items to keep your vault light
- **Per-event override**: Set `Future Instances Count` property in a recurring event's frontmatter to override the global setting for that specific recurring series

## Event Markers

Visual indicators appear in the top-right corner of recurring events to distinguish between source events and physical instances (shown by default):

- **Show source recurring marker**: Toggle visibility of markers on source recurring events (default: enabled)
- **Source recurring marker**: Symbol/emoji displayed on source recurring events (default: ⦿). Use any Unicode character or emoji.
- **Show physical recurring marker**: Toggle visibility of markers on physical recurring instances (default: enabled)
- **Physical recurring marker**: Symbol/emoji displayed on physical recurring instance events (default: 🔄). Use any Unicode character or emoji.

Customize markers in Settings → Event Groups → Event markers to use your preferred symbols (e.g., ⚙️, 🔁, 📍, ⭐, 📌) or disable them if you prefer a cleaner look.

## Frontmatter Propagation

Frontmatter propagation keeps custom properties in sync across related events. When you change a property on one event, the change can automatically apply to all related events. Three propagation scopes are available — recurring instances, name series, and category series — each with independent toggles.

### Recurring Instance Propagation

Control how frontmatter changes in source recurring events propagate to physical instances:

- **Propagate frontmatter to instances**: When enabled, changes to custom frontmatter properties automatically propagate to all existing physical instances without confirmation.
- **Ask before propagating**: When enabled, a confirmation modal appears showing all accumulated changes before applying them.

### Name Series Propagation

Propagate frontmatter changes across events that share the same title (with ZettelID stripped). When you update a custom property on one event, all other events with the same cleaned name are updated.

- **Propagate frontmatter to name series**: Auto-propagate changes across name-based series members without confirmation.
- **Ask before propagating to name series**: Show a confirmation modal before propagating to name series members.

Name series require at least 2 events with the same cleaned title to trigger propagation.

### Category Series Propagation

Propagate frontmatter changes across events that share the same category value. When you update a custom property on one event, all other events with the same category are updated.

- **Propagate frontmatter to category series**: Auto-propagate changes across category-based series members without confirmation.
- **Ask before propagating to category series**: Show a confirmation modal before propagating to category series members.

Category series require at least 2 events with the same category value to trigger propagation.

### Shared Propagation Settings

These settings apply to all three propagation types (recurring, name series, category series):

- **Excluded properties**: Comma-separated list of additional frontmatter property names to exclude from propagation (on top of the automatically excluded properties listed below).
- **Propagation debounce delay**: Delay in milliseconds before propagating changes (100ms - 10,000ms, default: 3000ms). Multiple rapid changes within this window are accumulated and merged together. Lower values propagate faster; higher values accumulate more changes before propagating.

### Automatically Excluded Properties

The following Prisma-managed properties are **always** excluded from propagation. These are either per-instance system values (timing, identity, recurrence metadata) or per-event values that don't make sense to copy across events. You do not need to add them to the excluded properties setting — they are skipped automatically.

| Property | Default name | Why excluded |
|----------|-------------|--------------|
| Start | `Start` | Per-instance timing |
| End | `End` | Per-instance timing |
| Date | `Date` | Per-instance timing |
| Break | `Break` | Per-instance timing |
| Title | `Calendar Title` | Per-instance identity |
| All Day | `All Day` | Per-instance timing |
| RRule | `RRule` | Recurrence metadata |
| RRuleSpec | `RRuleSpec` | Recurrence metadata |
| RRuleUntil | `RRuleUntil` | Recurrence metadata |
| RRuleID | `RRuleID` | Recurrence metadata |
| Source | `Source` | Recurrence metadata |
| Instance Date | `Instance Date` | Recurrence metadata |
| Skip | `Skip` | Per-instance state |
| ZettelID | `ZettelID` | Per-instance identity |
| Future Instances Count | `Future Instances Count` | Per-event config |
| Generate Past Events | `Generate Past Events` | Per-event config |
| CalDAV | `CalDAV` | Integration metadata |
| ICS Subscription | `ICS Subscription` | Integration metadata |
| Sort Date | `Sort Date` | Computed per-instance |
| Prerequisite | `Prerequisite` | Per-event relationship |
| Status | `Status` | Per-event state |
| Already Notified | `Already Notified` | Per-instance notification state |

All property names above use their default values. If you've renamed any of these in Settings → Properties, the renamed versions are excluded instead.

### How Propagation Works

For each scope, the "propagate" and "ask before" toggles are mutually exclusive — enabling one disables the other. If both are disabled for a scope, changes are not propagated for that scope.

The system intelligently detects three types of changes:

- **Added**: New properties added to the source event
- **Modified**: Existing properties changed in the source event
- **Deleted**: Properties removed from the source event

Only the specific changes detected are propagated, preserving any instance-specific properties that weren't changed in the source. Loop prevention ensures that propagated changes don't trigger further cascading propagation.
