import { z } from "zod";

import type { PerfTimingSummary } from "../../perf/types";

// Single source of truth for the deterministic stress / performance harness.
// Schemas own the shape AND the defaults; every TS type is inferred via
// `z.infer` so there's nothing to keep in sync by hand. Schemas that cross a
// parse boundary (baselines read off disk) get real validation; output-only
// shapes (the run report) use the schema purely for inference + centralization.
// This runtime is test-only and consumed via `@real1ty-obsidian-plugins/testing/stress`.

/** Unit a metric is expressed in — drives report formatting + delta semantics. */
export const MetricUnitSchema = z.enum(["ms", "count", "bytes", "ratio"]);
export type MetricUnit = z.infer<typeof MetricUnitSchema>;

/** Family of a metric — not every regression is measured in milliseconds. */
export const MetricKindSchema = z.enum(["timing", "count", "memory", "ratio"]);
export type MetricKind = z.infer<typeof MetricKindSchema>;

/** How a budget value is interpreted against the actual measurement. */
export const BudgetComparisonSchema = z.enum(["max", "min", "exact"]);
export type BudgetComparison = z.infer<typeof BudgetComparisonSchema>;

/** A flat bag of named numeric measurements (ms or unit-less counts). */
export const MetricRecordSchema = z.record(z.string(), z.number());
export type MetricRecord = z.infer<typeof MetricRecordSchema>;

/**
 * Aggregated stats for one metric — identical to the perf tracker's summary,
 * which owns the canonical shape. `z.custom` keeps that single definition while
 * still letting the report schema reference it (the report is output-only, so no
 * runtime validation of this field is needed).
 */
export type MetricSummary = PerfTimingSummary;
export const MetricSummarySchema = z.custom<MetricSummary>();

export const GitInfoSchema = z.object({
	branch: z.string(),
	commit: z.string(),
	dirty: z.boolean(),
});
export type GitInfo = z.infer<typeof GitInfoSchema>;

/** The host + toolchain a run was captured on — baselines are same-machine. */
export const EnvironmentInfoSchema = z.object({
	os: z.string(),
	arch: z.string(),
	cpuModel: z.string(),
	cpuCount: z.number(),
	totalMemoryBytes: z.number(),
	nodeVersion: z.string(),
	playwrightVersion: z.string().optional(),
	obsidianVersion: z.string().optional(),
	electronVersion: z.string().optional(),
	chromiumVersion: z.string().optional(),
	pluginVersion: z.string().optional(),
});
export type EnvironmentInfo = z.infer<typeof EnvironmentInfoSchema>;

/**
 * Base shape every plugin's vault profile satisfies. Plugins extend this with
 * their own knobs (large notes, multi-weekday recurrences, …) and pass the
 * extended type through `generateVault`'s generic.
 */
export const VaultProfileSchema = z.object({
	name: z.string(),
	events: z.number(),
	recurring: z.number(),
});
export type VaultProfile = z.infer<typeof VaultProfileSchema>;

/**
 * A budget rule for one metric. `max` (must stay under), `min` (must stay over),
 * or `exact` (must equal) — so a single budget map covers timings, counts,
 * memory, and leak assertions.
 */
export const StressBudgetRuleSchema = z.object({
	comparison: BudgetComparisonSchema,
	value: z.number(),
	unit: MetricUnitSchema.optional(),
	description: z.string().optional(),
});
export type StressBudgetRule = z.infer<typeof StressBudgetRuleSchema>;

export const StressBudgetSchema = z.record(z.string(), StressBudgetRuleSchema);
export type StressBudget = z.infer<typeof StressBudgetSchema>;

export const BudgetFailureSchema = z.object({
	metric: z.string(),
	comparison: BudgetComparisonSchema,
	actual: z.number(),
	expected: z.number(),
	delta: z.number(),
	/** null when a percentage is undefined (exact comparison, or zero baseline). */
	deltaPct: z.number().nullable(),
	unit: MetricUnitSchema.optional(),
});
export type BudgetFailure = z.infer<typeof BudgetFailureSchema>;

/**
 * Regression is judged against a same-machine baseline: a metric fails only
 * when the candidate exceeds the baseline by BOTH a ratio and an absolute floor
 * (so machine noise alone never trips it). Counts must match exactly. The
 * defaults live here — `RegressionRuleSchema.parse({})` yields the canonical rule.
 */
export const RegressionRuleSchema = z.object({
	ratio: z.number().default(1.25),
	minAbsoluteDelta: z.number().default(30),
	unit: MetricUnitSchema.optional(),
});
export type RegressionRule = z.infer<typeof RegressionRuleSchema>;

export const RegressionFindingSchema = z.object({
	metric: z.string(),
	kind: MetricKindSchema,
	baseline: z.number(),
	candidate: z.number(),
	delta: z.number(),
	/** null when a percentage is undefined (zero baseline). */
	deltaPct: z.number().nullable(),
	unit: MetricUnitSchema.optional(),
	regressed: z.boolean(),
});
export type RegressionFinding = z.infer<typeof RegressionFindingSchema>;

/** Committed, user-blessed reference numbers for one scenario × profile. */
export const StressBaselineSchema = z.object({
	scenario: z.string(),
	profile: z.string(),
	capturedAt: z.string(),
	environment: EnvironmentInfoSchema,
	/** p95 (ms) per timing metric — the regression anchor. */
	timings: z.record(z.string(), z.number()),
	/** Deterministic counts. */
	counts: z.record(z.string(), z.number()),
});
export type StressBaseline = z.infer<typeof StressBaselineSchema>;

export const StressRunConfigSchema = z.object({
	seed: z.number().default(42),
	repeats: z.number().default(5),
	warmup: z.number().default(1),
	collectors: z.array(z.string()).default([]),
});
export type StressRunConfig = z.infer<typeof StressRunConfigSchema>;

/**
 * One function's self-time, parsed from a CDP CPU profile (`.cpuprofile`). Many
 * call-tree nodes share a call frame; the digest collapses them into one row.
 */
export const ProfileDigestEntrySchema = z.object({
	functionName: z.string(),
	url: z.string(),
	/** 1-based source line (0 when the frame has no location, e.g. native code). */
	line: z.number(),
	/** `file.ts:NN` or the bare function name for native/synthetic frames. */
	location: z.string(),
	selfTimeMs: z.number(),
	/** Share of total profiled time (0–100). */
	selfPct: z.number(),
	hitCount: z.number(),
});
export type ProfileDigestEntry = z.infer<typeof ProfileDigestEntrySchema>;

/**
 * Top self-time functions from a CPU profile — the agent-readable bottleneck map
 * that turns "stage X is slow" into "function:line is N% of it" without a GUI.
 */
export const ProfileDigestSchema = z.object({
	sampleCount: z.number(),
	durationMs: z.number(),
	totalSelfTimeMs: z.number(),
	topSelfTime: z.array(ProfileDigestEntrySchema),
});
export type ProfileDigest = z.infer<typeof ProfileDigestSchema>;

/**
 * One object type's footprint in a heap snapshot — live-node count + summed self
 * size. The leak-harness analogue of a `ProfileDigestEntry`.
 */
export const HeapDigestEntrySchema = z.object({
	type: z.string(),
	count: z.number(),
	selfSizeBytes: z.number(),
});
export type HeapDigestEntry = z.infer<typeof HeapDigestEntrySchema>;

/**
 * What pins detached nodes alive: the holder's type + the edge (field) the
 * reference travels through, with how many detached nodes it retains — the
 * structured "what's leaking this?" answer (e.g. `object._listeners` × 12000).
 */
export const RetainerEntrySchema = z.object({
	retainer: z.string(),
	count: z.number(),
});
export type RetainerEntry = z.infer<typeof RetainerEntrySchema>;

/**
 * Structured summary of a `.heapsnapshot` — node/edge totals, retained self size,
 * the detached-DOM count (the classic retained-view leak signal), the heaviest
 * object types, and the dominant retainers of the detached set — so an agent reads
 * the leak shape (and its cause) without opening DevTools.
 */
export const HeapDigestSchema = z.object({
	nodeCount: z.number(),
	edgeCount: z.number(),
	totalSizeBytes: z.number(),
	detachedNodeCount: z.number(),
	topTypes: z.array(HeapDigestEntrySchema),
	topRetainers: z.array(RetainerEntrySchema),
});
export type HeapDigest = z.infer<typeof HeapDigestSchema>;

/** A heavy artifact a run produced, so an agent can find the profile/trace/heap. */
export const StressArtifactSchema = z.object({
	kind: z.enum([
		"json",
		"markdown",
		"html",
		"cpu-profile",
		"trace",
		"heap-snapshot",
		"playwright-trace",
		"log",
		"screenshot",
	]),
	path: z.string(),
	description: z.string().optional(),
});
export type StressArtifact = z.infer<typeof StressArtifactSchema>;

export const StressRunReportSchema = z.object({
	runId: z.string(),
	scenario: z.string(),
	profile: z.string(),
	startedAt: z.string(),
	finishedAt: z.string(),
	status: z.enum(["pass", "fail"]),
	git: GitInfoSchema,
	environment: EnvironmentInfoSchema,
	config: StressRunConfigSchema,
	/** Aggregated timing metrics across repeats (ms). */
	timings: z.record(z.string(), MetricSummarySchema),
	/** Deterministic counts captured for the run. */
	counts: MetricRecordSchema,
	budgetFailures: z.array(BudgetFailureSchema),
	regressions: z.array(RegressionFindingSchema),
	artifacts: z.array(StressArtifactSchema),
	/** Self-time digest from the profiled "explain" pass; absent on clean-only runs. */
	profileDigest: ProfileDigestSchema.optional(),
	/** Heap-snapshot digest from a memory scenario; absent on non-memory runs. */
	heapDigest: HeapDigestSchema.optional(),
});
export type StressRunReport = z.infer<typeof StressRunReportSchema>;
