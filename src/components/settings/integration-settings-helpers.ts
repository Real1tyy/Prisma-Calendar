import { type App, Notice } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { TrackedSyncEvent } from "../../core/integrations/base-sync-state-manager";
import { deleteFilesByPaths } from "../../utils/obsidian";

export async function deleteTrackedIntegrationEvents(
	app: App,
	bundle: CalendarBundle,
	events: TrackedSyncEvent<unknown>[],
	fileConcurrencyLimit: number | undefined,
	logPrefix: string,
	logIdentifier: string
): Promise<void> {
	let deletedCount = events.length;

	for (const event of events) {
		const rruleId = bundle.recurringEventManager.getRRuleIdForSourcePath(event.filePath);
		if (rruleId) {
			const instances = bundle.recurringEventManager.getPhysicalInstancesByRRuleId(rruleId);
			deletedCount += instances.length;
			await bundle.recurringEventManager.deleteAllPhysicalInstances(rruleId);
		}
	}

	const filePaths = events.map((event) => event.filePath);
	await deleteFilesByPaths(app, filePaths, fileConcurrencyLimit);

	console.log(`[${logPrefix}] Deleted ${deletedCount} event(s) for ${logIdentifier}`);
	new Notice(`Deleted ${deletedCount} event(s)`);
}
