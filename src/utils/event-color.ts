import {
	type ColorEvaluator,
	hasVeryCloseShadeFromRgb,
	parseColorToRgb,
	type RgbColor,
} from "@real1ty-obsidian-plugins";

import type { SingleCalendarConfig } from "../types/settings";
import { normalizeFrontmatterForColorEvaluation } from "./expression-utils";

export function createTextColorResolver(): (
	eventColor: string | undefined,
	settings: SingleCalendarConfig
) => string | undefined {
	let cachedTextColorRgb: RgbColor | null = null;
	let cachedTextColorSource: string | null = null;

	return (eventColor, settings) => {
		if (!eventColor) return undefined;
		if (cachedTextColorSource !== settings.eventTextColor) {
			cachedTextColorRgb = parseColorToRgb(settings.eventTextColor);
			cachedTextColorSource = settings.eventTextColor;
		}
		if (!cachedTextColorRgb) return settings.eventTextColor;
		return hasVeryCloseShadeFromRgb(cachedTextColorRgb, eventColor)
			? settings.eventTextColorAlt
			: settings.eventTextColor;
	};
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
