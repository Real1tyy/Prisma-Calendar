# Categories

Organize and visualize your events using categories. Categories provide a powerful way to group events, apply colors, and analyze how you spend your time.

## Overview

Categories allow you to:
- **Group related events** - Organize events by project, context, or any classification system
- **Apply visual colors** - Each category gets its own color for easy identification on the calendar
- **Track time distribution** - See how much time you spend on different categories with built-in statistics
- **Filter and search** - Quickly find all events in a specific category

## Setting Up Categories

### Category Property Configuration

First, configure the category property in your calendar settings:

1. Go to **Settings → [Your Calendar] → Properties**
2. Set the **Category property** field (default: `Category`)
3. This property will be used to read and write categories in your event frontmatter

### Category Format

Categories can be specified in your event frontmatter in two formats:

```yaml
# Single category
Category: Work

# Multiple categories (YAML array)
Category:
  - Work
  - Meeting
  - Important
```

Both formats are supported throughout the plugin. When you assign categories using the UI, they're automatically saved in the appropriate format.

## Assigning Categories

You can assign categories to events in multiple ways:

### 1. Auto-Assignment (New Event Creation)

Categories can be automatically assigned when creating new events based on the event name. When you finish typing the event title and move to another field, the system checks if the title matches any auto-assignment rules and replaces the categories accordingly.

Configure in **Settings → Categories → Auto-assign categories**:

#### Auto-assign when name matches category
When enabled, if the event name matches a category name (case-insensitive, ignoring ZettelID and instance dates), that category will be automatically assigned when you finish typing the title.

**Example:**
- Type "Health" and click away → Categories replaced with "health"

#### Custom category assignment presets
Define custom rules to automatically assign specific categories based on event names. Each preset can assign multiple categories. When the event name matches a preset, those categories replace any previously selected categories.

**Example:**
- Event name: "Coding" → Replaces with: Software, Business
- Event name: "Team Meeting" → Replaces with: Work, Collaboration

**How it works:**
- When you finish typing the event title (lose focus from the title field), the system checks for matches
- If a match is found, categories are replaced with the auto-assigned ones
- If no match is found, your manually selected categories remain unchanged
- This makes the behavior intentional and predictable - you see exactly what gets assigned
- Only applies during event creation, not when editing existing events
- Perfect for quick event creation workflows with consistent naming patterns

### 2. Individual Events (Manual)

Edit the event note directly and add the category property:

```yaml
---
Category: Work
Start: 2025-01-15T09:00:00
End: 2025-01-15T10:00:00
---
```

### 3. Event Context Menu

Click on any event in the calendar and select **"Assign Categories"** from the context menu. This opens the category assignment modal with the event's current categories pre-selected.

### 4. Event Modal (Create/Edit)

When creating or editing an event, use the **"Assign Categories"** button in the modal. Categories are displayed with their configured colors, and you can modify them before saving the event.

### 5. Batch Assignment

Select multiple events in batch mode and use the **"Categories"** button to assign categories to all selected events at once.

📖 See [Batch Operations](/features/batch-operations#assign-categories) for detailed batch assignment instructions.

## Category Assignment Modal

All category assignment interfaces share the same powerful modal:

- **Multi-select with search** - Filter and select multiple categories simultaneously
- **Pre-selected categories** - Current event categories are automatically checked
- **Create new categories** - Type a non-existent category name and click "Create New" to add it on the fly with the default event color
- **Color indicators** - Each category displays its configured color from Settings → Categories
- **Override behavior** - Assigned categories completely replace existing categories (doesn't merge)
- **Remove all categories** - Uncheck all categories and click "Remove Categories" to clear categories
- **Full undo support** - Restores previous category state (batch operations only)
- **Keyboard navigation** - Press Enter to select the first filtered category when searching, or press Enter again to submit the form

![Assign Categories Modal](/img/assign_categories_modal.png)

### Keyboard Shortcuts

The category modal supports full keyboard navigation for faster workflows:

- **Enter (with search text)**: Selects the first filtered category and clears the search
- **Enter (empty search)**: Submits the form with currently selected categories
- **Escape**: Closes the modal

**Example workflow:**
1. Type "Uni" in the search → Press Enter → "University" category is selected and search clears
2. Press Enter again → Form submits with "University" selected

## Managing Category Colors

### Visual Category Management

The **Categories Settings** page (Settings → Categories) provides a convenient interface for managing category colors:

1. **Automatic Detection** - All categories from your events are automatically detected and listed
2. **Event Counts** - See how many events use each category
3. **Color Pickers** - Click the color swatch next to any category to change its color
4. **Pie Chart Visualization** - View category distribution with an interactive pie chart
5. **Real-time Updates** - Changes are reflected immediately on the calendar

![Categories Settings](/img/categories_settings.png)

![Categories Settings Pie Chart](/img/categories_settings_pie_chart.png)

### How Category Colors Work

Behind the scenes, category colors are stored as color rules using expressions like `Category.includes('Work')`. This means:

- Category colors integrate seamlessly with the color rules system
- You can manually create category color rules if needed
- Category colors follow the same priority system as other color rules

📖 See [Color Rules](/features/color-rules#category-color-management) for more details on the underlying color system.

## Viewing Events by Category

Click on any category to open a **Bases table view** showing all events with that category. This works in two places:

### 1. Event Modal

Click any category badge in the event creation/edit modal to view all events with that category.

### 2. Settings → Categories

Click any category name in the categories settings page to view all events with that category.

### Category View Features

The category view displays:

- **Filtered Events** - All events in that category from your events folder
- **Smart Columns** - File name, date property, status, and any additional properties configured in Bases view properties setting
- **Newest First** - Events sorted by the configured date property from newest to oldest
- **Customizable Columns** - Add additional frontmatter properties as columns via Settings → Properties → Bases view properties
- **Full Bases Integration** - Complete Bases functionality for filtering, sorting, and viewing event details

![Category Bases View](/img/category_bases_view.png)

This provides a quick way to see all events in a specific category without manually filtering the calendar view. You can:

- Click on any event to open its note
- Sort by any column
- Use Bases features to further filter or analyze the events
- See all event properties in a structured table format

**Configuring Additional Columns:**

To add more properties as columns in the category events view:

1. Go to **Settings → Properties**
2. Find **Bases view properties**
3. Enter comma-separated property names (e.g., `priority, project, tags`)
4. These properties will appear as additional columns when viewing events by category

## Category Statistics

Categories integrate with the statistics system to show time distribution:

1. Go to **Statistics** in the calendar toolbar
2. Switch to **Category** aggregation mode
3. View time spent on each category with pie charts and detailed tables

![Weekly Statistics by Category](/img/weekly_stats_pie_category.png)

Categories with the **Break property** configured will have break time subtracted from the total duration in statistics.

📖 See [Statistics](/features/statistics) for more details on time tracking and analysis.

## Related Features

- **[Color Rules](/features/color-rules)** - Understanding the color system that powers category colors
- **[Batch Operations](/features/batch-operations#assign-categories)** - Assigning categories to multiple events at once
- **[Statistics](/features/statistics)** - Analyzing time spent on different categories
- **[Filtering](/features/filtering)** - Filtering events by category expressions
