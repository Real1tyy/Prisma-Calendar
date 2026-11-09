import type { FrontmatterIntegrityEvent, FrontmatterIntegrityStats, HealthCheck } from "@real1ty/obsidian-plugins";

import { log } from "./logging";

/**
 * How the event table's duplicate-key repairs reach the user and a bug report:
 * one log line per repair, and a Doctor row over the session's counters.
 * See [[decision-vaulttable-frontmatter-integrity]].
 */

/** A sub-area of indexing, so the indexing row keeps speaking for the scan alone. */
export const FRONTMATTER_INTEGRITY_SCOPE = "indexing.integrity";

export const EMPTY_INTEGRITY_STATS: Readonly<FrontmatterIntegrityStats> = Object.freeze({
	repairs: 0,
	duplicateKeysCollapsed: 0,
	conflictingValuesDropped: 0,
	repairFailures: 0,
});

export function addIntegrityStats(
	a: FrontmatterIntegrityStats,
	b: FrontmatterIntegrityStats
): FrontmatterIntegrityStats {
	return {
		repairs: a.repairs + b.repairs,
		duplicateKeysCollapsed: a.duplicateKeysCollapsed + b.duplicateKeysCollapsed,
		conflictingValuesDropped: a.conflictingValuesDropped + b.conflictingValuesDropped,
		repairFailures: a.repairFailures + b.repairFailures,
	};
}

/**
 * A repair is self-healing, so `warn` ([[decision-logging-convention-levels-scopes-and-the-service-over-console]]).
 * The discarded values are note content and never logged — the keys that lost
 * one are, so the user knows which property to check in file history.
 */
export function logFrontmatterIntegrityEvent(event: FrontmatterIntegrityEvent): void {
	if (event.type === "repair-failed") {
		log.error(FRONTMATTER_INTEGRITY_SCOPE, "Duplicated properties could not be repaired", {
			filePath: event.filePath,
			trigger: event.trigger,
			error: event.error,
		});
		return;
	}

	const discarded = event.duplicates.filter((report) => report.droppedValues.length > 0).map((report) => report.key);
	log.warn(
		FRONTMATTER_INTEGRITY_SCOPE,
		discarded.length > 0
			? "Repaired duplicated properties and discarded conflicting values"
			: "Repaired duplicated properties",
		{
			filePath: event.filePath,
			trigger: event.trigger,
			duplicateKeys: event.duplicates.map((report) => report.key).join(", "),
			duplicateKeyCount: event.duplicates.length,
			droppedValueCount: event.droppedValueCount,
			discardedValueKeys: discarded.join(", "),
		}
	);
}

function describeRepairs(stats: FrontmatterIntegrityStats): string {
	const notes = stats.repairs === 1 ? "1 note that had" : `${stats.repairs} notes that had`;
	const properties = stats.duplicateKeysCollapsed === 1 ? "1 property" : `${stats.duplicateKeysCollapsed} properties`;
	return `Repaired ${notes} a property listed twice (${properties})`;
}

export function buildFrontmatterIntegrityCheck(stats: FrontmatterIntegrityStats): HealthCheck {
	const base = { id: "frontmatter-integrity", label: "Frontmatter integrity" };

	if (stats.repairFailures > 0) {
		const notes = stats.repairFailures === 1 ? "1 note has" : `${stats.repairFailures} notes have`;
		return {
			...base,
			status: "fail",
			detail: `${notes} a property listed twice and could not be repaired, so the calendar cannot read them — the logs name each note.`,
		};
	}

	if (stats.conflictingValuesDropped > 0) {
		const values =
			stats.conflictingValuesDropped === 1
				? "1 conflicting value was"
				: `${stats.conflictingValuesDropped} conflicting values were`;
		return {
			...base,
			status: "warn",
			detail: `${describeRepairs(stats)}. ${values} replaced by the later one — the logs name the note and property.`,
		};
	}

	if (stats.repairs > 0) {
		return { ...base, status: "ok", detail: `${describeRepairs(stats)} — nothing was lost.` };
	}

	return { ...base, status: "ok", detail: "No notes with duplicated properties were found in this session." };
}
