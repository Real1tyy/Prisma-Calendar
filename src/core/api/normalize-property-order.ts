import { getUserFrontmatter } from "@real1ty/obsidian-plugins";
import { Notice, TFile } from "obsidian";

import type CustomCalendarPlugin from "../../main";
import { enforceEventPropertyOrder, withOrderedFrontmatter } from "../../utils/frontmatter/ordering";
import { batchedPromiseAll } from "../../utils/obsidian";

/**
 * One-shot convergence pass for the deterministic property order: rewrites every
 * indexed event file whose Prisma-owned keys deviate from the configured order.
 * Ongoing writes keep files canonical on their own (eventual consistency); this
 * command exists so an already-divergent vault converges immediately — run it on
 * ONE device and let sync propagate. Files already canonical are not touched.
 */
export async function normalizePropertyOrderAcrossCalendars(plugin: CustomCalendarPlugin): Promise<void> {
	let updated = 0;
	let scanned = 0;

	for (const bundle of plugin.calendarBundles) {
		const settings = bundle.settingsStore.currentSettings;
		const rows = bundle.fileRepository.getTable().toArray();

		await batchedPromiseAll(
			[...rows],
			async (row) => {
				const file = plugin.app.vault.getAbstractFileByPath(row.filePath);
				if (!(file instanceof TFile)) return;
				scanned++;

				// Dry-run against the cached frontmatter so canonical files never get
				// rewritten (a blanket rewrite would itself be a sync storm).
				const probe = getUserFrontmatter(plugin.app, file);
				if (!enforceEventPropertyOrder(probe, settings)) return;

				await withOrderedFrontmatter(plugin.app, file, settings, () => {});
				updated++;
			},
			settings.fileConcurrencyLimit
		);
	}

	new Notice(`Prisma Calendar: normalized property order on ${updated} of ${scanned} event file(s)`);
}
