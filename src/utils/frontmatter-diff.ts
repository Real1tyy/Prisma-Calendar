import type { Frontmatter } from "../types";

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
		} else if (!deepEqual(oldValue, newValue)) {
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
 * Deep equality check for frontmatter values.
 * Handles primitives, arrays, and objects.
 */
function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;

	if (a === null || b === null || a === undefined || b === undefined) {
		return a === b;
	}

	if (typeof a !== typeof b) return false;

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((val, idx) => deepEqual(val, b[idx]));
	}

	if (typeof a === "object" && typeof b === "object") {
		const keysA = Object.keys(a as Record<string, unknown>);
		const keysB = Object.keys(b as Record<string, unknown>);

		if (keysA.length !== keysB.length) return false;

		return keysA.every((key) => deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
	}

	return false;
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
		return String(value);
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
