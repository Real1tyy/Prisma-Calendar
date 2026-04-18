// Central constants used across every e2e module. Importing from here —
// instead of redeclaring — keeps refactors of the plugin id or leaf-scoping
// selector a one-line change.

export const PLUGIN_ID = "prisma-calendar";
export const DEFAULT_CALENDAR_ID = "default";

// Multiple calendar views can be open in parallel tabs. Obsidian renders the
// inactive leaves' DOM but keeps them visually hidden, so a bare `.first()`
// match can land on an inactive tab's button. Scoping locators to the active
// workspace leaf keeps the click pointed at the view the user is looking at.
export const ACTIVE_CALENDAR_LEAF = ".workspace-leaf.mod-active";
