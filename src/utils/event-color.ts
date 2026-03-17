import { type ColorEvaluator, parseIntoList } from "@real1ty-obsidian-plugins";

import type { SingleCalendarConfig } from "../types/settings";
import { normalizeFrontmatterForColorEvaluation } from "./expression-utils";

interface EventColorContext {
	settingsStore: { currentSettings: SingleCalendarConfig };
	getCalDAVSettings(): { integrationEventColor: string };
	getICSSubscriptionSettings(): { integrationEventColor: string };
}

/**
 * Resolves the display color for an event using the full priority chain:
 * 1. Integration color (CalDAV/ICS) — highest priority
 * 2. Color rules via ColorEvaluator — user-defined expression rules
 * 3. Default color — fallback from ColorEvaluator
 */
export function resolveEventColor(
	meta: Record<string, unknown>,
	bundle: EventColorContext,
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>
): string {
	const settings = bundle.settingsStore.currentSettings;

	if (meta[settings.caldavProp]) {
		const color = bundle.getCalDAVSettings().integrationEventColor;
		if (color) return color;
	}

	if (meta[settings.icsSubscriptionProp]) {
		const color = bundle.getICSSubscriptionSettings().integrationEventColor;
		if (color) return color;
	}

	const normalized = normalizeFrontmatterForColorEvaluation(meta, settings.colorRules);
	return colorEvaluator.evaluateColor(normalized);
}
