# Bases

Configure the appearance and content of Bases views throughout Prisma Calendar.

- **View type**: Choose the default view layout for all Bases views. Options:
  - **Cards** (Recommended): Displays events as visual cards in a grid layout
  - **Table**: Displays events in a sortable table with columns
  - **List**: Displays events in a simple list format

- **Additional properties**: Comma-separated list of property names to include as additional columns in Bases views (e.g., `priority, project, tags`)

## Where Bases Views Are Used

These configured settings apply to all Bases views:

1. **Event Series Modal**: When clicking Table/List/Cards buttons in the Bases footer of the Event Series Modal (filters by recurring event, name series, or category)
2. **Category Events View**: When clicking on a category in Settings → Categories
3. **Current Interval View**: When using the "Show current interval in Bases" command (daily, weekly, or monthly views)

:::warning Sort date property required for interval views

The **Current Interval View** filters events by the **Sort date property**. This property is only populated when **Sorting normalization** is set to a strategy other than "None" (the default). If it's "None", the command will show an empty view.

**To fix this**, go to Settings → Properties → Sorting normalization and select a strategy (recommended: **All events — start datetime**). See [Sorting Normalization for External Tools](./properties.md#sorting-normalization-for-external-tools) for all available modes.
:::

## Default Columns

All Bases views include these columns by default:
- **File name**: Link to the event note
- **Date property**: The configured date/time property (sorted by this column)
- **Status**: Current event status

## Custom Columns

Properties you add to "Additional properties" appear after the default columns. Common examples:

- **priority**: Show event importance (e.g., High, Medium, Low)
- **project**: Group events by project
- **tags**: Display event tags or categories
- **duration**: Show event length
- **location**: Display event location
- **attendees**: List event participants

**See Also**:
- [Event Series Bases Integration](../features/events/event-groups.md#bases-view-integration) for viewing event series in Bases
- [Hotkeys documentation](../features/advanced/hotkeys.md#show-current-interval-in-bases) for using the "Show current interval in Bases" command
- [Categories documentation](../features/organization/categories.md) for category-based Bases views
