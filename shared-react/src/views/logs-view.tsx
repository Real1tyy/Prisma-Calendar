import type { LeafPlacement } from "@real1ty/obsidian-plugins";
import type { Plugin, WorkspaceLeaf } from "obsidian";

import { createPageHeader } from "../page-header/create-page-header";
import type { HeaderActionDefinition, PageHeaderState } from "../page-header/types";
import { registerReactView } from "../react-view";
import { LogsViewer, type LogsViewerHandle, type LogsViewerProps } from "../widgets/logs-viewer/logs-viewer";

/** Header action ids. Prefixed so they never collide with another leaf's header in the same window. */
export const LOGS_HEADER_ACTION_IDS = {
	copyFiltered: "logs-copy-filtered",
	copyAll: "logs-copy-all",
	save: "logs-save",
	clear: "logs-clear",
} as const;

/**
 * The Logs leaf's page-header actions, each forwarding to the viewer mounted in
 * that leaf. `getHandle` is read per click, not captured: the viewer's handle
 * is only set once React has committed, after the header is already applied.
 */
export function buildLogsHeaderActions(getHandle: () => LogsViewerHandle | null): HeaderActionDefinition[] {
	return [
		{
			id: LOGS_HEADER_ACTION_IDS.copyFiltered,
			label: "Copy filtered",
			icon: "clipboard-copy",
			onAction: () => getHandle()?.copyFiltered(),
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

export interface LogsViewPageHeaderConfig {
	/** Read when a leaf opens, so a customisation made in another leaf is picked up. */
	loadState: () => PageHeaderState | undefined;
	saveState: (state: PageHeaderState) => void;
}

export interface LogsViewConfig extends LogsViewerProps {
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
 * Copy, save and clear live in the leaf's page header like every other plugin
 * leaf, so users can reorder, rename and hide them with the same manager.
 * Opt-in per plugin: call this at load and point a command (and the Logging
 * settings section) at the returned `activate`. See [[spec-logs-viewer-view]].
 */
export function registerLogsView(
	plugin: Plugin,
	config: LogsViewConfig
): { activate: (placement?: LeafPlacement) => Promise<WorkspaceLeaf | null> } {
	const { viewType, displayText, icon, cssPrefix = "", testIdPrefix, pageHeader, ...viewerProps } = config;

	const registered = registerReactView<LogsViewerHandle>(plugin, {
		viewType,
		displayText: displayText ?? "Logs",
		icon: icon ?? "scroll-text",
		cssPrefix,
		...(testIdPrefix !== undefined ? { testIdPrefix } : {}),
		render: (ref) => <LogsViewer {...viewerProps} ref={ref} />,
		onMount: (leaf) => {
			const savedState = pageHeader?.loadState();
			const header = createPageHeader({
				actions: buildLogsHeaderActions(() => registered.getHandle(leaf)),
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
