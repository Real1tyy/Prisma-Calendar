const PLUGIN_ID = "prisma-calendar";
// Concurrency control for parallel file processing
// Higher values = faster initial scan but more memory/CPU usage
export const SCAN_CONCURRENCY = 10;

// Custom namespace UUID for Prisma Calendar events
// This ensures our event IDs are unique to this application
export const PRISMA_CALENDAR_NAMESPACE = "a8f9e6d4-7c2b-4e1a-9f3d-5b8c1a2e4d6f";

// Command IDs (without plugin prefix)
export const COMMAND_IDS = {
	CREATE_EVENT: "create-event",
	CREATE_EVENT_WITH_STOPWATCH: "create-event-with-stopwatch",
	EDIT_LAST_FOCUSED_EVENT: "edit-last-focused-event",
	SET_FOCUSED_EVENT_START_TO_NOW: "set-last-focused-event-start-to-now",
	SET_FOCUSED_EVENT_END_TO_NOW: "set-last-focused-event-end-to-now",
	FILL_FOCUSED_EVENT_START_FROM_PREVIOUS: "fill-last-focused-event-start-from-previous",
	FILL_FOCUSED_EVENT_END_FROM_NEXT: "fill-last-focused-event-end-from-next",
	SHOW_SKIPPED_EVENTS: "show-skipped-events",
	SHOW_RECURRING_EVENTS: "show-recurring-events",
	SHOW_FILTERED_EVENTS: "show-filtered-events",
	SHOW_UNTRACKED_EVENTS: "show-untracked-events",
	GLOBAL_SEARCH: "global-search",
	FOCUS_SEARCH: "focus-search",
	FOCUS_EXPRESSION_FILTER: "focus-expression-filter",
	OPEN_FILTER_PRESET_SELECTOR: "open-filter-preset-selector",
	UNDO: "undo",
	REDO: "redo",
	TOGGLE_BATCH_SELECTION: "toggle-batch-selection",
	BATCH_SELECT_ALL: "batch-select-all",
	BATCH_CLEAR_SELECTION: "batch-clear-selection",
	BATCH_DUPLICATE_SELECTION: "batch-duplicate-selection",
	BATCH_DELETE_SELECTION: "batch-delete-selection",
	BATCH_SKIP_SELECTION: "batch-skip-selection",
	BATCH_OPEN_SELECTION: "batch-open-selection",
	BATCH_CLONE_NEXT_WEEK: "batch-clone-next-week",
	BATCH_CLONE_PREV_WEEK: "batch-clone-prev-week",
	BATCH_MOVE_NEXT_WEEK: "batch-move-next-week",
	BATCH_MOVE_PREV_WEEK: "batch-move-prev-week",
	BATCH_MARK_AS_DONE: "batch-mark-as-done",
	BATCH_MARK_AS_NOT_DONE: "batch-mark-as-not-done",
	BATCH_ASSIGN_CATEGORIES: "batch-assign-categories",
	BATCH_UPDATE_FRONTMATTER: "batch-update-frontmatter",
	OPEN_CURRENT_NOTE_IN_CALENDAR: "open-current-note-in-calendar",
	SHOW_DAILY_STATS: "show-daily-stats",
	SHOW_WEEKLY_STATS: "show-weekly-stats",
	SHOW_MONTHLY_STATS: "show-monthly-stats",
	SHOW_ALLTIME_STATS: "show-alltime-stats",
	REFRESH_CALENDAR: "refresh-calendar",
	HIGHLIGHT_EVENTS_WITHOUT_CATEGORIES: "highlight-events-without-categories",
	HIGHLIGHT_EVENTS_WITH_CATEGORY: "highlight-events-with-category",
	RESTORE_MINIMIZED_MODAL: "restore-minimized-modal",
	EXPORT_CALENDAR_ICS: "export-calendar-ics",
	IMPORT_CALENDAR_ICS: "import-calendar-ics",
	SYNC_CALDAV: "sync-caldav",
	NAVIGATE_BACK: "navigate-back",
	SHOW_INTERVAL_BASES: "show-interval-bases",
	SCROLL_TO_NOW: "scroll-to-now",
} as const;

export const FULL_COMMAND_IDS = Object.fromEntries(
	Object.entries(COMMAND_IDS).map(([key, value]) => [key, `${PLUGIN_ID}:${value}`])
) as { [K in keyof typeof COMMAND_IDS]: `${typeof PLUGIN_ID}:${(typeof COMMAND_IDS)[K]}` };

export const SETTINGS_DEFAULTS = {
	// General Settings
	DEFAULT_DURATION_MINUTES: 60,
	DEFAULT_SHOW_DURATION_FIELD: true,
	DEFAULT_SHOW_STOPWATCH: true,
	DEFAULT_SHOW_STOPWATCH_START_WITHOUT_FILL: false,
	DEFAULT_CALENDAR_NAME: "Calendar",
	DEFAULT_EXPORT_FOLDER: "Prisma-Exports",
	DEFAULT_EVENT_COLOR: "hsl(270, 70%, 50%)",
	COMMANDS_HISTORY_LIMIT: 50,
	MAX_CALENDARS: 10,
	BASE_NAME: "calendar",
	SHOW_RIBBON_ICON: true,
	DEFAULT_ENABLE_KEYBOARD_NAVIGATION: true,

	DEFAULT_START_PROP: "Start Date",
	DEFAULT_END_PROP: "End Date",
	DEFAULT_DATE_PROP: "Date",
	DEFAULT_ALL_DAY_PROP: "All Day",
	DEFAULT_NORMALIZE_DATE_PROPERTY: "none",
	DEFAULT_TITLE_PROP: "Title",
	DEFAULT_ZETTEL_ID_PROP: "ZettelID",
	DEFAULT_SKIP_PROP: "Skip",
	DEFAULT_RRULE_PROP: "RRule",
	DEFAULT_RRULE_SPEC_PROP: "RRuleSpec",
	DEFAULT_RRULE_ID_PROP: "RRuleID",
	DEFAULT_SOURCE_PROP: "Source",
	DEFAULT_INSTANCE_DATE_PROP: "Recurring Instance Date",
	DEFAULT_STATUS_PROPERTY: "Status",
	DEFAULT_DONE_VALUE: "Done",
	DEFAULT_NOT_DONE_VALUE: "Not Done",
	DEFAULT_FUTURE_INSTANCES_COUNT_PROP: "Future Instances Count",
	DEFAULT_GENERATE_PAST_EVENTS_PROP: "Generate Past Events",
	DEFAULT_MINUTES_BEFORE_PROP: "Minutes Before",
	DEFAULT_DAYS_BEFORE_PROP: "Days Before",
	DEFAULT_ALREADY_NOTIFIED_PROP: "Already Notified",
	DEFAULT_CATEGORY_PROP: "Category",
	DEFAULT_BREAK_PROP: "Break",
	DEFAULT_IGNORE_RECURRING_PROP: "Ignore Recurring",
	DEFAULT_CALDAV_PROP: "CalDAV",

	// Notification Settings
	DEFAULT_ENABLE_NOTIFICATIONS: true,
	DEFAULT_NOTIFICATION_SOUND: false,
	DEFAULT_SNOOZE_MINUTES: 15,
	DEFAULT_SKIP_NEWLY_CREATED_NOTIFICATIONS: true,

	// Calendar Settings
	DEFAULT_FUTURE_INSTANCES_COUNT: 2,
	PROPAGATE_FRONTMATTER_TO_INSTANCES: false,
	ASK_BEFORE_PROPAGATING_FRONTMATTER: true,
	DEFAULT_EXCLUDED_RECURRING_PROPAGATED_PROPS: "",
	DEFAULT_PROPAGATION_DEBOUNCE_MS: 3000,
	DEFAULT_HOUR_START: 7,
	DEFAULT_HOUR_END: 23,
	DEFAULT_SLOT_DURATION_MINUTES: 30,
	DEFAULT_SNAP_DURATION_MINUTES: 30,
	DEFAULT_ZOOM_LEVELS: [1, 2, 3, 5, 10, 15, 20, 30, 45, 60],
	DEFAULT_EVENT_MAX_STACK: 1,
	DEFAULT_MOBILE_MAX_EVENTS_PER_DAY: 4,
	DEFAULT_SHOW_COLOR_DOTS: true,
	DEFAULT_PAST_EVENT_CONTRAST: 70,
	DEFAULT_EVENT_OVERLAP: true,
	DEFAULT_SLOT_EVENT_OVERLAP: true,
	DEFAULT_ENABLE_EVENT_PREVIEW: true,
	DEFAULT_NOW_INDICATOR: true,
	DEFAULT_HIGHLIGHT_UPCOMING_EVENT: true,
	DEFAULT_THICKER_HOUR_LINES: true,
	DEFAULT_DRAG_EDGE_SCROLL_DELAY_MS: 600,
	DEFAULT_DENSITY: "comfortable",
	DEFAULT_DEFAULT_VIEW: "dayGridMonth",
	DEFAULT_FIRST_DAY_OF_WEEK: 0,
	DEFAULT_SKIP_UNDERSCORE_PROPERTIES: true,
	DEFAULT_AGGREGATION_MODE: "name",
	DEFAULT_STICKY_DAY_HEADERS: true,
	DEFAULT_STICKY_ALL_DAY_EVENTS: false,
	DEFAULT_AUTO_ASSIGN_CATEGORY_BY_NAME: true,
} as const;

export const INTERNAL_FRONTMATTER_PROPERTIES = [
	"position", // Internal Obsidian property
] as const;

export const CALDAV_DEFAULTS = {
	SYNC_FOLDER: "CalDAV",
	SYNC_INTERVAL_MINUTES: 15,
	MAX_ACCOUNTS: 10,
} as const;

const BATCH_BUTTONS = {
	"Select All": "batchSelectAll",
	Clear: "batchClear",
	Duplicate: "batchDuplicate",
	"Move By": "batchMoveBy",
	"Mark as Done": "batchMarkAsDone",
	"Mark as Not Done": "batchMarkAsNotDone",
	Categories: "batchCategories",
	Frontmatter: "batchFrontmatter",
	"Clone Next": "batchCloneNext",
	"Clone Prev": "batchClonePrev",
	"Move Next": "batchMoveNext",
	"Move Prev": "batchMovePrev",
	"Open All": "batchOpenAll",
	Skip: "batchSkip",
	Delete: "batchDelete",
} as const;

export const BATCH_BUTTON_IDS = Object.values(BATCH_BUTTONS);

export const BATCH_BUTTON_LABELS = Object.fromEntries(
	Object.entries(BATCH_BUTTONS).map(([label, id]) => [id, label])
) as Record<string, string>;

export const DEFAULT_BATCH_ACTION_BUTTONS = BATCH_BUTTON_IDS.filter(
	(id) => !["batchMoveBy", "batchOpenAll", "batchMovePrev", "batchClonePrev", "batchFrontmatter"].includes(id)
);

const TOOLBAR_BUTTONS = {
	"Previous/Next": "prevNext",
	Today: "today",
	Now: "now",
	"Create Event": "createEvent",
	"Zoom Level": "zoomLevel",
	"Filter Presets": "filterPresets",
	"Search Input": "searchInput",
	"Expression Filter": "expressionFilter",
	"Untracked Events": "untrackedEvents",
} as const;

export const TOOLBAR_BUTTON_IDS = Object.values(TOOLBAR_BUTTONS);

export const TOOLBAR_BUTTON_LABELS = Object.fromEntries(
	Object.entries(TOOLBAR_BUTTONS).map(([label, id]) => [id, label])
) as Record<string, string>;

export const DEFAULT_TOOLBAR_BUTTONS = TOOLBAR_BUTTON_IDS;

export const CONTEXT_MENU_BUTTON_LABELS = {
	enlarge: "Enlarge",
	preview: "Preview",
	goToSource: "Go to source",
	duplicateRecurringInstance: "Duplicate recurring instance",
	viewRecurringEvents: "View recurring events",
	editEvent: "Edit event",
	assignCategories: "Assign categories",
	duplicateEvent: "Duplicate event",
	moveBy: "Move by...",
	markDone: "Mark as done/undone",
	moveToNextWeek: "Move to next week",
	cloneToNextWeek: "Clone to next week",
	moveToPreviousWeek: "Move to previous week",
	cloneToPreviousWeek: "Clone to previous week",
	fillStartTimeNow: "Fill start time from current time",
	fillEndTimeNow: "Fill end time from current time",
	fillStartTimePrevious: "Fill start time from previous event",
	fillEndTimeNext: "Fill end time from next event",
	deleteEvent: "Delete event",
	skipEvent: "Skip event",
	openFile: "Open file",
	openFileNewWindow: "Open file in new window",
	toggleRecurring: "Enable/Disable recurring event",
} as const;

export const CONTEXT_MENU_ITEM_IDS = Object.keys(
	CONTEXT_MENU_BUTTON_LABELS
) as (keyof typeof CONTEXT_MENU_BUTTON_LABELS)[];

export const DEFAULT_CONTEXT_MENU_ITEMS = CONTEXT_MENU_ITEM_IDS;

/**
 * Maximum time after an event starts before notifications are suppressed.
 * Prevents notification spam when opening Obsidian after being away.
 *
 * - Timed events: 5 hours (covers a typical work session)
 * - All-day events: 1 day (gives grace period for same-day events)
 */
export const MAX_PAST_NOTIFICATION_THRESHOLD = {
	TIMED_EVENTS_MS: 5 * 60 * 60 * 1000, // 5 hours in milliseconds
	ALL_DAY_EVENTS_MS: 24 * 60 * 60 * 1000, // 1 day in milliseconds
} as const;
