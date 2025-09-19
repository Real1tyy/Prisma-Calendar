# Filtering

Dynamically filter which events appear on your calendar using powerful, frontmatter-based expressions. This allows you to create custom views that show only what's relevant to you at any given moment.

## How it Works: Single Expression Per Calendar

Each calendar has **one filter expression** in its settings. This expression uses standard JavaScript logic to determine which events are displayed.

-   **Expressions use `fm`** to access frontmatter properties (e.g., `fm.Status`, `fm.Priority`).
-   **An event is displayed only if the expression evaluates to `true`.**
-   **Use `&&` (AND) and `||` (OR)** to combine multiple conditions as needed.

## Building Complex Filters with JavaScript Logic

You can create sophisticated filtering logic using standard JavaScript operators. Here are some examples:

### Simple Filters
```javascript
// Show only high-priority items
fm.Priority === 'High'

// Show everything except completed tasks
fm.Status !== 'Done'

// Show items tagged with 'urgent'
fm.Tags && fm.Tags.includes('urgent')
```

### Complex Filters with AND/OR Logic
```javascript
// High-priority active tasks for Project Phoenix
fm.Project === 'Project Phoenix' && fm.Priority === 'High' && fm.Status !== 'Done'

// Show urgent items OR high-priority work items
(fm.Tags && fm.Tags.includes('urgent')) || (fm.Priority === 'High' && fm.Category === 'Work')

// Show active tasks from multiple projects
(fm.Project === 'Phoenix' || fm.Project === 'Atlas') && fm.Status !== 'Done'

// Complex conditional logic
fm.Status === 'Active' && (fm.Priority === 'High' || (fm.DueDate && new Date(fm.DueDate) < new Date()))
```

The filter expression is **fully flexible** - you can combine as many conditions as needed using JavaScript's logical operators.

## When to Use Multiple Calendars for Different Views

Multiple calendars provide the ultimate flexibility for viewing the same data in different contexts. This is perfect when you want to apply different filters to create distinct views.

-   **Use Complex Single Expressions When...** you want one comprehensive filter that shows exactly what you need in a single calendar view.

-   **Use Multiple Calendars When...** you want to create different contextual views of the same or overlapping data sources:
    -   A "Work Focus" calendar with filter: `fm.Category === 'Work' && fm.Status !== 'Done'`
    -   An "Urgent Tasks" calendar with filter: `fm.Priority === 'High' || (fm.Tags && fm.Tags.includes('urgent'))`
    -   A "This Week" calendar with filter: `new Date(fm.DueDate) <= new Date(Date.now() + 7*24*60*60*1000)`

Each calendar can scan the same folders but apply different filters, colors, and display settings. You can then toggle the visibility of these different views on your main calendar. This approach lets you see the same data through multiple lenses without losing context.

## Troubleshooting

-   **Check your logic**: If an event is unexpectedly hidden, verify that your filter expression logic is correct. Use parentheses to group conditions clearly.
-   **Use strict equality**: Use `===` for strict equality checks and `!==` for inequality.
-   **Handle missing properties**: If a property might not exist, your expression should account for it. For example, `fm.Tags && fm.Tags.includes('urgent')` checks if `fm.Tags` exists before trying to check its contents.
-   **Expressions must be valid JavaScript**: Invalid expressions will be ignored and logged to the developer console. Check the console if your filter isn't working as expected.
