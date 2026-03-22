import { showProgressModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import { CSS_PREFIX } from "../../../constants";

export interface ICSImportProgressHandle {
	updateProgress: (current: number, eventTitle?: string) => void;
	showComplete: (successCount: number, errorCount: number, skippedCount: number) => void;
	showError: (message: string) => void;
}

export function showICSImportProgressModal(app: App, totalEvents: number): ICSImportProgressHandle {
	const handle = showProgressModal({
		app,
		cssPrefix: CSS_PREFIX,
		total: totalEvents,
		title: "Importing events",
		statusTemplate: "Importing {current} of {total} events...",
		initialDetails: "Starting import...",
	});

	return {
		updateProgress(current: number, eventTitle?: string): void {
			handle.updateProgress(current, eventTitle ? `Processing: ${eventTitle}` : undefined);
		},

		showComplete(successCount: number, errorCount: number, skippedCount: number): void {
			const parts: string[] = [];
			if (successCount > 0) parts.push(`✓ ${successCount} imported`);
			if (skippedCount > 0) parts.push(`⊘ ${skippedCount} skipped (already exist)`);
			if (errorCount > 0) parts.push(`✗ ${errorCount} failed`);
			handle.showComplete(parts);
		},

		showError(message: string): void {
			handle.showError(message);
		},
	};
}
