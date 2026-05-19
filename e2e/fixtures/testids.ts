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
	| "moveToCalendar"
	| "markDone"
	| "moveToNextWeek"
	| "cloneToNextWeek"
	| "moveToPreviousWeek"
	| "cloneToPreviousWeek"
	| "deleteEvent"
	| "skipEvent"
	| "openFile"
	| "openFileNewWindow"
	| "viewNameSeries"
	| "viewCategorySeries"
	| "viewRecurringSeries";

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
	| "markAsDone"
	| "breakMinutes"
	| "notify-before"
	| "rrule"
	| "rrule-type"
	| "custom-freq"
	| "custom-interval"
	| "rrule-until"
	| "future-instances-count"
	| "generate-past-events"
	| "preset"
	| "participants"
	| "virtual";

export type EventFieldKey = "title" | "categories" | "prerequisites" | "participants";

export type EventBtnKey =
	| "save"
	| "cancel"
	| "minimize"
	| "save-preset"
	| "assign-categories"
	| "assign-prerequisites"
	| "add-participant"
	| "add-custom-prop-other"
	| "add-custom-prop-display"
	| "remove-custom-prop-other"
	| "remove-custom-prop-display";

export type ToolbarKey =
	| "create"
	| "view-year"
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
export type ViewMode = "year" | "month" | "week" | "day" | "list";

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
	| "heatmap-monthly-stats"
	| "monthly-calendar-stats";

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
export const ACTION_MANAGER_RESET_BTN = "prisma-action-manager-reset";
/** Tabbed-container tab-manager modal parts. */
export const TABBED_CONTAINER_MANAGE_BTN = "prisma-tabbed-container-manage";
export const TAB_MANAGER_MODAL = "prisma-tab-manager-modal";
export const TAB_MANAGER_RESET_BTN = "prisma-tab-manager-reset";
/** Context-menu item-manager modal (shown via the menu's "Manage items…" entry). */
export const ITEM_MANAGER_MODAL = "prisma-item-manager-modal";
export const ITEM_MANAGER_RESET_BTN = "prisma-item-manager-reset";
/** Shared reset-to-defaults confirmation modal testIdPrefix (matches `ResetToDefaultsButton`). */
export const RESET_CONFIRMATION_TID_PREFIX = "prisma-reset-to-defaults-";
/** Generic assignment picker (used by Assign Categories / Assign Prerequisites). */
export const ASSIGN_MODAL_ROOT = ".prisma-assignment-modal";
/** Shared visual icon picker modal — opened when editing an icon in any manager. */
export const ICON_PICKER_GRID_TID = "shared-icon-picker-grid";
export const ICON_PICKER_SEARCH_TID = "shared-icon-picker-search";
export const ICON_PICKER_NO_ICON_TID = "shared-icon-picker-no-icon";
/** Plugin-agnostic shared confirmation modal (unprefixed by design). */
export const CONFIRMATION_MODAL_TID = "confirmation-modal-container";
export const CONFIRMATION_MODAL_CONFIRM_TID = "confirmation-modal-confirm";
export const CONFIRMATION_MODAL_CANCEL_TID = "confirmation-modal-cancel";
/** Plugin-agnostic shared rename modal (unprefixed by design). */
export const RENAME_MODAL_TID = "rename-modal-container";
export const RENAME_INPUT_TID = "rename-input";
export const RENAME_SUBMIT_TID = "rename-submit";
export const RENAME_CANCEL_TID = "rename-cancel";
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
	tabManagerRow: "prisma-tab-manager-row-",
	tabManagerUp: "prisma-tab-manager-up-",
	tabManagerToggle: "prisma-tab-manager-toggle-",
	tabManagerEdit: "prisma-tab-manager-edit-",
	tabManagerIconBtn: "prisma-tab-manager-icon-btn-",
	tabManagerRename: "prisma-tab-manager-rename-",
	itemManagerToggle: "prisma-item-manager-toggle-",
	itemManagerEdit: "prisma-item-manager-edit-",
	itemManagerIconBtn: "prisma-item-manager-icon-btn-",
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
	tabManagerRow: (id: string): string => `${SHARED_ROW_PREFIX.tabManagerRow}${id}`,
	tabManagerUp: (id: string): string => `${SHARED_ROW_PREFIX.tabManagerUp}${id}`,
	tabManagerToggle: (id: string): string => `${SHARED_ROW_PREFIX.tabManagerToggle}${id}`,
	tabManagerEdit: (id: string): string => `${SHARED_ROW_PREFIX.tabManagerEdit}${id}`,
	tabManagerIconBtn: (id: string): string => `${SHARED_ROW_PREFIX.tabManagerIconBtn}${id}`,
	tabManagerRename: (id: string): string => `${SHARED_ROW_PREFIX.tabManagerRename}${id}`,
	itemManagerToggle: (id: string): string => `${SHARED_ROW_PREFIX.itemManagerToggle}${id}`,
	itemManagerEdit: (id: string): string => `${SHARED_ROW_PREFIX.itemManagerEdit}${id}`,
	itemManagerIconBtn: (id: string): string => `${SHARED_ROW_PREFIX.itemManagerIconBtn}${id}`,
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

export const STOPWATCH_TIME_TID = "prisma-stopwatch-time";

/** Stopwatch action buttons (start/continue/pause/stop/resume). */
export type StopwatchBtnKey = "start" | "continue" | "pause" | "stop" | "resume";
export const stopwatchBtn = (key: StopwatchBtnKey): string => `prisma-stopwatch-btn-${key}`;

/** Slug used by the stopwatch's CollapsibleSection — passed to `collapsibleSection(page, ...)`. */
export const STOPWATCH_COLLAPSIBLE_SLUG = "time-tracker";

export const ICS_EXPORT_SUBMIT_TID = "prisma-ics-export-submit";
export const ICS_IMPORT_FILE_TID = "prisma-ics-import-file";
export const ICS_IMPORT_SUBMIT_TID = "prisma-ics-import-submit";

// ── Categories settings ────────────────────────────────────────────────────

export const CATEGORY_ROW_TID = "prisma-category-settings-item";
export const CATEGORY_RENAME_BTN_TID = "prisma-category-settings-rename-button";
export const CATEGORY_DELETE_BTN_TID = "prisma-category-settings-delete-button";
export const CATEGORY_COUNT_CLASS = "prisma-category-settings-count";

/** Test-id prefixes passed to shared rename / confirmation modals from the categories tab. */
export const CATEGORY_RENAME_PREFIX = "prisma-category-";
export const CATEGORY_DELETE_PREFIX = "prisma-category-delete-";

export const CATEGORY_INCLUDE_UNTRACKED_TOGGLE_TID = "prisma-category-include-untracked-toggle";

export const UNTRACKED_BUTTON_TID = "prisma-untracked-dropdown-button";
export const UNTRACKED_DROPDOWN_TID = "prisma-untracked-dropdown";
export const UNTRACKED_ITEM_TID = "prisma-untracked-dropdown-item";

// ── Cross-view + analytics surfaces ────────────────────────────────────────
// CSS-class anchors and `data-testid`s that show up across more than one
// spec. Keep raw selectors out of spec bodies — when the plugin renames a
// CSS hook these constants give us one edit point.

/** Timeline tab — individual item element. CSS class because the renderer doesn't stamp a testid. */
export const TIMELINE_ITEM_CLASS = ".prisma-timeline-item";
/** Timeline tab — root container `data-testid`. */
export const TIMELINE_CONTAINER_TID = "prisma-timeline-container";
/** Heatmap tab — container + cell testids. */
export const HEATMAP_CONTAINER_TID = "prisma-heatmap-container";
export const HEATMAP_CELL_TID = "prisma-heatmap-cell";
/** Dashboard ranking cell that hosts the per-title rows. */
export const DASHBOARD_RANKING_TID = "prisma-dashboard-cell-ranking";
/** Stats / placeholder containers. */
export const STATS_EMPTY_TID = "prisma-stats-empty";
export const STATS_DATE_LABEL_TID = "prisma-stats-date-label";

/** FullCalendar toolbar title (week-of label, etc.). */
export const FC_TOOLBAR_TITLE = ".fc-toolbar-title";
/** Prisma right-click context menu wrapper used by Obsidian. */
export const OBSIDIAN_MENU_ROOT = ".menu";

/** Connection-arrow overlay drawn between connected events on the calendar. */
export const CONNECTION_ARROW_TID = "prisma-connection-arrow";
/** Banner that appears while the prereq-selection workflow is active. */
export const PREREQ_SELECTION_BANNER_CLASS = ".prisma-prereq-selection-banner";

/** Pro-gate component testid template — call `proGate(area)` for the full id. */
export const proGate = (area: string): string => `prisma-pro-gate-${area}`;

/** Notice / toast container injected by Obsidian's Notice API. */
export const NOTICE_SELECTOR = ".notice-container .notice";

/** License-status row sub-elements (settings → general tab). */
export const LICENSE_ACTIVATIONS_BADGE_CLASS = ".prisma-license-activations-badge";

/** Virtual-events code-block renderer. */
export const VIRTUAL_EVENTS_BLOCK_CLASS = ".prisma-virtual-events-block";
export const VIRTUAL_EVENTS_TABLE_CLASS = ".prisma-virtual-events-table";

/** CalDAV integrations tab surfaces. */
export const CALDAV_MODAL_TID = "prisma-modal-caldav-add";
export const CALDAV_TEST_CONNECTION_TID = "prisma-caldav-test-connection";
export const CALDAV_PRESET_TID = "prisma-caldav-preset";
export const CALDAV_ADD_ACCOUNT_BTN_CLASS = ".prisma-caldav-add-account-button";
export const caldavField = (key: string): string => `prisma-caldav-add-control-${key}`;

/** Move-by modal sub-elements. */
export const MOVE_BY_MODAL_TID = "prisma-modal-move-by";
export const MOVE_BY_VALUE_TID = "prisma-move-by-value";
export const MOVE_BY_INCREMENT_TID = "prisma-move-by-increment";
export const MOVE_BY_DECREMENT_TID = "prisma-move-by-decrement";
export const MOVE_BY_TOGGLE_SIGN_TID = "prisma-move-by-toggle-sign";
export const moveByUnit = (unit: string): string => `prisma-move-by-unit-${unit}`;

/** Batch-frontmatter modal sub-elements. */
export const BATCH_FM_MODAL_TID = "prisma-modal-batch-frontmatter";
export const BATCH_FM_ROW_TID = "prisma-batch-property-row";
export const BATCH_FM_KEY_TID = "prisma-batch-property-key";
export const BATCH_FM_VALUE_TID = "prisma-batch-property-value";
export const BATCH_FM_REMOVE_TID = "prisma-batch-property-remove";
export const BATCH_FM_ADD_TID = "prisma-batch-add-property";
export const BATCH_FM_DELETION_MARKED_CLASS = "prisma-batch-frontmatter-marked-deletion";

/** Generic SchemaForm submit button used by every modal-form (move-by, batch-frontmatter, …). */
export const FORM_SUBMIT_TID = "prisma-form-submit";

/** Selector helpers — keep `data-event-title="…"` and friends out of spec bodies. */
export const eventTileByTitle = (title: string): string => `${sel(EVENT_BLOCK_TID)}[data-event-title="${title}"]`;
export const dashboardItemByTitle = (title: string): string => `[data-item-title="${title}"]`;

export const TID = {
	event: {
		control: (key: EventControlKey): string => `prisma-event-control-${key}`,
		field: (key: EventFieldKey): string => `prisma-event-field-${key}`,
		btn: (key: EventBtnKey): string => `prisma-event-btn-${key}`,
	},
	stopwatch: {
		time: STOPWATCH_TIME_TID,
		btn: stopwatchBtn,
		collapsibleSlug: STOPWATCH_COLLAPSIBLE_SLUG,
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
