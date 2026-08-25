import { getUserFrontmatter } from "@real1ty/obsidian-plugins";
import { openConfirmation, openProgressModal } from "@real1ty/obsidian-plugins-react";
import { Notice, TFile, type App } from "obsidian";
import { createElement } from "react";

import { CSS_PREFIX, tid } from "../../constants";
import type CustomCalendarPlugin from "../../main";
import type { SingleCalendarConfig } from "../../types/settings";
import { enforceEventPropertyOrder, withOrderedFrontmatter } from "../../utils/frontmatter/ordering";
import { batchedPromiseAll } from "../../utils/obsidian";

export interface PropertyOrderDeviation {
	filePath: string;
	settings: SingleCalendarConfig;
}

/**
 * Dry run: every indexed event file whose Prisma-owned key order deviates from the
 * configured order. Reads the metadata cache only — nothing is written — so the
 * caller can show the user exactly what a normalize pass would touch before it runs.
 */
export function detectPropertyOrderDeviations(plugin: CustomCalendarPlugin): PropertyOrderDeviation[] {
	const deviations: PropertyOrderDeviation[] = [];
	for (const bundle of plugin.calendarBundles) {
		const settings = bundle.settingsStore.currentSettings;
		for (const row of bundle.fileRepository.getTable().toArray()) {
			const file = plugin.app.vault.getAbstractFileByPath(row.filePath);
			if (!(file instanceof TFile)) continue;
			const probe = getUserFrontmatter(plugin.app, file);
			if (enforceEventPropertyOrder(probe, settings)) deviations.push({ filePath: row.filePath, settings });
		}
	}
	return deviations;
}

/**
 * Rewrites each deviating file into the configured order (an empty mutation through
 * the ordering choke point). `onProgress` fires after every file so a progress UI can
 * track it; a file that vanished mid-run is skipped, not counted as failure.
 */
export async function applyPropertyOrder(
	app: App,
	deviations: readonly PropertyOrderDeviation[],
	onProgress?: (done: number, filePath: string) => void
): Promise<{ updated: number; failed: number }> {
	let updated = 0;
	let failed = 0;
	let done = 0;
	const concurrency = deviations[0]?.settings.fileConcurrencyLimit ?? 10;

	await batchedPromiseAll(
		deviations,
		async ({ filePath, settings }) => {
			const file = app.vault.getAbstractFileByPath(filePath);
			if (file instanceof TFile) {
				try {
					await withOrderedFrontmatter(app, file, settings, () => {});
					updated++;
				} catch (error) {
					failed++;
					console.error(`[PropertyOrder] Failed to normalize ${filePath}:`, error);
				}
			}
			done++;
			onProgress?.(done, filePath);
		},
		concurrency
	);

	return { updated, failed };
}

/**
 * The user-facing normalize flow (settings button + palette command): detect
 * deviations → show them for confirmation → rewrite with a progress bar → report.
 * Ongoing writes keep files canonical on their own (eventual consistency); this is the
 * explicit one-shot convergence for an already-divergent vault — run on ONE device and
 * let sync propagate. See [[decision-deterministic-property-ordering]].
 */
export async function runNormalizePropertyOrder(plugin: CustomCalendarPlugin): Promise<void> {
	const deviations = detectPropertyOrderDeviations(plugin);
	if (deviations.length === 0) {
		new Notice("Prisma Calendar: every event file already uses the configured property order");
		return;
	}

	const confirmed = await openConfirmation<string[]>(plugin.app, {
		title: "Normalize property order?",
		message: `${deviations.length} event file(s) have Prisma properties out of the configured order. Rewriting them regroups only Prisma's own properties — other properties are left untouched. Run this on one device and let sync propagate.`,
		confirmLabel: `Normalize ${deviations.length} file(s)`,
		cancelLabel: "Cancel",
		testIdPrefix: tid("normalize-order-"),
		initialExtras: deviations.map((d) => d.filePath),
		renderExtras: (paths) =>
			createElement(
				"ul",
				{ className: `${CSS_PREFIX}normalize-order-list`, "data-testid": tid("normalize-order-list") },
				paths.map((path) => createElement("li", { key: path }, path))
			),
	});
	if (!confirmed) return;

	const progress = openProgressModal(plugin.app, {
		app: plugin.app,
		cssPrefix: CSS_PREFIX,
		total: deviations.length,
		title: "Normalizing property order...",
		statusTemplate: "Rewriting {current} of {total} files...",
	});

	const { updated, failed } = await applyPropertyOrder(plugin.app, deviations, (done, filePath) =>
		progress.updateProgress(done, filePath)
	);

	progress.showComplete([`${updated} file(s) normalized`, ...(failed > 0 ? [`${failed} failed (see console)`] : [])]);
	new Notice(
		failed > 0
			? `Prisma Calendar: normalized ${updated} file(s), ${failed} failed — see the console`
			: `Prisma Calendar: normalized property order on ${updated} file(s)`
	);
}
