import { BaseEvaluator, type BaseRule } from "@real1ty-obsidian-plugins/utils/evaluator-base";
import { colord } from "colord";
import type { BehaviorSubject } from "rxjs";
import type { SingleCalendarConfig } from "../types/index";

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
		const match = this.compiledRules.find((rule) => this.isTruthy(this.evaluateRule(rule, frontmatter)));
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
