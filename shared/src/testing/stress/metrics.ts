import { summarizeSamples } from "../../perf/stats";
import type { MetricRecord, MetricSummary } from "./types";

/** The timing-summary fields exposed as flattened budget/regression keys. */
const FLATTENED_STATS = ["count", "totalMs", "avgMs", "minMs", "maxMs", "p50Ms", "p95Ms"] as const;

/** Summarize each group of raw duration samples into a timing summary. */
export function summarizeSampleGroups(groups: Record<string, readonly number[]>): Record<string, MetricSummary> {
	const out: Record<string, MetricSummary> = {};
	for (const [name, samples] of Object.entries(groups)) {
		out[name] = summarizeSamples(samples);
	}
	return out;
}

/**
 * Flatten a `{ name -> summary }` map into `{ "name.stat" -> value }` so budgets
 * and baselines can reference a specific statistic, e.g. `nav.next.p95Ms`.
 */
export function flattenTimings(timings: Record<string, MetricSummary>): MetricRecord {
	const out: MetricRecord = {};
	for (const [name, summary] of Object.entries(timings)) {
		for (const stat of FLATTENED_STATS) {
			out[`${name}.${stat}`] = summary[stat];
		}
	}
	return out;
}

/**
 * Full flat view of a run's measurements: every timing statistic plus every
 * raw count, in one record keyed for budget evaluation.
 */
export function flattenMetrics(timings: Record<string, MetricSummary>, counts: MetricRecord): MetricRecord {
	return { ...flattenTimings(timings), ...counts };
}

/** Merge two timing maps; the right side wins on key collision. */
export function mergeTimings(
	base: Record<string, MetricSummary>,
	extra: Record<string, MetricSummary>
): Record<string, MetricSummary> {
	return { ...base, ...extra };
}
