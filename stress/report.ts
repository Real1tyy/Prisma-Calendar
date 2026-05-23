import path from "node:path";

import {
	baselineFileName,
	buildArtifactDir,
	buildProfileTree,
	buildRunStem,
	captureEnvironment,
	captureGitInfo,
	compareToBaseline,
	digestCpuProfile,
	evaluateBudgets,
	flattenMetrics,
	hasRegression,
	loadBundleSourceMap,
	pruneProfileTree,
	readBaseline,
	reportToBaseline,
	writeBaseline,
	writeRunReports,
	type CpuProfile,
	type FrameResolver,
	type HeapDigest,
	type StressArtifact,
	type StressRunReport,
} from "@real1ty-obsidian-plugins/testing/stress";

import { BUDGETS, STRESS_CONFIG } from "./stress.config";

// Shared report assembly for every Prisma stress spec. Each spec owns its
// measurement + assertions; this owns the boilerplate they'd otherwise all
// duplicate — runId/dir, sourcemap-resolved CPU digest + flame tree, env/git,
// budget eval, baseline compare, and writing run.json/report.md/report.html.

/** Build a resolver from the stress build's external sourcemap, or undefined if absent. */
export function loadPrismaSourceMap(): FrameResolver | undefined {
	return (
		loadBundleSourceMap({
			mapPath: path.join(process.cwd(), "main.js.map"),
			matchesBundle: (url) => url.includes("prisma-calendar") || url.endsWith("main.js"),
		}) ?? undefined
	);
}

/** Allocate a run id + its artifact directory up front, so the spec can write heavy artifacts into it before the report. */
export function createStressRun(scenario: string, profileName: string): { runId: string; artifactDir: string } {
	const runId = buildRunStem({ profile: profileName, scenario });
	return { runId, artifactDir: buildArtifactDir(STRESS_CONFIG.artifactRoot, runId) };
}

export interface StressReportInput {
	runId: string;
	artifactDir: string;
	scenario: string;
	profileName: string;
	startedAt: string;
	finishedAt: string;
	timings: StressRunReport["timings"];
	counts: StressRunReport["counts"];
	collectors: string[];
	repeats?: number | undefined;
	warmup?: number | undefined;
	pluginVersion?: string | undefined;
	/** When provided, drives the self-time digest + flame-chart call tree. */
	cpuProfile?: CpuProfile | undefined;
	resolveFrame?: FrameResolver | undefined;
	heapDigest?: HeapDigest | undefined;
	/** Heavy artifacts (cpu profile, heap snapshots) the spec already wrote. */
	extraArtifacts?: StressArtifact[] | undefined;
}

export interface WrittenStressReport {
	report: StressRunReport;
	markdownPath: string;
	htmlPath: string;
}

export function writeStressReport(input: StressReportInput): WrittenStressReport {
	const artifacts: StressArtifact[] = [
		{ kind: "json", path: path.join(input.artifactDir, "run.json") },
		{ kind: "markdown", path: path.join(input.artifactDir, "report.md") },
		{
			kind: "html",
			path: path.join(input.artifactDir, "report.html"),
			description: "Interactive report + flame chart",
		},
		...(input.extraArtifacts ?? []),
	];

	const digestOptions = input.resolveFrame ? { resolveFrame: input.resolveFrame } : {};
	const profileDigest = input.cpuProfile ? digestCpuProfile(input.cpuProfile, digestOptions) : undefined;
	const profileTree = input.cpuProfile
		? pruneProfileTree(buildProfileTree(input.cpuProfile, digestOptions))
		: undefined;

	const environment = {
		...captureEnvironment(),
		...(input.pluginVersion ? { pluginVersion: input.pluginVersion } : {}),
	};

	const report: StressRunReport = {
		runId: input.runId,
		scenario: input.scenario,
		profile: input.profileName,
		startedAt: input.startedAt,
		finishedAt: input.finishedAt,
		status: "pass",
		git: captureGitInfo(),
		environment,
		config: {
			seed: STRESS_CONFIG.seed,
			repeats: input.repeats ?? STRESS_CONFIG.repeats,
			warmup: input.warmup ?? STRESS_CONFIG.warmup,
			collectors: input.collectors,
		},
		timings: input.timings,
		counts: input.counts,
		budgetFailures: evaluateBudgets(flattenMetrics(input.timings, input.counts), BUDGETS[input.scenario] ?? {}),
		regressions: [],
		artifacts,
		...(profileDigest ? { profileDigest } : {}),
		...(input.heapDigest ? { heapDigest: input.heapDigest } : {}),
	};

	const baselinePath = path.join(STRESS_CONFIG.baselineDir, baselineFileName(input.scenario, input.profileName));
	const baseline = readBaseline(baselinePath);
	if (baseline) report.regressions = compareToBaseline(report, baseline);
	report.status = report.budgetFailures.length > 0 || hasRegression(report.regressions) ? "fail" : "pass";

	const { markdownPath, htmlPath } = writeRunReports(input.artifactDir, report, profileTree ? { profileTree } : {});
	if (process.env["PERF_BLESS"] === "1") {
		writeBaseline(baselinePath, reportToBaseline(report));
	}
	return { report, markdownPath, htmlPath };
}
