export const PLUGIN_ID = "prisma-calendar";
// Concurrency control for parallel file processing
// Higher values = faster initial scan but more memory/CPU usage
export const SCAN_CONCURRENCY = 10;

// Command IDs (without plugin prefix)
export const COMMAND_IDS = {
	SHOW_SKIPPED_EVENTS: "show-skipped-events",
	SHOW_DISABLED_RECURRING_EVENTS: "show-disabled-recurring-events",
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
} as const;

export const FULL_COMMAND_IDS = Object.fromEntries(
	Object.entries(COMMAND_IDS).map(([key, value]) => [key, `${PLUGIN_ID}:${value}`])
) as { [K in keyof typeof COMMAND_IDS]: `${typeof PLUGIN_ID}:${(typeof COMMAND_IDS)[K]}` };

export const SETTINGS_DEFAULTS = {
	// General Settings
	DEFAULT_DURATION_MINUTES: 60,
	DEFAULT_CALENDAR_NAME: "Calendar",
	DEFAULT_EVENT_COLOR: "hsl(270, 70%, 50%)",
	COMMANDS_HISTORY_LIMIT: 50,
	MAX_CALENDARS: 10,
	BASE_NAME: "calendar",

	DEFAULT_START_PROP: "Start Date",
	DEFAULT_END_PROP: "End Date",
	DEFAULT_DATE_PROP: "Date",
	DEFAULT_ALL_DAY_PROP: "All Day",
	DEFAULT_TITLE_PROP: "Title",
	DEFAULT_ZETTEL_ID_PROP: "ZettelID",
	DEFAULT_SKIP_PROP: "Skip",
	DEFAULT_RRULE_PROP: "RRule",
	DEFAULT_RRULE_SPEC_PROP: "RRuleSpec",
	DEFAULT_RRULE_ID_PROP: "RRuleID",
	DEFAULT_SOURCE_PROP: "Source",
	DEFAULT_STATUS_PROPERTY: "Status",
	DEFAULT_DONE_VALUE: "Done",

	// Calendar Settings
	DEFAULT_FUTURE_INSTANCES_COUNT: 12,
	DEFAULT_HOUR_START: 7,
	DEFAULT_HOUR_END: 22,
	DEFAULT_SLOT_DURATION_MINUTES: 10,
	DEFAULT_SNAP_DURATION_MINUTES: 10,
	DEFAULT_ZOOM_LEVELS: [1, 2, 3, 5, 10, 15, 20, 30, 45, 60],
	DEFAULT_EVENT_MAX_STACK: 3,
	DEFAULT_PAST_EVENT_CONTRAST: 70,
	DEFAULT_EVENT_OVERLAP: true,
	DEFAULT_SLOT_EVENT_OVERLAP: true,
	DEFAULT_ENABLE_EVENT_PREVIEW: true,
	DEFAULT_NOW_INDICATOR: true,
	DEFAULT_DENSITY: "comfortable",
	DEFAULT_DEFAULT_VIEW: "dayGridMonth",
	DEFAULT_FIRST_DAY_OF_WEEK: 0,
	DEFAULT_SKIP_UNDERSCORE_PROPERTIES: true,
} as const;

export const INTERNAL_FRONTMATTER_PROPERTIES = [
	"position", // Internal Obsidian property
	"nodeRecurringInstanceDate", // Internal recurring event instance marker
] as const;
