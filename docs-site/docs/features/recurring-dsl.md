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

### Virtual Events
Beyond your generation horizon, events appear as read-only virtual items in the calendar. These don't create files but show you the complete recurring pattern.

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
