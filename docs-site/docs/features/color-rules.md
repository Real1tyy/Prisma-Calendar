# Color Rules

Make events visually meaningful by mapping frontmatter to colors.

## How it works

- Set a Default event color as a fallback
- Add Color rules that evaluate in order; the first match sets the color
- Reference frontmatter properties directly by name

Examples:

```text
Priority === 'High'         → #ef4444
Status === 'Done'           → #22c55e
Project === 'Work'          → hsl(210,70%,50%)
Type === 'Meeting'          → #f59e0b
```

## Real use cases

- Status pipeline: `Todo` (gray), `In Progress` (blue), `Blocked` (orange), `Done` (green)
- Contexts: `Work` vs `Personal` vs `Health` colors
- Risk highlighting: `High` priority in red

## Advanced Examples

```javascript
// Multiple conditions
Priority === 'High' && Status !== 'Done'         → #ef4444

// Array checks
Tags && Tags.includes('urgent')                   → #ef4444

// Numeric comparisons
Difficulty >= 8                                   → #f59e0b

// Nested conditions
Status === 'Active' && (Priority === 'High' || DueDate < new Date())  → #3b82f6
```

## Troubleshooting

- Rule order matters: put specific rules above general ones
- Expressions must be valid JavaScript; use property names directly
- Colors can be CSS names, hex (`#abc123`), or HSL (`hsl(...)`)
