import type { FrontmatterDiff } from "@real1ty-obsidian-plugins";

import { INTERNAL_FRONTMATTER_PROPERTIES } from "../../constants";
import type { Frontmatter, SingleCalendarConfig } from "../../types";
import {
	DEDICATED_UI_PROP_KEYS,
	NOTIFICATION_DEDICATED_UI_PROP_KEYS,
	NOTIFICATION_SYSTEM_PROP_KEYS,
	SYSTEM_PROP_KEYS,
} from "../../types/settings";

/**
 * Parses a custom done property DSL expression.
 * Format: "propertyName value" (e.g., "archived true", "status completed", "priority 1")
 * Values are auto-parsed: "true"/"false" → boolean, numeric strings → number, rest → string.
 */
export const parseCustomDoneProperty = (expression: string): { key: string; value: unknown } | null => {
	const trimmed = expression.trim();
	if (!trimmed) return null;

	const spaceIndex = trimmed.indexOf(" ");
	if (spaceIndex === -1) return null;

	const key = trimmed.substring(0, spaceIndex).trim();
	const rawValue = trimmed.substring(spaceIndex + 1).trim();

	if (!key || !rawValue) return null;

	if (rawValue === "true") return { key, value: true };
	if (rawValue === "false") return { key, value: false };

	const num = Number(rawValue);
	if (!Number.isNaN(num)) return { key, value: num };

	return { key, value: rawValue };
};

const resolveKeys = (settings: SingleCalendarConfig, keys: readonly string[]): string[] =>
	keys.map((key) => String(settings[key as keyof SingleCalendarConfig] ?? "")).filter((v) => v !== "");

/**
 * Returns per-instance system properties that should NOT be copied from a source
 * recurring event to its physical instances. These are fields Prisma sets or
 * recalculates for each instance (timing, identity, recurrence metadata).
 */
const getRecurringInstanceSystemProps = (settings: SingleCalendarConfig): Set<string> => {
	return new Set([...resolveKeys(settings, SYSTEM_PROP_KEYS), ...resolveKeys(settings, NOTIFICATION_SYSTEM_PROP_KEYS)]);
};

/**
 * Returns ALL Prisma-managed internal properties that should not be displayed
 * in UI as regular display properties. Combines the recurring-instance system
 * props with user-facing props that have their own dedicated rendering.
 *
 * Driven by DEDICATED_UI_PROP_KEYS and NOTIFICATION_DEDICATED_UI_PROP_KEYS in settings.ts.
 */
export function getInternalProperties(settings: SingleCalendarConfig): Set<string> {
	const systemProps = getRecurringInstanceSystemProps(settings);
	const dedicatedProps = [
		...resolveKeys(settings, DEDICATED_UI_PROP_KEYS),
		...resolveKeys(settings, NOTIFICATION_DEDICATED_UI_PROP_KEYS),
		...INTERNAL_FRONTMATTER_PROPERTIES,
	];

	return new Set([...systemProps, ...dedicatedProps]);
}

/**
 * Returns properties excluded from propagation.
 * Uses the per-instance system props as the base, plus any user-configured exclusions.
 */
export const getExcludedProps = (settings: SingleCalendarConfig, userExcludedCsv: string): Set<string> => {
	const systemProps = getRecurringInstanceSystemProps(settings);

	if (userExcludedCsv) {
		const userExcludedProps = userExcludedCsv
			.split(",")
			.map((prop) => prop.trim())
			.filter((prop) => prop !== "");
		return new Set([...systemProps, ...userExcludedProps]);
	}
	return systemProps;
};

/**
 * Filters a frontmatter diff to remove excluded properties based on settings.
 * Returns a new diff with only non-excluded properties.
 */
export const filterExcludedPropsFromDiff = (diff: FrontmatterDiff, excludedProps: Set<string>): FrontmatterDiff => {
	const filteredAdded = diff.added.filter((change) => !excludedProps.has(change.key));
	const filteredModified = diff.modified.filter((change) => !excludedProps.has(change.key));
	const filteredDeleted = diff.deleted.filter((change) => !excludedProps.has(change.key));

	const hasChanges = filteredAdded.length > 0 || filteredModified.length > 0 || filteredDeleted.length > 0;

	return {
		...diff,
		added: filteredAdded,
		modified: filteredModified,
		deleted: filteredDeleted,
		hasChanges,
	};
};

/**
 * Returns a smaller exclusion set for batch frontmatter operations.
 * Only excludes core scheduling properties and Obsidian internals,
 * allowing user-facing properties like location, participants, and icon to be shown.
 */
export const getBatchFrontmatterExcludedProps = (settings: SingleCalendarConfig): Set<string> => {
	return new Set(
		[
			settings.startProp,
			settings.endProp,
			settings.dateProp,
			settings.sortDateProp,
			settings.allDayProp,
			settings.categoryProp,
			settings.calendarTitleProp,
			"position",
		].filter((prop): prop is string => prop !== undefined && prop !== "")
	);
};

export const assignListToFrontmatter = (fm: Frontmatter, prop: string, items: string[]): void => {
	if (items.length === 0) {
		fm[prop] = "";
	} else if (items.length === 1) {
		fm[prop] = items[0];
	} else {
		fm[prop] = items;
	}
};

/**
 * Removes properties from frontmatter that should not be cloned/duplicated.
 * These include recurring event metadata and notification status that are specific
 * to the original event and should not carry over to clones.
 */
export const removeNonCloneableProperties = (frontmatter: Frontmatter, settings: SingleCalendarConfig): void => {
	delete frontmatter[settings.rruleIdProp];
	delete frontmatter[settings.instanceDateProp];
	delete frontmatter[settings.sourceProp];
	delete frontmatter[settings.alreadyNotifiedProp];
};
