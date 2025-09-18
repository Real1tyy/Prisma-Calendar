# Recurring Events (DSL)

Define recurrence in frontmatter, for example:

```yaml
recurrence: "every week on Mon,Wed,Fri at 07:00 for 12 weeks"
```

- On plugin load/unload, future notes are generated up to your configured horizon (e.g., 50).
- Beyond that, virtual events appear as read-only.
