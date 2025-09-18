# Recurring Events (DSL)

Define recurrence in frontmatter using `RRule` and `RRuleSpec`.

## Weekly / Bi-weekly

```yaml
---
Title: Standup
Start: 2025-02-03T09:30
RRule: weekly
RRuleSpec: monday, tuesday, wednesday, thursday, friday
RRuleID: standup-2025
---
```

## Daily / Monthly / Bi-monthly / Yearly

```yaml
---
Title: Pay Rent
Start: 2025-02-01T09:00
RRule: monthly
RRuleID: rent
---
```

## Generation horizon

- “Future instances count” controls how many future notes are created (1–52)
- Beyond that, events appear as read-only virtual items

Tips:
- Use a stable `RRuleID` to uniquely identify a recurrence series
- Adjust the count to match your planning window
