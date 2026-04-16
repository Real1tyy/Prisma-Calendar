import type { BehaviorSubject } from "rxjs";

import { BaseEvaluator, type BaseRule } from "./base";

export interface ColorRule extends BaseRule {
	color: string;
}

/**
 * Generic evaluator for determining colors based on frontmatter rules.
 * Extends BaseEvaluator to evaluate color rules against frontmatter.
 */
export class ColorEvaluator<
	TSettings extends { defaultNodeColor: string; colorRules: ColorRule[] },
> extends BaseEvaluator<ColorRule, TSettings> {
	private defaultColor: string;

	constructor(settingsStore: BehaviorSubject<TSettings>) {
		super(settingsStore);
		this.defaultColor = settingsStore.value.defaultNodeColor;

		settingsStore.subscribe((settings) => {
			if (settings.defaultNodeColor) {
				this.defaultColor = settings.defaultNodeColor;
			}
		});
	}

	protected extractRules(settings: TSettings): ColorRule[] {
		return settings.colorRules;
	}

	evaluateAllColors(frontmatter: Record<string, unknown>): string[] {
		return this.rules.filter((rule) => this.isTruthy(this.evaluateRule(rule, frontmatter))).map((rule) => rule.color);
	}

	evaluateColor(frontmatter: Record<string, unknown>): string {
		return this.evaluateAllColors(frontmatter)[0] ?? this.defaultColor;
	}
}
