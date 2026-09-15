import type { LeafPlacement } from "@real1ty/obsidian-plugins";
import { Scope, type Plugin, type WorkspaceLeaf } from "obsidian";

import { createPageHeader } from "../page-header/create-page-header";
import type { HeaderActionDefinition, PageHeaderState } from "../page-header/types";
import { registerReactView } from "../react-view";
import { LogsViewer, type LogsViewerHandle, type LogsViewerProps } from "../widgets/logs-viewer/logs-viewer";

/** Header action ids. Prefixed so they never collide with another leaf's header in the same window. */
export const LOGS_HEADER_ACTION_IDS = {
	reportBug: "logs-report-bug",
	copyFiltered: "logs-copy-filtered",
	copySelected: "logs-copy-selected",
	copyAll: "logs-copy-all",
	save: "logs-save",
	clear: "logs-clear",
} as const;

export interface LogsHeaderActionOptions {
	/**
	 * Opens the plugin's bug report with the logs already attached — the same
	 * path as the Doctor's "Create bug report". Omit and the action is not offered.
	 */
	onReportBug?: (() => void) | undefined;
}

/**
 * The Logs leaf's page-header actions, each forwarding to the viewer mounted in
 * that leaf. `getHandle` is read per click, not captured: the viewer's handle
 * is only set once React has committed, after the header is already applied.
 */
export function buildLogsHeaderActions(
	getHandle: () => LogsViewerHandle | null,
	options: LogsHeaderActionOptions = {}
): HeaderActionDefinition[] {
	const { onReportBug } = options;
	return [
		// First, because a user reading the logs for a problem is one step from reporting it.
		...(onReportBug
			? [{ id: LOGS_HEADER_ACTION_IDS.reportBug, label: "Report a bug", icon: "bug", onAction: () => onReportBug() }]
			: []),
		{
			id: LOGS_HEADER_ACTION_IDS.copyFiltered,
			label: "Copy filtered",
			icon: "clipboard-copy",
			onAction: () => getHandle()?.copyFiltered(),
		},
		{
			id: LOGS_HEADER_ACTION_IDS.copySelected,
			label: "Copy selected",
			icon: "list-checks",
			onAction: () => getHandle()?.copySelected(),
		},
		{
			id: LOGS_HEADER_ACTION_IDS.copyAll,
			label: "Copy all",
			icon: "copy",
			onAction: () => getHandle()?.copyAll(),
		},
		{
			id: LOGS_HEADER_ACTION_IDS.save,
			label: "Save to file",
			icon: "save",
			onAction: () => getHandle()?.save(),
		},
		{
			id: LOGS_HEADER_ACTION_IDS.clear,
			label: "Clear buffer",
			icon: "trash-2",
			onAction: () => getHandle()?.clear(),
		},
	];
}

/**
 * The leaf's own keys. `Mod+F` has to live on the view's `Scope`: Obsidian's
 * workspace keymap handles it before the event reaches the React tree, so a
 * React `onKeyDown` never sees it inside a leaf. Returning `false` stops the
 * key there. `Mod+A` stays in React, where the search field keeps its own
 * select-all.
 */
export function registerLogsViewKeys(scope: Pick<Scope, "register">, getHandle: () => LogsViewerHandle | null): void {
	scope.register(["Mod"], "f", () => {
		getHandle()?.focusSearch();
		return false;
	});
}

export interface LogsViewPageHeaderConfig {
	/** Read when a leaf opens, so a customisation made in another leaf is picked up. */
	loadState: () => PageHeaderState | undefined;
	saveState: (state: PageHeaderState) => void;
}

export interface LogsViewConfig extends Omit<LogsViewerProps, "variant">, LogsHeaderActionOptions {
	/** Unique per plugin, e.g. `prisma-logs-view`. */
	viewType: string;
	/** Leaf title. Default `"Logs"`. */
	displayText?: string;
	icon?: string;
	cssPrefix?: string;
	testIdPrefix?: string;
	/** Persistence for the header's order, renames and hidden actions. Omit and they reset per leaf. */
	pageHeader?: LogsViewPageHeaderConfig;
}

/**
 * Register the Logs leaf. A leaf rather than a modal because the point is to
 * keep it open *while* reproducing the problem being logged — a modal would
 * have to be dismissed to touch anything else.
 *
 * Report, copy, save and clear live in the leaf's page header like every other
 * plugin leaf, so users can reorder, rename and hide them with the same manager.
 * Opt-in per plugin: call this at load and point a command (and the Logging
 * settings section) at the returned `activate`. See [[spec-logs-viewer-view]].
 */
export function registerLogsView(
	plugin: Plugin,
	config: LogsViewConfig
): { activate: (placement?: LeafPlacement) => Promise<WorkspaceLeaf | null> } {
	const { viewType, displayText, icon, cssPrefix = "", testIdPrefix, pageHeader, onReportBug, ...viewerProps } = config;

	const registered = registerReactView<LogsViewerHandle>(plugin, {
		viewType,
		displayText: displayText ?? "Logs",
		icon: icon ?? "scroll-text",
		cssPrefix,
		...(testIdPrefix !== undefined ? { testIdPrefix } : {}),
		render: (ref) => <LogsViewer {...viewerProps} ref={ref} />,
		onMount: (leaf, view) => {
			const scope = new Scope(plugin.app.scope);
			registerLogsViewKeys(scope, () => registered.getHandle(leaf));
			view.scope = scope;

			const savedState = pageHeader?.loadState();
			const header = createPageHeader({
				actions: buildLogsHeaderActions(() => registered.getHandle(leaf), { onReportBug }),
				cssPrefix,
				app: plugin.app,
				editable: true,
				...(savedState ? { currentState: savedState } : {}),
				...(pageHeader ? { onStateChange: pageHeader.saveState } : {}),
			});
			header.apply(leaf);
			return () => header.destroy();
		},
	});

	return { activate: registered.activate };
}
