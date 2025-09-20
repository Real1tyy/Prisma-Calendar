# Multiple Calendars

Separate contexts with dedicated configurations.

## Why multiple calendars?

- Keep Work and Personal events separate
- Use different color/filter rules for different projects
- Bind hotkeys to jump between calendars
- Create different "views" of the same event data using filters

## Typical setup

1. Create a Work calendar → Directory `Work/Calendar/`
2. Create a Personal calendar → Directory `Personal/Calendar/`
3. Add different color rules (e.g., Work blue, Personal purple)
4. Assign hotkeys to switch quickly

Limit: UI prevents exceeding the maximum allowed calendars.

## Advanced Usage: Creating Views

You can point multiple calendars to the same directory but use different filters and settings to create unique views of your data. For example, you could create a Kanban-style workflow:

1.  **To-Do Calendar**: Points to `Tasks/` and filters for files with `status: todo`.
2.  **In-Progress Calendar**: Points to the same `Tasks/` directory but filters for `status: in-progress`.
3.  **Done Calendar**: Also points to `Tasks/`, filtering for `status: done`.

Each calendar can have its own templates, color rules, and display settings, offering powerful ways to manage projects.

## Performance Considerations

The plugin currently supports up to 10 calendars. While technically more could be added, this limit is in place to ensure smooth performance, as each calendar adds indexing and filtering overhead.
