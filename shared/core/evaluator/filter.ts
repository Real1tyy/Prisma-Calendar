import { BaseEvaluator, type BaseRule } from "./base";

export type FilterRule = BaseRule;

/**
 * Generic evaluator for filtering based on frontmatter expressions.
 * Extends BaseEvaluator to evaluate filter rules against frontmatter.
 * Returns true only if ALL rules evaluate to true.
 */
export class FilterEvaluator<TSettings extends { filterExpressions: string[] }> extends BaseEvaluator<
	FilterRule,
	TSettings
> {
	protected extractRules(settings: TSettings): FilterRule[] {
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
