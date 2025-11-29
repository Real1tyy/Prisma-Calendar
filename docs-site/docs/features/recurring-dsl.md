# Recurring Events (DSL)

Create repeating events using `RRule` and `RRuleSpec` in your note's frontmatter.

## How Recurring Events Work

Recurring events in this system work differently from traditional calendars. Here's the fundamental concept:

### The Configuration Node

When you create a recurring event, you're creating a **single configuration node** that serves as the complete template and controller for all recurring instances. This one note defines:

- The recurrence pattern (`RRule` and `RRuleSpec`)
- **ALL frontmatter properties** that instances will inherit
- **ALL content** (headings, text, checkboxes, formatting) that instances will inherit
- The starting point for the series

Think of it as a "master template" - the system copies the ENTIRE file structure to create each recurring instance.

### Generated Instances

From this configuration node, the system automatically generates two types of events:

1. **Physical Events**: Actual note files created in your vault (controlled by "Future instances count" setting)
2. **Virtual Events**: Read-only calendar entries that appear beyond your generation horizon

**Complete File Inheritance**: All generated instances inherit the ENTIRE structure from your configuration node:
- **All frontmatter properties** (tags, custom fields, metadata)
- **Complete file content** (headings, text, templates, checkboxes)
- **Exact formatting** (markdown structure, spacing, layout)

The configuration node serves as a complete template - whatever you put in it becomes the template for every recurring instance.

**What gets adjusted automatically:**
- `Start` and `End` date/time values (calculated based on recurrence pattern)
- System-managed properties like `RRuleID`

**What gets copied exactly:**
- All other frontmatter properties (tags, custom fields, metadata)
- Entire file content (every heading, paragraph, bullet point, checkbox)
- All markdown formatting and structure
- Any template placeholders or custom text

### The "Start" Date Is a Calculation Point

A critical concept to understand is that the `Start` date in your frontmatter is a **calculation starting point**, not necessarily the date of the first event.

This is most relevant for `weekly` and `biweekly` events. The system will begin its search **on or after** the `Start` date to find the first day that matches your `RRuleSpec` (e.g., the first `sunday`).

**Example:**
- You set `Start: 2025-09-19` (a Friday)
- You set `RRule: weekly` and `RRuleSpec: sunday`

**Result**: The system will **not** create an event on Friday the 19th. It will correctly find the next Sunday, the 21st, and create the first event there.

For `daily`, `monthly`, and `yearly` events, the `Start` date is typically the first instance, as there are no weekday constraints.

### Internal ID Management

⚠️ **CRITICAL: Do Not Modify RRuleID**

When you create a recurring event, the system automatically assigns a unique `RRuleID`. This ID is used internally to:
- Map all physical event files to their recurring series
- Track which events belong together
- Maintain data integrity across the recurrence

**Never manually set or modify the `RRuleID`** - this is entirely managed by the system and changing it will break the association between events.

### Duplicate Prevention

The system uses a sophisticated mechanism to prevent duplicate instance creation, even in complex scenarios like:
- Multiple file scans happening simultaneously
- Vault sync conflicts
- Plugin restarts during instance generation
- Race conditions from concurrent operations

**How it works:**

For every recurring event instance, the system generates a **deterministic file path** based on two pieces of information:

1. **RRuleID** (the unique identifier for the recurring series)
2. **Instance Date** (the specific date for this occurrence)

The file path format is:
```
[Title] [YYYY-MM-DD]-[14-digit-hash].md
```

**Example:**
- RRuleID: `1730000000000-abc12`
- Instance Date: `2025-01-15`
- Generated Path: `Weekly Meeting 2025-01-15-12345678901234.md`

**Key Properties:**

✅ **Determinism**: For any given (RRuleID, date) pair, the file path is **always identical**
- Same RRuleID + same date = same file path (every time)
- The 14-digit hash is computed deterministically from the RRuleID

✅ **Uniqueness**: Different RRuleIDs produce different hashes
- Different recurring events never collide
- Each series has its own unique identifier

✅ **Filesystem Deduplication**: The file path itself acts as the deduplication gate
- If file exists → creation is skipped (returns immediately)
- No duplicates can be created, regardless of how many times the system tries

**Why this matters:**

This design ensures that **no matter how many times** the system attempts to create an instance for a specific date, only **one file** is ever created. The filesystem itself becomes the source of truth for existence, making the system resilient to:

- Race conditions (multiple threads trying to create the same instance)
- Plugin reloads (reprocessing the same events)
- Vault synchronization (files being scanned multiple times)
- Indexer restarts (re-scanning existing files)

**Technical Note:**

The deterministic hash is a 14-digit number generated from the RRuleID using a consistent hash function. This format:
- Matches the existing Zettel ID pattern (`-\d{14}`)
- Is compatible with all existing file naming utilities
- Remains stable across title changes (only the title part changes, hash stays the same)

---

## Creating Recurring Events

### Via Calendar Interface (Recommended)

Right-click any time slot → "Create Event" → Set RRule properties along with all other frontmatter → Create.

This creates the source atomically with all properties set, ensuring complete inheritance.

### Manual File Creation

Create a note with frontmatter. **Tip:** Add the `RRule` property last, as the indexer starts generating instances immediately when it detects it. This way all your other frontmatter and content is already in place before generation begins.

```yaml
---
Title: Weekly Meeting
Start: 2025-10-06T10:00
Project: [[Alpha]]
Priority: High
# Add RRule last so everything above is already set
RRule: weekly
RRuleSpec: monday
---

Your content here
```

---

## Source Navigation & Instance Management

**Source Button:** Available on recurring instances - click to navigate to the source event.

**Instance Dropdown:** View all physical instances of a recurring series. Available on source events and instances. Toggle "Show Past" to filter old events.

**Virtual Events:** Clicking a virtual event (far future) shows the source event that generates it.

---

## Examples

### Weekly Standup

```yaml
---
Title: Daily Standup
Start: 2025-02-03T09:30
RRule: weekly
RRuleSpec: monday, tuesday, wednesday, thursday, friday
---

## Meeting Notes
- Review yesterday's progress
- Plan today's work
- Identify blockers
```

**Result**: Creates a standup event every weekday. Each generated file will have:
- Identical frontmatter (Title, Start time adjusted for each day, RRule properties)
- Complete content section with the same headings and bullet points
- Same markdown structure and formatting

### Monthly Rent Payment

```yaml
---
Title: Pay Rent
Start: 2025-02-01T09:00
RRule: monthly
tags: [finance, recurring]
---

## Payment Details
- Amount: $1,200
- Due date: 1st of each month
- Account: Checking #1234
```

**Result**: Creates a monthly recurring event on the 1st of each month. Each generated file will have:
- All frontmatter properties (Title, Start time, tags, etc.)
- Complete "Payment Details" section with all bullet points
- Identical content structure and formatting

### Custom Weekly Pattern

```yaml
---
Title: Gym Session
Start: 2025-02-03T18:00
End: 2025-02-03T19:30
RRule: weekly
RRuleSpec: monday, wednesday, friday
tags: [health, workout]
---

## Workout Plan
- Warm up: 10 minutes
- Main workout: 45 minutes
- Cool down: 15 minutes
```

**Result**: Creates gym sessions every Monday, Wednesday, and Friday. Each generated file will have:
- All frontmatter (Title, Start/End times, tags)
- Complete "Workout Plan" section with all bullet points
- Identical markdown structure ready for tracking workouts

## Recurrence Patterns

### Available RRule Values
- `daily` - Every day
- `weekly` - Every week
- `biweekly` - Every 2 weeks
- `monthly` - Every month
- `bimonthly` - Every 2 months
- `yearly` - Every year

### RRuleSpec for Weekly Patterns
When using `weekly` or `biweekly`, specify days with `RRuleSpec`:

```yaml
RRuleSpec: monday, wednesday, friday
RRuleSpec: tuesday, thursday
RRuleSpec: saturday, sunday
```

## Generation Control

### Future Instances Count
Configure how many physical note files are created ahead of time (1-52 instances):

**Recommended: 1-2 instances** for most recurring events to keep your vault lean.

**How counting works:**
- For **weekly with multiple days**: Count = number of weeks (not individual days)
- Example: `RRule: weekly` + `RRuleSpec: monday, wednesday, friday` + Count = 2 → Creates **6 files** (2 weeks × 3 days)

**Practical ranges:**
- **1-2 instances**: Recommended for most users (covers immediate planning horizon)
- **3-8 instances**: For intensive planning periods or project phases
- **12+ instances**: Only for extensive advance preparation needs

#### Per-Event Override

You can override the global "Future instances count" setting for individual recurring events in two ways:

##### **Via Event Edit Modal** (Recommended)

When creating or editing a recurring event:
1. Enable "Recurring Event" checkbox
2. Scroll to the "Future instances count" field
3. Enter a custom number (or leave empty to use the global default)
4. Save the event

The UI automatically handles the frontmatter property for you.

##### **Via Manual Frontmatter**

Alternatively, add the `Future Instances Count` property directly to the event's frontmatter:

```yaml
---
Title: Critical Team Standup
Start: 2025-02-03T09:00
End: 2025-02-03T09:30
RRule: weekly
RRuleSpec: monday, wednesday, friday
Future Instances Count: 10
---
```

**When to use per-event overrides:**
- **More instances**: Generate extra instances for critical recurring events you need to plan far ahead (e.g., weekly standups, important check-ins)
- **Fewer instances**: Reduce clutter for infrequent events (e.g., 1 instance for yearly reviews)
- **No override**: Omit the property to use the global setting (recommended for most events)

**Dynamic Updates**: If you change the future instances count for an existing recurring event and reload Obsidian, the plugin will automatically generate additional physical instances as needed to match the new target count.

**Note**: The property name `Future Instances Count` can be customized in Settings → Properties → "Future instances count property".

### Virtual Events
Beyond your generation horizon, events appear as read-only virtual items in the calendar. These don't create files but show you the complete recurring pattern.

### Duplicating Recurring Instances

You can duplicate physical recurring instances without affecting future instance generation. This is useful when you need to:

- Create a one-off variation of a recurring event (e.g., a special team meeting)
- Archive past recurring events while keeping them linked to their source

#### How to Duplicate

Right-click on any **physical** recurring event and select **"Duplicate recurring instance"**.

#### What Happens

The duplicated event:
- Preserves all frontmatter properties including `RRuleID`, `Source`, and `Recurring Instance Date`
- Receives a new unique ZettelID (making it a distinct file)
- Gets an `Ignore Recurring: true` property set automatically

#### The Ignore Recurring Property

When an event has `Ignore Recurring: true`, it:
- **Is tracked** in the recurring event's list of instances
- **Is NOT counted** towards the "Future instances count" limit
- **Does NOT influence** when new physical instances are generated

This means the duplicate won't disrupt your regular recurring schedule.

⚠️ **Important**: The `Ignore Recurring` property is automatically managed by the system. Always use the "Duplicate recurring instance" context menu option.

### Moving Physical Recurring Events

When you drag and drop a physical recurring event to a new date:
- The event's date properties are updated automatically
- The filename is automatically renamed to reflect the new date (format: `Title YYYY-MM-DD-ZettelID.md`)

**Instance Date Handling**:
- **Normal physical instances**: The `Recurring Instance Date` stays unchanged to preserve the original scheduled date
- **Duplicated/ignored instances** (`Ignore Recurring: true`): The `Recurring Instance Date` is also updated to match the new date

This distinction ensures that normal recurring instances maintain their original schedule reference, while duplicated instances (which are independent of the schedule) can be freely reorganized.

**Note**: The `Recurring Instance Date` property name can be customized in Settings → Properties → "Instance date property".

## Best Practices

### 1. Start Simple
Begin with basic recurrence patterns and expand as needed:

```yaml
---
Title: Weekly Review
Start: 2025-02-07T15:00
RRule: weekly
RRuleSpec: friday
---
```

### 2. Use Meaningful Templates
Your configuration node serves as the complete template - include ALL structure you want in every instance:

```yaml
---
Title: Project Standup
Start: 2025-02-03T10:00
RRule: weekly
RRuleSpec: monday, wednesday, friday
project: alpha-project
status: active
priority: high
team: [alice, bob, charlie]
tags: [meeting, standup, alpha]
---

## Agenda
1. Progress updates from each team member
2. Blockers discussion and resolution
3. Next sprint planning

## Meeting Notes
**Date**: {{date}}
**Attendees**:
- [ ] Alice (Product)
- [ ] Bob (Engineering)
- [ ] Charlie (Design)

### Progress Updates
- **Alice**:
- **Bob**:
- **Charlie**:

### Blockers & Issues
-

### Decisions Made
-

## Action Items
- [ ] Follow up on XYZ issue (Due: {{date+7d}})
- [ ] Review design mockups
- [ ] Update documentation

## Next Meeting Focus
-

---
*Meeting template v1.2 - Last updated: 2025-01-15*
```

**Complete Inheritance**: Every generated instance will have:
- **All 7 frontmatter properties** (Title, Start, RRule info, project, status, priority, team, tags)
- **Every content section** (Agenda, Meeting Notes, Progress Updates, etc.)
- **All formatting** (headers, bullet points, checkboxes, emphasis)
- **Template placeholders** ready for customization in each instance
- **Footer information** exactly as written

### 3. Don't Touch System Properties
- Never modify `RRuleID` - it's automatically managed
- Don't manually create or delete recurring instance files
- Let the system handle the mapping and associations

### 4. Adjust Generation Horizon
Match your "Future instances count" to your planning needs:
- **Most users**: 1-2 instances (covers immediate planning, avoids clutter)
- **Active planners**: 3-4 instances for events requiring advance preparation
- **Project phases**: Higher counts only during intensive planning periods
- **Remember**: Weekly patterns multiply (Mon/Wed/Fri + Count=2 → 6 files)

## Troubleshooting

### Missing Recurring Instances
- Check your "Future instances count" setting
- Ensure the configuration node has valid `RRule` and `RRuleSpec`
- Verify the configuration node hasn't been moved or deleted

### Broken Associations
- Never manually edit `RRuleID` fields
- If association is broken, delete all instances and recreate from the configuration node
- Contact support if recurring events aren't generating properly
