import { type ColorEvaluator, parseIntoList } from "@real1ty-obsidian-plugins";
import type { CalendarBundle } from "../core/calendar-bundle";
import type { SingleCalendarConfig } from "../types/settings";
import { normalizeFrontmatterForColorEvaluation } from "./expression-utils";

/**
 * Resolves the category color for an event based on its frontmatter metadata.
 * Returns the color of the first matching category, or undefined if none found.
 */
export function resolveEventCategoryColor(
	meta: Record<string, unknown>,
	categoryProp: string | undefined,
	categoriesWithColors: Array<{ name: string; color: string }>
): string | undefined {
	if (!categoryProp) return undefined;
	const categories = parseIntoList(meta[categoryProp]);
	if (categories.length === 0) return undefined;
	return categoriesWithColors.find((c) => c.name === categories[0])?.color;
}

/**
 * Resolves the display color for an event using the full priority chain:
 * 1. Integration color (CalDAV/ICS) — highest priority
 * 2. Color rules via ColorEvaluator — user-defined expression rules
 * 3. Default color — fallback from ColorEvaluator
 */
export function resolveEventColor(
	meta: Record<string, unknown>,
	bundle: CalendarBundle,
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>
): string {
	const settings = bundle.settingsStore.currentSettings;

	if (meta[settings.caldavProp]) {
		return bundle.getCalDAVSettings().integrationEventColor;
	}

	if (meta[settings.icsSubscriptionProp]) {
		return bundle.getICSSubscriptionSettings().integrationEventColor;
	}

	const normalized = normalizeFrontmatterForColorEvaluation(meta, settings.colorRules);
	return colorEvaluator.evaluateColor(normalized);
}
