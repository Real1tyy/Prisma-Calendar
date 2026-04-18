// Single source of truth for every `data-testid` stamped by plugin source.
// Specs import `TID.*` instead of splicing `prisma-*` strings by hand. When
// the plugin renames a test-id, updating the matching entry here recompiles
// every consumer — TypeScript catches the breakage at build time, not as a
// flaky runtime selector miss.
//
// Key types are string-literal unions. New ids get added here and the plugin
// source simultaneously; if a spec tries to address an unknown id it fails
// to compile.

export type ContextMenuItemKey =
	| "enlarge"
	| "preview"
	| "editEvent"
	| "assignCategories"
	| "assignPrerequisites"
	| "duplicateEvent"
	| "moveBy"
	| "markDone"
	| "moveToNextWeek"
	| "cloneToNextWeek"
	| "moveToPreviousWeek"
	| "cloneToPreviousWeek"
	| "deleteEvent"
	| "skipEvent"
	| "openFile"
	| "openFileNewWindow";

export type EventControlKey =
	| "title"
	| "allDay"
	| "start"
	| "end"
	| "date"
	| "duration"
	| "location"
	| "icon"
	| "skip"
	| "breakMinutes"
	| "notify-before"
	| "rrule"
	| "rrule-type"
	| "custom-freq"
	| "custom-interval"
	| "preset"
	| "participants";

export type EventFieldKey = "title" | "categories" | "prerequisites" | "participants";

export type EventBtnKey =
	| "save"
	| "cancel"
	| "minimize"
	| "assign-categories"
	| "assign-prerequisites"
	| "add-custom-prop-other";

export type ToolbarKey =
	| "create"
	| "view-month"
	| "view-week"
	| "view-day"
	| "view-list"
	| "next"
	| "prev"
	| "today"
	| "goto-now"
	| "batch-select"
	| "batch-exit";

/** Calendar "view mode" for FullCalendar — picks the toolbar view-<mode> button. */
export type ViewMode = "month" | "week" | "day" | "list";

/**
 * Page-header toolbar action ids. Every entry in `buildPageHeaderActions()`
 * stamps a `data-testid="prisma-toolbar-<id>"` on its button. Specs reach for
 * these via `calendar.clickToolbar(id)`.
 */
export type ToolbarActionKey =
	| "create-event"
	| "create-untracked"
	| "go-to-today"
	| "scroll-to-now"
	| "navigate-back"
	| "navigate-forward"
	| "global-search"
	| "toggle-batch"
	| "daily-stats"
	| "weekly-stats"
	| "monthly-stats"
	| "alltime-stats"
	| "toggle-prerequisites"
	| "refresh"
	| "show-recurring";

/**
 * Analytics view-tab ids stamped as `data-testid="prisma-view-tab-<id>"`.
 * Leaf tabs (calendar / timeline / heatmap / gantt / …) activate directly;
 * group tabs (`dashboard`) open a dropdown whose children use the same
 * testid pattern — see `switchToGroupChild`.
 */
export type ViewTabKey =
	| "calendar"
	| "timeline"
	| "heatmap"
	| "gantt"
	| "dashboard"
	| "dashboard-by-name"
	| "dashboard-by-category"
	| "dashboard-recurring"
	| "daily-stats"
	| "dual-daily"
	| "heatmap-monthly-stats";

export type BatchBtnKey =
	| "select-all"
	| "clear"
	| "duplicate"
	| "move-by"
	| "mark-done"
	| "mark-not-done"
	| "categories"
	| "frontmatter"
	| "clone-next"
	| "clone-prev"
	| "move-next"
	| "move-prev"
	| "open-all"
	| "skip"
	| "make-virtual"
	| "make-real"
	| "delete";

export const EVENT_BLOCK_TID = "prisma-cal-event";
export const BATCH_COUNTER_TID = "prisma-cal-batch-counter";
export const BATCH_CONFIRM_TID = "prisma-batch-confirm-submit";

// ── Shared-library testids ─────────────────────────────────────────────────
// The shared/ package stamps its own testids, distinct from the Prisma-Calendar
// family above. Every `prisma-` here was added by the shared component, not
// by plugin code — renaming any of them would require a shared-library update
// and an audit across every plugin that consumes it.

/** Page header manage-actions modal — sub-parts keyed off the host `prisma-page-header-*` root. */
export const PAGE_HEADER_MANAGE_BTN = "prisma-page-header-manage";
export const ACTION_MANAGER_MODAL = "prisma-action-manager-modal";
/** Tabbed-container tab-manager modal parts. */
export const TABBED_CONTAINER_MANAGE_BTN = "prisma-tabbed-container-manage";
export const TAB_MANAGER_MODAL = "prisma-tab-manager-modal";
/** Context-menu item-manager modal (shown via the menu's "Manage items…" entry). */
export const ITEM_MANAGER_MODAL = "prisma-item-manager-modal";
/** Generic assignment picker (used by Assign Categories / Assign Prerequisites). */
export const ASSIGN_MODAL_ROOT = ".prisma-assignment-modal";
/** Plugin-agnostic shared confirmation modal (unprefixed by design). */
export const CONFIRMATION_MODAL_TID = "confirmation-modal";
export const CONFIRMATION_MODAL_CONFIRM_TID = "confirmation-modal-confirm";
export const CONFIRMATION_MODAL_CANCEL_TID = "confirmation-modal-cancel";
/** Shared progress modal used by ICS import and other batched flows. */
export const PROGRESS_MODAL_TID = "prisma-progress-modal";
export const PROGRESS_STATUS_TID = "prisma-progress-status";
export const PROGRESS_BAR_TID = "prisma-progress-bar";
export const PROGRESS_DETAILS_TID = "prisma-progress-details";

/**
 * Row-ID-scoped shared testids. Each function returns the full testid for a
 * specific row inside its manager/component. Using these instead of inlining
 * template strings means a shared-library rename only needs one edit here.
 */
/** Prefix constants for shared-library row testids — useful for "list every row" queries. */
export const SHARED_ROW_PREFIX = {
	actionRow: "prisma-action-manager-row-",
	actionUp: "prisma-action-manager-up-",
	actionToggle: "prisma-action-manager-toggle-",
	tabManagerUp: "prisma-tab-manager-up-",
	tabManagerToggle: "prisma-tab-manager-toggle-",
	tabManagerRename: "prisma-tab-manager-rename-",
	itemManagerToggle: "prisma-item-manager-toggle-",
	collapsibleHeader: "prisma-collapsible-header-",
	collapsibleBody: "prisma-collapsible-body-",
	collapsibleToggle: "prisma-collapsible-toggle-",
	pageHeaderToolbar: "prisma-toolbar-",
	viewTab: "prisma-view-tab-",
} as const;

export const sharedTID = {
	actionRow: (id: string): string => `${SHARED_ROW_PREFIX.actionRow}${id}`,
	actionUp: (id: string): string => `${SHARED_ROW_PREFIX.actionUp}${id}`,
	actionToggle: (id: string): string => `${SHARED_ROW_PREFIX.actionToggle}${id}`,
	tabManagerUp: (id: string): string => `${SHARED_ROW_PREFIX.tabManagerUp}${id}`,
	tabManagerToggle: (id: string): string => `${SHARED_ROW_PREFIX.tabManagerToggle}${id}`,
	tabManagerRename: (id: string): string => `${SHARED_ROW_PREFIX.tabManagerRename}${id}`,
	itemManagerToggle: (id: string): string => `${SHARED_ROW_PREFIX.itemManagerToggle}${id}`,
	collapsibleHeader: (id: string): string => `${SHARED_ROW_PREFIX.collapsibleHeader}${id}`,
	collapsibleBody: (id: string): string => `${SHARED_ROW_PREFIX.collapsibleBody}${id}`,
	collapsibleToggle: (id: string): string => `${SHARED_ROW_PREFIX.collapsibleToggle}${id}`,
	assignSearch: (): string => "prisma-assign-search",
	assignItem: (): string => "prisma-assign-item",
	assignCreateNew: (): string => "prisma-assign-create-new",
	assignSubmit: (): string => "prisma-assign-submit",
} as const;

// ── Plugin-specific integration + filter + stopwatch + ICS testids ──────────
// These aren't "shared" — they live in Prisma source — but they're referenced
// outside the existing TID families, so collect them here so specs don't
// scatter raw literals across suites.

export const FILTER_SEARCH_TID = "prisma-filter-search";
export const FILTER_EXPRESSION_TID = "prisma-filter-expression";
export const FILTER_PRESET_TID = "prisma-filter-preset";
export const FC_FILTER_PRESET_SELECT_TID = "prisma-fc-filter-preset-select";

export const STOPWATCH_TIME_TID = "prisma-stopwatch-time";

export const ICS_EXPORT_SUBMIT_TID = "prisma-ics-export-submit";
export const ICS_IMPORT_FILE_TID = "prisma-ics-import-file";
export const ICS_IMPORT_SUBMIT_TID = "prisma-ics-import-submit";

export const UNTRACKED_BUTTON_TID = "prisma-untracked-dropdown-button";
export const UNTRACKED_DROPDOWN_TID = "prisma-untracked-dropdown";
export const UNTRACKED_ITEM_TID = "prisma-untracked-dropdown-item";

export const TID = {
	event: {
		control: (key: EventControlKey): string => `prisma-event-control-${key}`,
		field: (key: EventFieldKey): string => `prisma-event-field-${key}`,
		btn: (key: EventBtnKey): string => `prisma-event-btn-${key}`,
	},
	toolbar: (key: ToolbarKey): string => `prisma-cal-toolbar-${key}`,
	/** Page-header toolbar action (create-event, daily-stats, refresh, …). */
	pageHeader: (key: ToolbarActionKey): string => `prisma-toolbar-${key}`,
	/** Analytics view tab — leaf or group child. */
	viewTab: (key: ViewTabKey): string => `prisma-view-tab-${key}`,
	batch: (key: BatchBtnKey): string => `prisma-cal-batch-${key}`,
	batchCounter: BATCH_COUNTER_TID,
	batchConfirm: BATCH_CONFIRM_TID,
	ctxMenu: (key: ContextMenuItemKey): string => `prisma-context-menu-item-${key}`,
	ribbon: (calendarId: string): string => `prisma-ribbon-open-${calendarId}`,
	block: EVENT_BLOCK_TID,
} as const;

/** CSS attribute selector for a testid, e.g. `sel("prisma-cal-event")` → `[data-testid="prisma-cal-event"]`. */
export function sel(testId: string): string {
	return `[data-testid="${testId}"]`;
}
