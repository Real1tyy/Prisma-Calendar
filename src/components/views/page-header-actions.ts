import type { HeaderActionDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import { FULL_COMMAND_IDS } from "../../constants";

type CommandActionSpec = Omit<HeaderActionDefinition, "onAction"> & { commandId: string };

export const DEFAULT_ACTION_IDS = new Set([
	"create-event-stopwatch",
	"navigate-back",
	"global-search",
	"show-skipped",
	"show-recurring",
	"show-filtered",
	"show-untracked",
	"daily-stats",
	"weekly-stats",
	"monthly-stats",
	"alltime-stats",
	"all-events-timeline",
	"all-events-heatmap",
	"highlight-no-categories",
	"highlight-category",
	"undo",
	"redo",
	"restore-minimized",
	"open-ai-chat",
]);

const ACTION_SPECS: CommandActionSpec[] = [
	// ─── Core Actions ────────────────────────────────────────────
	{ id: "create-event", commandId: FULL_COMMAND_IDS.CREATE_EVENT, label: "Create Event", icon: "calendar-plus" },
	{
		id: "create-event-stopwatch",
		commandId: FULL_COMMAND_IDS.CREATE_EVENT_WITH_STOPWATCH,
		label: "Create Event with Stopwatch",
		icon: "timer",
	},
	{
		id: "create-untracked",
		commandId: FULL_COMMAND_IDS.CREATE_UNTRACKED_EVENT,
		label: "Create Untracked Event",
		icon: "calendar-off",
	},
	{
		id: "edit-current-note",
		commandId: FULL_COMMAND_IDS.EDIT_CURRENT_NOTE_AS_EVENT,
		label: "Edit Current Note as Event",
		icon: "file-pen-line",
	},
	{
		id: "add-zettel-id",
		commandId: FULL_COMMAND_IDS.ADD_ZETTEL_ID_TO_CURRENT_NOTE,
		label: "Add ZettelID to Current Note",
		icon: "hash",
	},

	// ─── Navigation ──────────────────────────────────────────────
	{ id: "go-to-today", commandId: FULL_COMMAND_IDS.GO_TO_TODAY, label: "Go to Today", icon: "calendar-check" },
	{ id: "scroll-to-now", commandId: FULL_COMMAND_IDS.SCROLL_TO_NOW, label: "Scroll to Now", icon: "clock" },
	{ id: "navigate-back", commandId: FULL_COMMAND_IDS.NAVIGATE_BACK, label: "Navigate Back", icon: "arrow-left" },
	{
		id: "open-note-in-calendar",
		commandId: FULL_COMMAND_IDS.OPEN_CURRENT_NOTE_IN_CALENDAR,
		label: "Open Current Note in Calendar",
		icon: "calendar-search",
	},

	// ─── Search & Filter ─────────────────────────────────────────
	{ id: "global-search", commandId: FULL_COMMAND_IDS.GLOBAL_SEARCH, label: "Global Search", icon: "search" },
	{ id: "focus-search", commandId: FULL_COMMAND_IDS.FOCUS_SEARCH, label: "Focus Search", icon: "text-search" },
	{
		id: "focus-expression-filter",
		commandId: FULL_COMMAND_IDS.FOCUS_EXPRESSION_FILTER,
		label: "Focus Expression Filter",
		icon: "filter",
	},
	{
		id: "filter-presets",
		commandId: FULL_COMMAND_IDS.OPEN_FILTER_PRESET_SELECTOR,
		label: "Filter Presets",
		icon: "sliders-horizontal",
	},

	// ─── Event Lists ─────────────────────────────────────────────
	{
		id: "show-skipped",
		commandId: FULL_COMMAND_IDS.SHOW_SKIPPED_EVENTS,
		label: "Show Skipped Events",
		icon: "eye-off",
	},
	{
		id: "show-recurring",
		commandId: FULL_COMMAND_IDS.SHOW_RECURRING_EVENTS,
		label: "Show Recurring Events",
		icon: "repeat",
	},
	{
		id: "show-filtered",
		commandId: FULL_COMMAND_IDS.SHOW_FILTERED_EVENTS,
		label: "Show Filtered Events",
		icon: "list-filter",
	},
	{
		id: "show-untracked",
		commandId: FULL_COMMAND_IDS.SHOW_UNTRACKED_EVENTS,
		label: "Toggle Untracked Events",
		icon: "calendar-off",
	},
	{
		id: "show-interval-bases",
		commandId: FULL_COMMAND_IDS.SHOW_INTERVAL_BASES,
		label: "Show Interval in Bases",
		icon: "table-2",
	},

	// ─── Focused Event ───────────────────────────────────────────
	{
		id: "edit-focused",
		commandId: FULL_COMMAND_IDS.EDIT_LAST_FOCUSED_EVENT,
		label: "Edit Focused Event",
		icon: "pencil",
	},
	{
		id: "focused-start-now",
		commandId: FULL_COMMAND_IDS.SET_LAST_FOCUSED_EVENT_START_TO_NOW,
		label: "Set Focused Start to Now",
		icon: "play",
	},
	{
		id: "focused-end-now",
		commandId: FULL_COMMAND_IDS.SET_LAST_FOCUSED_EVENT_END_TO_NOW,
		label: "Set Focused End to Now",
		icon: "square",
	},
	{
		id: "focused-start-prev",
		commandId: FULL_COMMAND_IDS.FILL_LAST_FOCUSED_EVENT_START_FROM_PREVIOUS,
		label: "Fill Focused Start from Previous",
		icon: "skip-back",
	},
	{
		id: "focused-end-next",
		commandId: FULL_COMMAND_IDS.FILL_LAST_FOCUSED_EVENT_END_FROM_NEXT,
		label: "Fill Focused End from Next",
		icon: "skip-forward",
	},

	// ─── Batch ───────────────────────────────────────────────────
	{
		id: "toggle-batch",
		commandId: FULL_COMMAND_IDS.TOGGLE_BATCH_SELECTION,
		label: "Toggle Batch Selection",
		icon: "check-square",
	},
	{
		id: "batch-select-all",
		commandId: FULL_COMMAND_IDS.BATCH_SELECT_ALL,
		label: "Batch: Select All",
		icon: "check-check",
	},
	{ id: "batch-clear", commandId: FULL_COMMAND_IDS.BATCH_CLEAR_SELECTION, label: "Batch: Clear Selection", icon: "x" },
	{
		id: "batch-duplicate",
		commandId: FULL_COMMAND_IDS.BATCH_DUPLICATE_SELECTION,
		label: "Batch: Duplicate",
		icon: "copy",
	},
	{ id: "batch-delete", commandId: FULL_COMMAND_IDS.BATCH_DELETE_SELECTION, label: "Batch: Delete", icon: "trash-2" },
	{ id: "batch-skip", commandId: FULL_COMMAND_IDS.BATCH_SKIP_SELECTION, label: "Batch: Skip", icon: "eye-off" },
	{ id: "batch-done", commandId: FULL_COMMAND_IDS.BATCH_MARK_AS_DONE, label: "Batch: Mark Done", icon: "circle-check" },
	{
		id: "batch-not-done",
		commandId: FULL_COMMAND_IDS.BATCH_MARK_AS_NOT_DONE,
		label: "Batch: Mark Not Done",
		icon: "circle",
	},
	{
		id: "batch-categories",
		commandId: FULL_COMMAND_IDS.BATCH_ASSIGN_CATEGORIES,
		label: "Batch: Assign Categories",
		icon: "tags",
	},
	{
		id: "batch-frontmatter",
		commandId: FULL_COMMAND_IDS.BATCH_UPDATE_FRONTMATTER,
		label: "Batch: Update Frontmatter",
		icon: "file-cog",
	},
	{
		id: "batch-open",
		commandId: FULL_COMMAND_IDS.BATCH_OPEN_SELECTION,
		label: "Batch: Open All",
		icon: "external-link",
	},
	{
		id: "batch-clone-next",
		commandId: FULL_COMMAND_IDS.BATCH_CLONE_NEXT_WEEK,
		label: "Batch: Clone Next Week",
		icon: "copy-plus",
	},
	{
		id: "batch-clone-prev",
		commandId: FULL_COMMAND_IDS.BATCH_CLONE_PREV_WEEK,
		label: "Batch: Clone Prev Week",
		icon: "copy-minus",
	},
	{
		id: "batch-move-next",
		commandId: FULL_COMMAND_IDS.BATCH_MOVE_NEXT_WEEK,
		label: "Batch: Move Next Week",
		icon: "arrow-right",
	},
	{
		id: "batch-move-prev",
		commandId: FULL_COMMAND_IDS.BATCH_MOVE_PREV_WEEK,
		label: "Batch: Move Prev Week",
		icon: "arrow-left",
	},

	// ─── Statistics ──────────────────────────────────────────────
	{ id: "daily-stats", commandId: FULL_COMMAND_IDS.SHOW_DAILY_STATS, label: "Daily Statistics", icon: "bar-chart-2" },
	{
		id: "weekly-stats",
		commandId: FULL_COMMAND_IDS.SHOW_WEEKLY_STATS,
		label: "Weekly Statistics",
		icon: "bar-chart-3",
	},
	{
		id: "monthly-stats",
		commandId: FULL_COMMAND_IDS.SHOW_MONTHLY_STATS,
		label: "Monthly Statistics",
		icon: "bar-chart-4",
	},
	{
		id: "alltime-stats",
		commandId: FULL_COMMAND_IDS.SHOW_ALLTIME_STATS,
		label: "All-Time Statistics",
		icon: "trending-up",
	},
	{
		id: "daily-stats-now",
		commandId: FULL_COMMAND_IDS.SHOW_DAILY_STATS_FOR_NOW,
		label: "Today's Statistics",
		icon: "bar-chart-2",
	},
	{
		id: "weekly-stats-now",
		commandId: FULL_COMMAND_IDS.SHOW_WEEKLY_STATS_FOR_NOW,
		label: "This Week's Statistics",
		icon: "bar-chart-3",
	},
	{
		id: "monthly-stats-now",
		commandId: FULL_COMMAND_IDS.SHOW_MONTHLY_STATS_FOR_NOW,
		label: "This Month's Statistics",
		icon: "bar-chart-4",
	},

	// ─── Visualization ───────────────────────────────────────────
	{
		id: "all-events-timeline",
		commandId: FULL_COMMAND_IDS.SHOW_ALL_EVENTS_TIMELINE,
		label: "All Events Timeline",
		icon: "git-branch",
	},
	{
		id: "all-events-heatmap",
		commandId: FULL_COMMAND_IDS.SHOW_ALL_EVENTS_HEATMAP,
		label: "All Events Heatmap",
		icon: "flame",
	},
	{
		id: "toggle-prerequisites",
		commandId: FULL_COMMAND_IDS.TOGGLE_PREREQUISITE_CONNECTIONS,
		label: "Toggle Prerequisite Connections",
		icon: "workflow",
	},

	// ─── Categories ──────────────────────────────────────────────
	{
		id: "highlight-no-categories",
		commandId: FULL_COMMAND_IDS.HIGHLIGHT_EVENTS_WITHOUT_CATEGORIES,
		label: "Highlight Uncategorized",
		icon: "alert-triangle",
	},
	{
		id: "highlight-category",
		commandId: FULL_COMMAND_IDS.HIGHLIGHT_EVENTS_WITH_CATEGORY,
		label: "Highlight by Category",
		icon: "palette",
	},

	// ─── Calendar Management ─────────────────────────────────────
	{ id: "refresh", commandId: FULL_COMMAND_IDS.REFRESH_CALENDAR, label: "Refresh Calendar", icon: "refresh-cw" },
	{ id: "undo", commandId: FULL_COMMAND_IDS.UNDO, label: "Undo", icon: "undo-2" },
	{ id: "redo", commandId: FULL_COMMAND_IDS.REDO, label: "Redo", icon: "redo-2" },

	// ─── Integrations ────────────────────────────────────────────
	{ id: "export-ics", commandId: FULL_COMMAND_IDS.EXPORT_CALENDAR_ICS, label: "Export as .ics", icon: "download" },
	{ id: "import-ics", commandId: FULL_COMMAND_IDS.IMPORT_CALENDAR_ICS, label: "Import .ics", icon: "upload" },
	{ id: "sync-caldav", commandId: FULL_COMMAND_IDS.SYNC_CALDAV, label: "Sync CalDAV", icon: "cloud" },
	{ id: "sync-ics", commandId: FULL_COMMAND_IDS.SYNC_ICS_SUBSCRIPTIONS, label: "Sync ICS Subscriptions", icon: "rss" },

	// ─── Other ───────────────────────────────────────────────────
	{
		id: "restore-minimized",
		commandId: FULL_COMMAND_IDS.RESTORE_MINIMIZED_MODAL,
		label: "Restore Minimized Modal",
		icon: "maximize-2",
	},
	{
		id: "assign-cat-minimized",
		commandId: FULL_COMMAND_IDS.ASSIGN_CATEGORIES_MINIMIZED_MODAL,
		label: "Assign Categories (Minimized)",
		icon: "tag",
	},
	{ id: "open-ai-chat", commandId: FULL_COMMAND_IDS.OPEN_AI_CHAT, label: "Open AI Chat", icon: "bot" },
];

export function buildPageHeaderActions(app: App): HeaderActionDefinition[] {
	return ACTION_SPECS.map(({ commandId, ...rest }) => ({
		...rest,
		onAction: () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(app as any).commands.executeCommandById(commandId);
		},
	}));
}
