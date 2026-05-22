import {
	RegressionRuleSchema,
	type MetricSummary,
	type MetricUnit,
	type RegressionFinding,
	type RegressionRule,
	type StressBaseline,
	type StressRunReport,
} from "./types";

/** Canonical rule — the default values live on `RegressionRuleSchema`. */
export const DEFAULT_REGRESSION_RULE: RegressionRule = RegressionRuleSchema.parse({});

function pct(delta: number, base: number): number | null {
	return base === 0 ? null : (delta / base) * 100;
}

/**
 * Compare a run report against a same-machine baseline.
 *
 * - **Timings** use the candidate's p95 and fail only when it exceeds the
 *   baseline by both `rule.ratio` and `rule.minAbsoluteDelta` — noise alone
 *   never trips a regression.
 * - **Counts** are deterministic, so any difference is a regression.
 *
 * Metrics present in the baseline but missing from the report are skipped.
 */
export function compareToBaseline(
	report: StressRunReport,
	baseline: StressBaseline,
	rule: RegressionRule = DEFAULT_REGRESSION_RULE
): RegressionFinding[] {
	const findings: RegressionFinding[] = [];
	const timings = report.timings as Record<string, MetricSummary | undefined>;
	const counts = report.counts as Record<string, number | undefined>;

	function compareSection(
		baselineSlice: Record<string, number>,
		kind: RegressionFinding["kind"],
		unit: MetricUnit,
		candidateAt: (metric: string) => number | undefined,
		regressedWhen: (baseValue: number, candidate: number) => boolean
	): void {
		for (const [metric, baseValue] of Object.entries(baselineSlice)) {
			const candidate = candidateAt(metric);
			if (candidate === undefined) continue;

			const delta = candidate - baseValue;
			findings.push({
				metric,
				kind,
				baseline: baseValue,
				candidate,
				delta,
				deltaPct: pct(delta, baseValue),
				unit,
				regressed: regressedWhen(baseValue, candidate),
			});
		}
	}

	compareSection(
		baseline.timings,
		"timing",
		"ms",
		(metric) => timings[metric]?.p95Ms,
		(baseValue, candidate) => candidate > baseValue * rule.ratio && candidate - baseValue > rule.minAbsoluteDelta
	);

	compareSection(
		baseline.counts,
		"count",
		"count",
		(metric) => counts[metric],
		(baseValue, candidate) => candidate !== baseValue
	);

	return findings;
}

/** True when any finding regressed — the harness uses this to fail the run. */
export function hasRegression(findings: readonly RegressionFinding[]): boolean {
	return findings.some((finding) => finding.regressed);
}
