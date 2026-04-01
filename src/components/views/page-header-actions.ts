import type { HeaderActionDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import { FULL_COMMAND_IDS } from "../../constants";

type CommandActionSpec = Omit<HeaderActionDefinition, "onAction"> & { commandId: string };

export const DEFAULT_ACTION_IDS = new Set([
	"create-event-stopwatch",
	"navigate-back",
	"navigate-forward",
	"global-search",
	"show-skipped",
	"show-recurring",
	"show-filtered",
	"show-interval-bases",
	"daily-stats",
	"weekly-stats",
	"monthly-stats",
	"alltime-stats",
	"highlight-no-categories",
	"highlight-category",
	"undo",
	"redo",
	"restore-minimized",
	"open-ai-chat",
]);

const ACTION_SPECS: CommandActionSpec[] = [
	// ─── Core Actions ────────────────────────────────────────────
	{ id: "create-event", commandId: FULL_COMMAND_IDS.CREATE_EVENT, label: "Create", icon: "calendar-plus" },
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

	// ─── Navigation ──────────────────────────────────────────────
	{ id: "go-to-today", commandId: FULL_COMMAND_IDS.GO_TO_TODAY, label: "Go to Today", icon: "calendar-check" },
	{ id: "scroll-to-now", commandId: FULL_COMMAND_IDS.SCROLL_TO_NOW, label: "Scroll to Now", icon: "clock" },
	{ id: "navigate-back", commandId: FULL_COMMAND_IDS.NAVIGATE_BACK, label: "Navigate Back", icon: "arrow-left" },
	{
		id: "navigate-forward",
		commandId: FULL_COMMAND_IDS.NAVIGATE_FORWARD,
		label: "Navigate Forward",
		icon: "arrow-right",
	},

	// ─── Search ──────────────────────────────────────────────────
	{ id: "global-search", commandId: FULL_COMMAND_IDS.GLOBAL_SEARCH, label: "Global Search", icon: "search" },

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
		id: "show-interval-bases",
		commandId: FULL_COMMAND_IDS.SHOW_INTERVAL_BASES,
		label: "Show Interval in Bases",
		icon: "table-2",
	},

	// ─── Batch ───────────────────────────────────────────────────
	{
		id: "toggle-batch",
		commandId: FULL_COMMAND_IDS.TOGGLE_BATCH_SELECTION,
		label: "Toggle Batch Selection",
		icon: "check-square",
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
	// ─── Visualization ───────────────────────────────────────────
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
