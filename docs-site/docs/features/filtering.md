# Filtering

Dynamically filter which events appear on your calendar using powerful, frontmatter-based expressions. This allows you to create custom views that show only what's relevant to you at any given moment.

## How it Works: Single Expression Per Calendar

Each calendar has **one filter expression** in its settings. This expression uses standard JavaScript logic to determine which events are displayed.

-   **Reference frontmatter properties directly by name** (e.g., `Status`, `Priority`).
-   **An event is displayed only if the expression evaluates to `true`.**
-   **Use `&&` (AND) and `||` (OR)** to combine multiple conditions as needed.

## Building Complex Filters with JavaScript Logic

You can create sophisticated filtering logic using standard JavaScript operators. Here are some examples:

### Simple Filters
```javascript
// Show only high-priority items
Priority === 'High'

// Show everything except completed tasks
Status !== 'Done'

// Show items tagged with 'urgent'
Tags && Tags.includes('urgent')
```

### Complex Filters with AND/OR Logic
```javascript
// High-priority active tasks for Project Phoenix
Project === 'Project Phoenix' && Priority === 'High' && Status !== 'Done'

// Show urgent items OR high-priority work items
(Tags && Tags.includes('urgent')) || (Priority === 'High' && Category === 'Work')

// Show active tasks from multiple projects
(Project === 'Phoenix' || Project === 'Atlas') && Status !== 'Done'

// Complex conditional logic
Status === 'Active' && (Priority === 'High' || (DueDate && new Date(DueDate) < new Date()))
```

The filter expression is **fully flexible** - you can combine as many conditions as needed using JavaScript's logical operators.

## Using Multiple Calendars with Different Filters

Multiple calendars provide flexibility for viewing different event sources. **Each calendar must use its own separate directory** to have independent filter settings.

**✅ CORRECT: Separate Directories for Different Filters**
```
Calendar "Work Tasks":
  Directory: work/
  Filter: Status !== 'Done'

Calendar "Personal Events":
  Directory: personal/
  Filter: Priority === 'High'

Calendar "Project Deadlines":
  Directory: projects/
  Filter: Type === 'deadline'
```

**❌ INCORRECT: Same Directory with Different Filters**
```
Calendar "Active Tasks":
  Directory: tasks/
  Filter: fm.Status !== 'Done'

Calendar "All Tasks":
  Directory: tasks/        ← Will NOT work!
  Filter: (no filter)      ← Will use first calendar's filter!
```

**Why?** Calendars sharing a directory share the same indexer and parser, which means they **must use the FIRST calendar's filter settings**. You cannot create different "filtered views" of the same directory.

**Workaround:** If you need different views of the same event set:
- Use a single comprehensive filter expression with AND/OR logic
- Use color rules to differentiate event types visually
- Or organize events into separate directories by type/status

## Filter Presets

For frequently used filters, you can create **named presets** in the settings. These presets appear in a dropdown in the calendar toolbar for quick access:

1. Go to Settings → Rules → Filter Presets
2. Click "Add Preset"
3. Enter a name (e.g., "Done Tasks")
4. Enter the filter expression (e.g., `Status === 'Done'`)

The preset dropdown appears next to the zoom button with a "Clear" option to reset the filter.

## Troubleshooting

-   **Check your logic**: If an event is unexpectedly hidden, verify that your filter expression logic is correct. Use parentheses to group conditions clearly.
-   **Use strict equality**: Use `===` for strict equality checks and `!==` for inequality.
-   **Handle missing properties**: If a property might not exist, your expression should account for it. For example, `Tags && Tags.includes('urgent')` checks if `Tags` exists before trying to check its contents.
-   **Expressions must be valid JavaScript**: Invalid expressions will be ignored and logged to the developer console. Check the console if your filter isn't working as expected.
