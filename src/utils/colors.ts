import { colord } from "colord";
import type { BehaviorSubject } from "rxjs";
import type { SingleCalendarConfig } from "../types/index";
import { BaseEvaluator, type BaseRule } from "./base-evaluator";

export interface ColorRule extends BaseRule {
	color: string;
}

export class ColorEvaluator extends BaseEvaluator<ColorRule, SingleCalendarConfig> {
	private defaultColor: string;

	constructor(settingsStore: BehaviorSubject<SingleCalendarConfig>) {
		super(settingsStore);
		this.defaultColor = settingsStore.value.defaultEventColor;

		settingsStore.subscribe((settings) => {
			if (settings.defaultEventColor) {
				this.defaultColor = settings.defaultEventColor;
			}
		});
	}

	protected extractRules(settings: SingleCalendarConfig): ColorRule[] {
		return settings.colorRules;
	}

	evaluateColor(frontmatter: Record<string, unknown>): string {
		const match = this.rules.find((rule) => this.isTruthy(this.evaluateRule(rule, frontmatter)));
		return match?.color ?? this.defaultColor;
	}
}

export function parseColor(color: string): { h: number; s: number; l: number } | null {
	const parsed = colord(color);
	if (!parsed.isValid()) {
		return null;
	}
	return parsed.toHsl();
}

/**
 * Generates an array of evenly distributed HSL colors for visualization.
 * Uses the HSL color space to create visually distinct colors by distributing
 * them evenly around the color wheel.
 *
 * @param count - Number of colors to generate
 * @param saturation - Saturation percentage (0-100), defaults to 70
 * @param lightness - Lightness percentage (0-100), defaults to 60
 * @returns Array of HSL color strings
 */
export function generateColors(count: number, saturation = 70, lightness = 60): string[] {
	if (count <= 0) return [];

	const colors: string[] = [];
	for (let i = 0; i < count; i++) {
		const hue = (i * 360) / count;
		colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
	}
	return colors;
}
