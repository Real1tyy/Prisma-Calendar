# Color Rules

Make events visually meaningful by mapping frontmatter to colors.

## How it works

- Set a Default event color as a fallback
- Add Color rules that evaluate in order; the first match sets the color
- Expressions use `fm` to access frontmatter

Examples:

```text
fm.Priority === 'High'         → #ef4444
fm.Status === 'Done'           → #22c55e
fm.Project === 'Work'          → hsl(210,70%,50%)
fm.Type === 'Meeting'          → #f59e0b
```

## Real use cases

- Status pipeline: `Todo` (gray), `In Progress` (blue), `Blocked` (orange), `Done` (green)
- Contexts: `Work` vs `Personal` vs `Health` colors
- Risk highlighting: `High` priority in red

## Troubleshooting

- Rule order matters: put specific rules above general ones
- Expressions must be valid JS; use `fm` and proper quotes
- Colors can be CSS names, hex (`#abc123`), or HSL (`hsl(...)`)
