import { executeCommand } from "@real1ty-obsidian-plugins";
import { ObsidianIcon, useApp, type HeaderActionDefinition } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { memo, useCallback, type CSSProperties } from "react";

import { cls, CSS_PREFIX, FULL_COMMAND_IDS, tid } from "../../constants";

interface ActionSpec {
	id: string;
	commandId: string;
	label: string;
	icon: string;
}

const ACTION_SPECS: readonly ActionSpec[] = [
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
	{ id: "refresh", commandId: FULL_COMMAND_IDS.REFRESH_CALENDAR, label: "Refresh", icon: "refresh-cw" },
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

export const DEFAULT_ACTION_IDS = new Set([
	"create-event-stopwatch",
	"undo",
	"redo",
	"navigate-back",
	"navigate-forward",
	"open-ai-chat",
	"restore-minimized",
	"toggle-prerequisites",
	"global-search",
	"daily-stats",
	"weekly-stats",
	"monthly-stats",
	"alltime-stats",
	"show-skipped",
	"show-recurring",
	"show-filtered",
	"show-interval-bases",
	"refresh",
]);

/** Default toolbar order (matches ACTION_SPECS order, filtered to defaults). */
export const DEFAULT_ORDERED_ACTION_IDS: string[] = ACTION_SPECS.filter((a) => DEFAULT_ACTION_IDS.has(a.id)).map(
	(a) => a.id
);

/** Builds the toolbar action definitions, binding each onAction to the app's command registry. */
export function buildPageHeaderActions(app: App): HeaderActionDefinition[] {
	return ACTION_SPECS.map((spec) => ({
		id: spec.id,
		label: spec.label,
		icon: spec.icon,
		onAction: () => executeCommand(app, spec.commandId),
	}));
}

const HEADER_BTN_CLASS = "header-btn";

export interface PageHeaderActionsProps {
	/** Visibility order; defaults to {@link DEFAULT_ORDERED_ACTION_IDS}. */
	visibleActionIds?: string[];
	renames?: Record<string, string>;
	iconOverrides?: Record<string, string>;
	colorOverrides?: Record<string, string>;
	/** When set (page header mount), invoked instead of direct command execution. */
	executeAction?: (actionId: string) => void;
	/** Prepended to `${HEADER_BTN_CLASS}` (e.g. `prisma-` → `prisma-header-btn`). */
	cssPrefix?: string;
}

export const PageHeaderActions = memo(function PageHeaderActions({
	visibleActionIds = DEFAULT_ORDERED_ACTION_IDS,
	renames,
	iconOverrides,
	colorOverrides,
	executeAction: executeActionProp,
	cssPrefix = CSS_PREFIX,
}: PageHeaderActionsProps) {
	const app = useApp();

	const runCommand = useCallback(
		(commandId: string) => {
			executeCommand(app, commandId);
		},
		[app]
	);

	const prefixBtn = `${cssPrefix}${HEADER_BTN_CLASS}`;

	const rows = visibleActionIds
		.map((id) => ACTION_SPECS.find((s) => s.id === id))
		.filter((s): s is ActionSpec => s !== undefined);

	return (
		<div className={cls("page-header-actions")} data-testid={tid("page-header-actions")}>
			{rows.map((action) => {
				const label = renames?.[action.id] ?? action.label;
				const icon = iconOverrides?.[action.id] ?? action.icon;
				const color = colorOverrides?.[action.id];
				const style: CSSProperties | undefined = color && color !== "#000000" ? { color } : undefined;

				return (
					<button
						key={action.id}
						type="button"
						className={`${prefixBtn} prisma-page-header-action clickable-icon`}
						title={label}
						aria-label={label}
						data-testid={`${cssPrefix}toolbar-${action.id}`}
						style={style}
						onClick={() => {
							if (executeActionProp) {
								executeActionProp(action.id);
							} else {
								runCommand(action.commandId);
							}
						}}
					>
						<ObsidianIcon icon={icon} />
					</button>
				);
			})}
		</div>
	);
});
