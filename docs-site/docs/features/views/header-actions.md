# Header Actions

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/PageHeaderActions.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/PageHeaderActions.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

Header actions are customizable shortcut buttons in the view header of your Prisma Calendar tab. They give you one-click access to any calendar command without memorizing hotkeys or navigating menus.

## Managing Header Actions

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video controls autoPlay loop muted playsInline style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}>
    <source src={useBaseUrl("/video/PageHeaderActionsManagement.webm")} type="video/webm" />
    <source src={useBaseUrl("/video/PageHeaderActionsManagement.mp4")} type="video/mp4" />
    Your browser does not support the video tag.
  </video>
</div>

Every aspect of header actions is fully customizable and all changes are persisted per calendar. You can rename actions, change their icons and colors, reorder them via drag-and-drop or arrow buttons, show or hide individual actions, and search through the full list to find exactly what you need.

## How It Works

When you open a Prisma Calendar view, the header bar displays a row of icon buttons. Each button triggers the same command as its corresponding [hotkey](../advanced/hotkeys.md) — every command registered by Prisma Calendar is available as a header action.

By default, a set of commonly used actions is shown — including event creation, navigation, search, statistics, category highlighting, undo/redo, refresh, and AI chat. The remaining actions are hidden but can be enabled at any time.

Header action state is persisted **per planning system** — each planning system remembers its own header configuration independently.

## Managing Actions

Click the **gear icon** (⚙) at the right end of the header bar to open the **Manage Header Actions** modal. From here you can:

### Search

A search bar at the top of the modal lets you quickly find any action by typing part of its name. Matching actions show their full edit controls (rename, icon, color, visibility toggle). Ordering controls are hidden while searching — clear the search to reorder.

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
