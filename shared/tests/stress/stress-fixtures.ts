import type { EnvironmentInfo, MetricSummary, StressRunReport } from "../../src/testing/stress/types";

export const TEST_ENVIRONMENT: EnvironmentInfo = {
	os: "Linux 6.0",
	arch: "x64",
	cpuModel: "Test CPU",
	cpuCount: 8,
	totalMemoryBytes: 16_000_000_000,
	nodeVersion: "v20.0.0",
};

/** A flat timing summary where every percentile equals `value` (test convenience). */
export function summary(value: number, overrides: Partial<MetricSummary> = {}): MetricSummary {
	return {
		count: 1,
		totalMs: value,
		avgMs: value,
		minMs: value,
		maxMs: value,
		p50Ms: value,
		p95Ms: value,
		...overrides,
	};
}

export function makeRunReport(overrides: Partial<StressRunReport> = {}): StressRunReport {
	return {
		runId: "run-1",
		scenario: "calendar-navigation",
		profile: "small",
		startedAt: "2026-05-21T00:00:00.000Z",
		finishedAt: "2026-05-21T00:00:01.000Z",
		status: "pass",
		environment: TEST_ENVIRONMENT,
		config: { seed: 42, repeats: 5, warmup: 1, collectors: ["prisma", "cdp"] },
		git: { branch: "main", commit: "abc1234def5678", dirty: false },
		timings: {},
		counts: {},
		budgetFailures: [],
		regressions: [],
		artifacts: [],
		...overrides,
	};
}
