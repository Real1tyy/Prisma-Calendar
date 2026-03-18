# Header Actions

Header actions are customizable shortcut buttons in the view header of your Prisma Calendar tab. They give you one-click access to any calendar command without memorizing hotkeys or navigating menus.

## How It Works

When you open a Prisma Calendar view, the header bar displays a row of icon buttons. Each button triggers the same command as its corresponding [hotkey](../advanced/hotkeys.md) — every command registered by Prisma Calendar is available as a header action.

By default, 19 commonly used actions are shown (event creation, navigation, search, statistics, category highlighting, undo/redo, AI chat, and more). The remaining 35+ actions are hidden but can be enabled at any time.

Header action state is persisted **per calendar** — each calendar bundle remembers its own header configuration independently.

## Managing Actions

Click the **gear icon** (⚙) at the right end of the header bar to open the **Manage Header Actions** modal. From here you can:

### Show and Hide

Each action has an **eye toggle**. Click it to show or hide the action in the header. Hidden actions appear dimmed in the manager but remain available to re-enable at any time.

### Reorder

Drag actions using the **grip handle** (⠿) on the left, or use the **up/down arrow buttons** to nudge actions one position at a time. The order in the manager matches the left-to-right order in the header.

### Rename

Click the **pencil icon** on any action to change its display label. The custom label appears as the button tooltip on hover. Renaming only affects the display — the underlying command is unchanged.

### Change Icon

In the edit form (opened via the pencil icon), click the icon picker to choose from Obsidian's full icon set. The new icon replaces the default on that header button.

### Change Color

Use the color picker in the edit form to assign a custom color to any button. Useful for visually grouping related actions (e.g., statistics in one color, batch operations in another).

### Toggle Settings Button

The "Show settings button" toggle at the top controls whether the gear icon itself is visible. If hidden, you can still access the manager via the command palette: **Prisma Calendar: Toggle page header settings**.

## Persistence

All customizations — visible actions, order, renames, icon and color overrides — save automatically to your calendar's settings. Deleting the `pageHeaderState` field from your config resets the header to the 19 defaults.
