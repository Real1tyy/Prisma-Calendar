const PLUGIN_ID = "prisma-calendar";
export const CSS_PREFIX = "prisma-";
// Concurrency control for parallel file processing
// Higher values = faster initial scan but more memory/CPU usage
export const SCAN_CONCURRENCY = 10;

// Interval for periodic scan that marks past events as done (5 minutes)
export const MARK_DONE_SCAN_INTERVAL_MS = 5 * 60 * 1000;

// Custom namespace UUID for Prisma Calendar events
// This ensures our event IDs are unique to this application
export const PRISMA_CALENDAR_NAMESPACE = "a8f9e6d4-7c2b-4e1a-9f3d-5b8c1a2e4d6f";

// Command IDs — values derived from keys via kebab-case
type ScreamingToKebab<S extends string> = S extends `${infer A}_${infer B}`
	? `${Lowercase<A>}-${ScreamingToKebab<B>}`
	: Lowercase<S>;

const COMMAND_KEYS = [
	"CREATE_EVENT",
	"CREATE_EVENT_WITH_STOPWATCH",
	"CREATE_UNTRACKED_EVENT",
	"EDIT_CURRENT_NOTE_AS_EVENT",
	"ADD_ZETTEL_ID_TO_CURRENT_NOTE",
	"EDIT_LAST_FOCUSED_EVENT",
	"SET_LAST_FOCUSED_EVENT_START_TO_NOW",
	"SET_LAST_FOCUSED_EVENT_END_TO_NOW",
	"FILL_LAST_FOCUSED_EVENT_START_FROM_PREVIOUS",
	"FILL_LAST_FOCUSED_EVENT_END_FROM_NEXT",
	"SHOW_SKIPPED_EVENTS",
	"SHOW_RECURRING_EVENTS",
	"SHOW_FILTERED_EVENTS",
	"SHOW_UNTRACKED_EVENTS",
	"GLOBAL_SEARCH",
	"FOCUS_SEARCH",
	"FOCUS_EXPRESSION_FILTER",
	"OPEN_FILTER_PRESET_SELECTOR",
	"UNDO",
	"REDO",
	"TOGGLE_BATCH_SELECTION",
	"BATCH_SELECT_ALL",
	"BATCH_CLEAR_SELECTION",
	"BATCH_DUPLICATE_SELECTION",
	"BATCH_DELETE_SELECTION",
	"BATCH_SKIP_SELECTION",
	"BATCH_OPEN_SELECTION",
	"BATCH_CLONE_NEXT_WEEK",
	"BATCH_CLONE_PREV_WEEK",
	"BATCH_MOVE_NEXT_WEEK",
	"BATCH_MOVE_PREV_WEEK",
	"BATCH_MARK_AS_DONE",
	"BATCH_MARK_AS_NOT_DONE",
	"BATCH_ASSIGN_CATEGORIES",
	"BATCH_UPDATE_FRONTMATTER",
	"OPEN_CURRENT_NOTE_IN_CALENDAR",
	"SHOW_DAILY_STATS",
	"SHOW_WEEKLY_STATS",
	"SHOW_MONTHLY_STATS",
	"SHOW_ALLTIME_STATS",
	"SHOW_DAILY_STATS_FOR_NOW",
	"SHOW_WEEKLY_STATS_FOR_NOW",
	"SHOW_MONTHLY_STATS_FOR_NOW",
	"REFRESH_CALENDAR",
	"HIGHLIGHT_EVENTS_WITHOUT_CATEGORIES",
	"HIGHLIGHT_EVENTS_WITH_CATEGORY",
	"RESTORE_MINIMIZED_MODAL",
	"ASSIGN_CATEGORIES_MINIMIZED_MODAL",
	"EXPORT_CALENDAR_ICS",
	"IMPORT_CALENDAR_ICS",
	"SYNC_CALDAV",
	"SYNC_ICS_SUBSCRIPTIONS",
	"NAVIGATE_BACK",
	"SHOW_INTERVAL_BASES",
	"SCROLL_TO_NOW",
	"GO_TO_TODAY",
	"SHOW_ALL_EVENTS_TIMELINE",
	"SHOW_ALL_EVENTS_HEATMAP",
	"OPEN_AI_CHAT",
	"TOGGLE_PREREQUISITE_CONNECTIONS",
	"TRIGGER_CURRENT_EVENT_STOPWATCH",
] as const;

type CommandKey = (typeof COMMAND_KEYS)[number];

export const COMMAND_IDS = Object.fromEntries(COMMAND_KEYS.map((k) => [k, k.toLowerCase().replace(/_/g, "-")])) as {
	readonly [K in CommandKey]: ScreamingToKebab<K>;
};

export const FULL_COMMAND_IDS = Object.fromEntries(
	Object.entries(COMMAND_IDS).map(([key, value]) => [key, `${PLUGIN_ID}:${value}`])
) as {
	[K in keyof typeof COMMAND_IDS]: `${typeof PLUGIN_ID}:${(typeof COMMAND_IDS)[K]}`;
};

// Property name defaults (shared between schema definitions and settings UI placeholders)
export const PROP_DEFAULTS = {
	start: "Start Date",
	end: "End Date",
	date: "Date",
	allDay: "All Day",
	sortDate: "Sort Date",
	title: "Title",
	calendarTitle: "Calendar Title",
	zettelId: "ZettelID",
	skip: "Skip",
	rrule: "RRule",
	rruleSpec: "RRuleSpec",
	rruleId: "RRuleID",
	source: "Source",
	ignoreRecurring: "Ignore Recurring",
	futureInstancesCount: "Future Instances Count",
	generatePastEvents: "Generate Past Events",
	status: "Status",
	doneValue: "Done",
	notDoneValue: "Not Done",
	category: "Category",
	location: "Location",
	participants: "Participants",
	break: "Break",
	icon: "Icon",
	prerequisite: "Prerequisite",
	minutesBefore: "Minutes Before",
	daysBefore: "Days Before",
	alreadyNotified: "Already Notified",
} as const;

// Shared defaults used in both schema definitions and settings UI fallbacks
export const DEFAULT_EVENT_COLOR = "hsl(270, 70%, 50%)";
export const DEFAULT_EVENT_TEXT_COLOR = "#ffffff";
export const DEFAULT_EVENT_TEXT_COLOR_ALT = "#000000";
export const DEFAULT_MONTH_EVEN_COLOR = "#131313";
export const DEFAULT_MONTH_ODD_COLOR = "#6b9080";
export const DEFAULT_CONNECTION_COLOR = "#7c3aed";
export const DEFAULT_CONNECTION_STROKE_WIDTH = 3;
export const DEFAULT_CONNECTION_ARROW_SIZE = 12;
export const DEFAULT_ZOOM_LEVELS = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60] as const;
export const DEFAULT_SOURCE_RECURRING_MARKER = "⦿";
export const DEFAULT_PHYSICAL_RECURRING_MARKER = "🔄";
export const DEFAULT_EXPORT_FOLDER = "Prisma-Exports";
export const BASE_NAME = "calendar";

export const INTERNAL_FRONTMATTER_PROPERTIES = [
	"position", // Internal Obsidian property
] as const;

export const CALDAV_DEFAULTS = {
	SYNC_FOLDER: "CalDAV",
	SYNC_INTERVAL_MINUTES: 15,
	MAX_ACCOUNTS: 10,
} as const;

export const ICS_SUBSCRIPTION_DEFAULTS = {
	SYNC_INTERVAL_MINUTES: 60,
	MAX_SUBSCRIPTIONS: 20,
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

export const DEFAULT_TOOLBAR_BUTTONS = [...TOOLBAR_BUTTON_IDS];

export const CONTEXT_MENU_BUTTON_LABELS = {
	enlarge: "Enlarge",
	preview: "Preview",
	goToSource: "Go to source",
	editSourceEvent: "Edit source event",
	duplicateRecurringInstance: "Duplicate recurring instance",
	viewEventGroups: "View event groups",
	editEvent: "Edit event",
	assignCategories: "Assign categories",
	assignPrerequisites: "Assign prerequisites",
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
	triggerStopwatch: "Trigger stopwatch",
	duplicateRemainingWeekDays: "Duplicate remaining week days",
} as const;

export const CONTEXT_MENU_ITEM_IDS = Object.keys(
	CONTEXT_MENU_BUTTON_LABELS
) as (keyof typeof CONTEXT_MENU_BUTTON_LABELS)[];

export const DEFAULT_CONTEXT_MENU_ITEMS = CONTEXT_MENU_ITEM_IDS.filter((id) => id !== "duplicateRemainingWeekDays");

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
