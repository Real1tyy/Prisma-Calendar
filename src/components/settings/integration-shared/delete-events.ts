import { showProgressModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { TrackedSyncEvent } from "../../../core/integrations/base-sync-state-manager";
import { deleteFilesByPaths } from "../../../utils/obsidian";

export async function deleteTrackedIntegrationEvents(
	app: App,
	bundle: CalendarBundle,
	events: TrackedSyncEvent<unknown>[],
	fileConcurrencyLimit: number | undefined,
	logPrefix: string,
	logIdentifier: string
): Promise<void> {
	const progress = showProgressModal({
		app,
		cssPrefix: "prisma-",
		total: events.length,
		title: "Deleting events...",
		statusTemplate: "Deleting {current} of {total}...",
		initialDetails: `Removing events for ${logIdentifier}`,
	});

	try {
		let deleted = 0;

		const rruleIds = events
			.map((event) => bundle.recurringEventManager.getRRuleIdForSourcePath(event.filePath))
			.filter((id): id is string => id != null);

		for (const rruleId of rruleIds) {
			const instancesDeleted = await bundle.recurringEventManager.deleteAllPhysicalInstances(rruleId);
			deleted += instancesDeleted;
			progress.updateProgress(deleted, `${instancesDeleted} recurring instance(s)`);
		}

		const filePaths = events.map((event) => event.filePath);
		const baseDeleted = deleted;
		const filesDeleted = await deleteFilesByPaths(app, filePaths, fileConcurrencyLimit, (count, filePath) => {
			progress.updateProgress(baseDeleted + count, filePath.split("/").pop() ?? filePath);
		});
		deleted += filesDeleted;

		console.log(`[${logPrefix}] Deleted ${deleted} event(s) for ${logIdentifier}`);
		progress.showComplete([`Deleted ${deleted} event(s) for ${logIdentifier}`]);
	} catch (error) {
		console.error(`[${logPrefix}] Failed to delete events for ${logIdentifier}:`, error);
		progress.showError(`Failed to delete events: ${error}`);
	}
}
