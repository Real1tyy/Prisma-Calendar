import { pickReadableTextColor, type ColorEvaluator } from "@real1ty/obsidian-plugins";

import type { SingleCalendarConfig } from "../../types/settings";
import { normalizeFrontmatterForColorEvaluation } from "../filters/expressions";

// A half-step ladder of readability floors; 3:1 is the WCAG large-text
// minimum, 4.5:1 the AA normal-text level. `always-primary` uses 1 — a
// contrast ratio never drops below 1:1, so the primary always wins — and
// `maximum` omits the floor so the higher-contrast color always wins.
// Floors above ~4.6 would be indistinguishable from `maximum` for typical
// light/dark color pairs (below the floor, the same argmax decides), so the
// ladder deliberately stops at 4.5.
const CONTRAST_MODE_THRESHOLDS: Record<SingleCalendarConfig["eventTextContrastMode"], number | undefined> = {
	"always-primary": 1,
	minimal: 1.5,
	low: 2,
	moderate: 2.5,
	"prefer-primary": 3,
	high: 3.5,
	strong: 4,
	balanced: 4.5,
	maximum: undefined,
};

export function resolveTextColor(eventColor: string | undefined, settings: SingleCalendarConfig): string | undefined {
	if (!eventColor) return undefined;
	return pickReadableTextColor(
		eventColor,
		settings.eventTextColor,
		settings.eventTextColorAlt,
		CONTRAST_MODE_THRESHOLDS[settings.eventTextContrastMode]
	);
}

interface EventColorContext {
	settingsStore: { currentSettings: SingleCalendarConfig };
	getCalDAVSettings(): { integrationEventColor: string };
	getICSSubscriptionSettings(): { integrationEventColor: string };
}

function resolveIntegrationColor(meta: Record<string, unknown>, bundle: EventColorContext): string | undefined {
	const settings = bundle.settingsStore.currentSettings;

	if (meta[settings.caldavProp]) {
		const color = bundle.getCalDAVSettings().integrationEventColor;
		if (color) return color;
	}

	if (meta[settings.icsSubscriptionProp]) {
		const color = bundle.getICSSubscriptionSettings().integrationEventColor;
		if (color) return color;
	}

	return undefined;
}

export function resolveAllEventColors(
	meta: Record<string, unknown>,
	bundle: EventColorContext,
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>
): string[] {
	const integrationColor = resolveIntegrationColor(meta, bundle);
	if (integrationColor) return [integrationColor];

	const normalized = normalizeFrontmatterForColorEvaluation(meta, bundle.settingsStore.currentSettings.colorRules);
	return colorEvaluator.evaluateAllColors(normalized);
}

export function resolveEventColor(
	meta: Record<string, unknown>,
	bundle: EventColorContext,
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>
): string {
	const integrationColor = resolveIntegrationColor(meta, bundle);
	if (integrationColor) return integrationColor;

	const normalized = normalizeFrontmatterForColorEvaluation(meta, bundle.settingsStore.currentSettings.colorRules);
	return colorEvaluator.evaluateColor(normalized);
}
