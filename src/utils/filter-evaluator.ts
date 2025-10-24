import type { SingleCalendarConfig } from "../types/index";
import { BaseEvaluator, type BaseRule } from "./base-evaluator";

export interface FilterRule extends BaseRule {}

export class FilterEvaluator extends BaseEvaluator<FilterRule, SingleCalendarConfig> {
	protected extractRules(settings: SingleCalendarConfig): FilterRule[] {
		return settings.filterExpressions.map((expression, index) => ({
			id: `filter-${index}`,
			expression: expression.trim(),
			enabled: true,
		}));
	}

	evaluateFilters(frontmatter: Record<string, unknown>): boolean {
		if (this.rules.length === 0) {
			return true;
		}

		return this.rules.every((rule) => {
			if (!rule.enabled || !rule.expression) {
				return true;
			}
			return this.evaluateRule(rule, frontmatter);
		});
	}
}
