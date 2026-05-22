import type { PerfTimingSummary } from "./types";

const EMPTY_SUMMARY: PerfTimingSummary = {
	count: 0,
	totalMs: 0,
	avgMs: 0,
	minMs: 0,
	maxMs: 0,
	p50Ms: 0,
	p95Ms: 0,
};

/**
 * Linear-interpolated percentile over an ascending-sorted array. `p` is a
 * percentage in [0, 100]; out-of-range values are clamped. Matches the
 * "exclusive rank, interpolated" method most profilers use, so p50 of an even
 * sample set is the midpoint of the two central values rather than a raw pick.
 */
export function percentile(sortedAscending: readonly number[], p: number): number {
	const n = sortedAscending.length;
	if (n === 0) return 0;
	if (n === 1) return sortedAscending[0]!;

	const clamped = Math.min(100, Math.max(0, p));
	const rank = (clamped / 100) * (n - 1);
	const low = Math.floor(rank);
	const high = Math.ceil(rank);
	if (low === high) return sortedAscending[low]!;

	const weight = rank - low;
	return sortedAscending[low]! * (1 - weight) + sortedAscending[high]! * weight;
}

/** Collapse a list of duration samples (ms) into a single timing summary. */
export function summarizeSamples(samples: readonly number[]): PerfTimingSummary {
	const count = samples.length;
	if (count === 0) return { ...EMPTY_SUMMARY };

	const sorted = [...samples].sort((a, b) => a - b);
	const totalMs = sorted.reduce((acc, value) => acc + value, 0);

	return {
		count,
		totalMs,
		avgMs: totalMs / count,
		minMs: sorted[0]!,
		maxMs: sorted[count - 1]!,
		p50Ms: percentile(sorted, 50),
		p95Ms: percentile(sorted, 95),
	};
}
