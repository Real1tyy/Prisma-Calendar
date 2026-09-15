import type { LeafPlacement } from "@real1ty/obsidian-plugins";
import type { Plugin, WorkspaceLeaf } from "obsidian";

import { registerReactView } from "../react-view";
import { LogsViewer, type LogsViewerProps } from "../widgets/logs-viewer/logs-viewer";

export interface LogsViewConfig extends LogsViewerProps {
	/** Unique per plugin, e.g. `prisma-logs-view`. */
	viewType: string;
	/** Leaf title. Default `"Logs"`. */
	displayText?: string;
	icon?: string;
	cssPrefix?: string;
	testIdPrefix?: string;
}

/**
 * Register the Logs leaf. A leaf rather than a modal because the point is to
 * keep it open *while* reproducing the problem being logged — a modal would
 * have to be dismissed to touch anything else.
 *
 * Opt-in per plugin: a plugin that wants the surface calls this at load and
 * points a command (and the Logging settings section) at the returned
 * `activate`. See [[spec-logs-viewer-view]].
 */
export function registerLogsView(
	plugin: Plugin,
	config: LogsViewConfig
): { activate: (placement?: LeafPlacement) => Promise<WorkspaceLeaf | null> } {
	const { viewType, displayText, icon, cssPrefix, testIdPrefix, ...viewerProps } = config;

	const { activate } = registerReactView(plugin, {
		viewType,
		displayText: displayText ?? "Logs",
		icon: icon ?? "scroll-text",
		...(cssPrefix !== undefined ? { cssPrefix } : {}),
		...(testIdPrefix !== undefined ? { testIdPrefix } : {}),
		render: () => <LogsViewer {...viewerProps} />,
	});

	return { activate };
}
