import { createLogFileSource, createVaultLogFileSystem, type LeafPlacement } from "@real1ty/obsidian-plugins";
import { registerLogsView, type LogsViewerProps } from "@real1ty/obsidian-plugins-react";
import { normalizePath, type WorkspaceLeaf } from "obsidian";

import { CSS_PREFIX, tid } from "../constants";
import type CustomCalendarPlugin from "../main";
import { openPrismaBugReport } from "./api/feedback";
import { logDirectory } from "./logging";

export const PRISMA_LOGS_VIEW_TYPE = "prisma-logs-view";

/** Vault folder a saved log export lands in. */
const EXPORT_FOLDER = "Prisma Logs";

export interface PrismaLogsView {
	activate: (placement?: LeafPlacement) => Promise<WorkspaceLeaf | null>;
}

/**
 * The viewer wired to Prisma's own service and log files — shared by the Logs
 * leaf and the Doctor's Logs section, so both read and export identically.
 *
 * Exports are written through `vault.create` rather than the VaultTable: the
 * file is a report about the plugin, not an indexed note, and it only ever
 * exists because the user pressed Save.
 */
export function prismaLogsViewerProps(plugin: CustomCalendarPlugin): LogsViewerProps {
	const fs = createVaultLogFileSystem(plugin.app.vault.adapter);

	return {
		service: plugin.logging.service,
		files: createLogFileSource(fs, logDirectory(plugin)),
		filenamePrefix: "prisma-logs",
		onSave: async (content, filename) => {
			if (!plugin.app.vault.getFolderByPath(EXPORT_FOLDER)) {
				await plugin.app.vault.createFolder(EXPORT_FOLDER);
			}
			const path = normalizePath(`${EXPORT_FOLDER}/${filename}`);
			await plugin.app.vault.create(path, content);
			return path;
		},
	};
}

export function registerPrismaLogsView(plugin: CustomCalendarPlugin): PrismaLogsView {
	return registerLogsView(plugin, {
		...prismaLogsViewerProps(plugin),
		viewType: PRISMA_LOGS_VIEW_TYPE,
		displayText: "Prisma logs",
		icon: "scroll-text",
		cssPrefix: CSS_PREFIX,
		testIdPrefix: CSS_PREFIX,
		// One path with the Doctor's "Create bug report", so the bundled context cannot drift.
		onReportBug: () => openPrismaBugReport(plugin),
		pageHeader: {
			loadState: () => plugin.settingsStore.currentSettings.logsPageHeaderState,
			saveState: (state) => {
				void plugin.settingsStore.updateSettings((settings) => ({ ...settings, logsPageHeaderState: state }));
			},
		},
	});
}

/** Test id of the Logs view root — the e2e suite's handle on the leaf. */
export const PRISMA_LOGS_VIEW_TID = tid("logs-viewer");
