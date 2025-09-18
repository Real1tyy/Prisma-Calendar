import { BaseEvaluator, type BaseRule } from "utils/evaluator-base";
import type { SingleCalendarConfig } from "../types/index";

export interface FilterRule extends BaseRule {}

export class FilterEvaluator extends BaseEvaluator<FilterRule, SingleCalendarConfig> {
	protected extractRules(settings: SingleCalendarConfig): FilterRule[] {
		return settings.filterExpressions.map((expression, index) => ({
			id: `filter-${index}`,
			expression,
			enabled: true,
		}));
	}

	evaluateFilters(frontmatter: Record<string, unknown>): boolean {
		if (this.compiledRules.length === 0) {
			return true;
		}

		return this.compiledRules.every((rule) => this.isTruthy(this.evaluateRule(rule, frontmatter)));
	}
}
