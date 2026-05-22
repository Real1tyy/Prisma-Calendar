import path from "node:path";

import {
	baselineFileName,
	buildArtifactDir,
	buildRunStem,
	captureEnvironment,
	captureGitInfo,
	compareToBaseline,
	diffCdpMetrics,
	evaluateBudgets,
	flattenMetrics,
	generateVault,
	hasRegression,
	mergeTimings,
	namespaceCdpMetrics,
	readBaseline,
	readCdpPerformanceMetrics,
	readPerfBridge,
	reportToBaseline,
	resetPerfBridge,
	runRepeats,
	summarizeSampleGroups,
	writeBaseline,
	writeRunReports,
	type StressArtifact,
	type StressRunReport,
} from "@real1ty-obsidian-plugins/testing/stress";

import { expect, test } from "../../e2e/fixtures/electron";
import { indexerEventCount, waitForIndexerToReach } from "../../e2e/fixtures/stress-helpers";
import { navigateMonths, setMonthView } from "../scenarios/navigate-months";
import { BUDGETS, STRESS_CONFIG } from "../stress.config";
import { buildPrismaEvent } from "../vaults/event-builder";
import { SMALL_PROFILE } from "../vaults/profiles";

const SCENARIO = "calendar-navigation";
const PROFILE = SMALL_PROFILE;
const NOOP = (): void => {};

test.describe("stress: calendar navigation", () => {
	test(`${SCENARIO} @ ${PROFILE.name}`, async ({ calendar }) => {
		const { page, vaultDir } = calendar;

		// Seed a deterministic vault, then wait for the indexer to ingest it all.
		// Tolerate any pre-seeded events by anchoring on the pre-generation count.
		const baselineCount = await indexerEventCount(page);
		const expectedCount = baselineCount + PROFILE.events;
		generateVault({
			dir: path.join(vaultDir, PROFILE.directory),
			profile: PROFILE,
			seed: STRESS_CONFIG.seed,
			buildEvent: buildPrismaEvent,
		});
		await waitForIndexerToReach(page, expectedCount);

		await setMonthView(page);

		// Warmup passes are discarded (JIT warm-up, cache fill).
		for (let i = 0; i < STRESS_CONFIG.warmup; i++) {
			await navigateMonths(page, STRESS_CONFIG.navSteps, NOOP);
		}

		const cdp = await page.context().newCDPSession(page);
		await resetPerfBridge(page);
		const cdpBefore = await readCdpPerformanceMetrics(cdp);

		const startedAt = new Date().toISOString();
		const navSamples: number[] = [];
		await runRepeats({ warmup: 0, repeats: STRESS_CONFIG.repeats }, async () => {
			await navigateMonths(page, STRESS_CONFIG.navSteps, (ms) => navSamples.push(ms));
			return 0;
		});
		const finishedAt = new Date().toISOString();

		const snapshot = await readPerfBridge(page);
		const cdpAfter = await readCdpPerformanceMetrics(cdp);

		const timings = mergeTimings(summarizeSampleGroups({ "scenario.navigateStep": navSamples }), snapshot.timings);
		const counts: Record<string, number> = {
			...snapshot.counters,
			...namespaceCdpMetrics(cdpAfter, "cdp"),
			...namespaceCdpMetrics(diffCdpMetrics(cdpBefore, cdpAfter), "cdp.delta"),
		};

		const runId = buildRunStem({ profile: PROFILE.name, scenario: SCENARIO });
		const artifactDir = buildArtifactDir(STRESS_CONFIG.artifactRoot, runId);
		const artifacts: StressArtifact[] = [
			{ kind: "json", path: path.join(artifactDir, "run.json") },
			{ kind: "markdown", path: path.join(artifactDir, "report.md") },
		];

		const pluginVersion = snapshot.metadata?.["pluginVersion"];
		const environment = {
			...captureEnvironment(),
			...(typeof pluginVersion === "string" ? { pluginVersion } : {}),
		};

		const report: StressRunReport = {
			runId,
			scenario: SCENARIO,
			profile: PROFILE.name,
			startedAt,
			finishedAt,
			status: "pass",
			git: captureGitInfo(),
			environment,
			config: {
				seed: STRESS_CONFIG.seed,
				repeats: STRESS_CONFIG.repeats,
				warmup: STRESS_CONFIG.warmup,
				collectors: ["prisma", "cdp"],
			},
			timings,
			counts,
			budgetFailures: evaluateBudgets(flattenMetrics(timings, counts), BUDGETS[SCENARIO] ?? {}),
			regressions: [],
			artifacts,
		};

		const baselinePath = path.join(STRESS_CONFIG.baselineDir, baselineFileName(SCENARIO, PROFILE.name));
		const baseline = readBaseline(baselinePath);
		if (baseline) {
			report.regressions = compareToBaseline(report, baseline);
		}
		report.status = report.budgetFailures.length > 0 || hasRegression(report.regressions) ? "fail" : "pass";

		const { markdownPath } = writeRunReports(artifactDir, report);
		console.log(`[stress] report: ${markdownPath}`);

		if (process.env["PERF_BLESS"] === "1") {
			writeBaseline(baselinePath, reportToBaseline(report));
			console.log(`[stress] baseline blessed: ${baselinePath}`);
		}

		// The indexed-event count is deterministic — assert it exactly.
		expect(snapshot.counters["index.eventsIndexed"]).toBe(expectedCount);
		// Internal stage timings must have been recorded by the in-app tracker.
		expect(snapshot.timings["calendar.buildEvents"]).toBeDefined();
		// Fail on a budget breach or a regression vs the committed baseline.
		expect(report.status, `see ${markdownPath}`).toBe("pass");
	});
});
