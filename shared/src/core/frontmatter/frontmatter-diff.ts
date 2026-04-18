import { deepEqualJsonLike } from "../../utils/deep-equal";

export type Frontmatter = Record<string, unknown>;

export interface FrontmatterChange {
	key: string;
	oldValue: unknown;
	newValue: unknown;
	changeType: "added" | "modified" | "deleted";
}

export interface FrontmatterDiff {
	hasChanges: boolean;
	changes: FrontmatterChange[];
	added: FrontmatterChange[];
	modified: FrontmatterChange[];
	deleted: FrontmatterChange[];
}

/**
 * Compares two frontmatter objects and returns a detailed diff.
 * Excludes specified properties from comparison (e.g., Prisma-managed properties).
 *
 * @param oldFrontmatter - The original frontmatter
 * @param newFrontmatter - The updated frontmatter
 * @param excludeProps - Set of property keys to exclude from comparison
 * @returns Detailed diff with categorized changes
 */
export function compareFrontmatter(
	oldFrontmatter: Frontmatter,
	newFrontmatter: Frontmatter,
	excludeProps: Set<string> = new Set()
): FrontmatterDiff {
	const changes: FrontmatterChange[] = [];
	const added: FrontmatterChange[] = [];
	const modified: FrontmatterChange[] = [];
	const deleted: FrontmatterChange[] = [];

	const allKeys = new Set([...Object.keys(oldFrontmatter), ...Object.keys(newFrontmatter)]);

	for (const key of allKeys) {
		if (excludeProps.has(key)) {
			continue;
		}

		const oldValue = oldFrontmatter[key];
		const newValue = newFrontmatter[key];

		if (!(key in oldFrontmatter) && key in newFrontmatter) {
			const change: FrontmatterChange = {
				key,
				oldValue: undefined,
				newValue,
				changeType: "added",
			};

			changes.push(change);
			added.push(change);
		} else if (key in oldFrontmatter && !(key in newFrontmatter)) {
			const change: FrontmatterChange = {
				key,
				oldValue,
				newValue: undefined,
				changeType: "deleted",
			};

			changes.push(change);
			deleted.push(change);
		} else if (!deepEqualJsonLike(oldValue, newValue)) {
			const change: FrontmatterChange = {
				key,
				oldValue,
				newValue,
				changeType: "modified",
			};

			changes.push(change);
			modified.push(change);
		}
	}

	return {
		hasChanges: changes.length > 0,
		changes,
		added,
		modified,
		deleted,
	};
}

/**
 * Merges multiple frontmatter diffs into a single accumulated diff.
 * Later diffs override earlier ones for the same key.
 *
 * @param diffs - Array of diffs to merge (in chronological order)
 * @returns A single merged diff containing all accumulated changes
 */
export function mergeFrontmatterDiffs(diffs: FrontmatterDiff[]): FrontmatterDiff {
	if (diffs.length === 0) {
		return {
			hasChanges: false,
			changes: [],
			added: [],
			modified: [],
			deleted: [],
		};
	}

	if (diffs.length === 1) {
		return diffs[0];
	}

	const changesByKey = new Map<string, FrontmatterChange>();

	for (const diff of diffs) {
		for (const change of diff.changes) {
			const existing = changesByKey.get(change.key);

			if (!existing) {
				changesByKey.set(change.key, { ...change });
			} else {
				existing.newValue = change.newValue;

				if (change.changeType === "deleted" && existing.changeType === "added") {
					changesByKey.delete(change.key);
				} else if (existing.changeType !== "added") {
					existing.changeType = change.changeType;
				}

				if (changesByKey.has(change.key) && deepEqualJsonLike(existing.oldValue, existing.newValue)) {
					changesByKey.delete(change.key);
				}
			}
		}
	}

	const allChanges = Array.from(changesByKey.values());
	const added = allChanges.filter((c) => c.changeType === "added");
	const modified = allChanges.filter((c) => c.changeType === "modified");
	const deleted = allChanges.filter((c) => c.changeType === "deleted");

	return {
		hasChanges: allChanges.length > 0,
		changes: allChanges,
		added,
		modified,
		deleted,
	};
}

/**
 * Formats a frontmatter change for display in a modal.
 * Returns a human-readable string describing the change.
 */
export function formatChangeForDisplay(change: FrontmatterChange): string {
	const formatValue = (value: unknown): string => {
		if (value === undefined) return "(not set)";
		if (value === null) return "null";
		if (typeof value === "string") return `"${value}"`;
		if (typeof value === "object") return JSON.stringify(value);
		if (typeof value === "number" || typeof value === "boolean") return String(value);
		return JSON.stringify(value);
	};

	switch (change.changeType) {
		case "added":
			return `+ ${change.key}: ${formatValue(change.newValue)}`;
		case "deleted":
			return `- ${change.key}: ${formatValue(change.oldValue)}`;
		case "modified":
			return `~ ${change.key}: ${formatValue(change.oldValue)} → ${formatValue(change.newValue)}`;
	}
}
