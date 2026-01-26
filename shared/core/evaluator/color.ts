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

	evaluateColor(frontmatter: Record<string, unknown>): string {
		const match = this.rules.find((rule) => this.isTruthy(this.evaluateRule(rule, frontmatter)));
		return match?.color ?? this.defaultColor;
	}
}
