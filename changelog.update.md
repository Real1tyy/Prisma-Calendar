### Added

- **Separate icon and text colors**: the edit form for tabs (including subgroup tabs), header actions, and context menu items now has two color controls — *icon color* tints the glyph, *text color* tints the label — each with its own reset. See [Tabbed Views → Tab Icons and colors](./features/views/tabbed-views.md#tab-icons-and-colors).

### Fixed

- **"No icon" now removes a tab's icon**: selecting **No icon** in the tab manager's icon picker previously snapped the tab back to its default icon instead of clearing it; it now leaves the tab showing label text only, with the reset button restoring the default.
