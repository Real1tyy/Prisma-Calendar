import { BaseEvaluator, type BaseRule } from "@real1ty-obsidian-plugins/utils";
import type { SingleCalendarConfig } from "../types/settings";

interface UntrackedFilterRule extends BaseRule {}

/**
 * Filter evaluator specifically for untracked events.
 * Uses untrackedFilterExpressions instead of filterExpressions.
 */
export class UntrackedFilterEvaluator extends BaseEvaluator<UntrackedFilterRule, SingleCalendarConfig> {
	protected extractRules(settings: SingleCalendarConfig): UntrackedFilterRule[] {
		return settings.untrackedFilterExpressions.map((expression, index) => ({
			id: `untracked-filter-${index}`,
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
