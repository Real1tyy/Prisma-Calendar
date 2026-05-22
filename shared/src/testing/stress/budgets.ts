import type { BudgetFailure, MetricRecord, StressBudget, StressBudgetRule } from "./types";

function violates(actual: number, rule: StressBudgetRule): boolean {
	switch (rule.comparison) {
		case "max":
			return actual > rule.value;
		case "min":
			return actual < rule.value;
		case "exact":
			return actual !== rule.value;
	}
}

/**
 * Compare a flattened metric record against per-metric budget rules
 * (`max`/`min`/`exact`). A budget key with no matching metric is skipped (the
 * metric wasn't collected this run) rather than treated as pass or fail.
 */
export function evaluateBudgets(metrics: MetricRecord, budget: StressBudget): BudgetFailure[] {
	const failures: BudgetFailure[] = [];
	for (const [metric, rule] of Object.entries(budget)) {
		const actual = metrics[metric];
		if (actual === undefined) continue;
		if (!violates(actual, rule)) continue;

		const delta = actual - rule.value;
		// A percentage is meaningless for exact assertions or a zero reference.
		const deltaPct = rule.comparison === "exact" || rule.value === 0 ? null : (delta / rule.value) * 100;

		failures.push({
			metric,
			comparison: rule.comparison,
			actual,
			expected: rule.value,
			delta,
			deltaPct,
			...(rule.unit !== undefined ? { unit: rule.unit } : {}),
		});
	}
	return failures;
}
