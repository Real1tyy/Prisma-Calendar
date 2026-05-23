import path from "node:path";

import {
	baselineFileName,
	buildArtifactDir,
	buildRunStem,
	captureEnvironment,
	captureGitInfo,
	collectCpuProfile,
	compareToBaseline,
	diffCdpMetrics,
	digestCpuProfile,
	evaluateBudgets,
	flattenMetrics,
	generateVault,
	hasRegression,
	loadBundleSourceMap,
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
	writeCpuProfile,
	writeRunReports,
	type ProfileDigest,
	type StressArtifact,
	type StressRunReport,
} from "@real1ty-obsidian-plugins/testing/stress";

import { expect, test } from "../../e2e/fixtures/electron";
import { indexerEventCount, waitForIndexerToReach } from "../../e2e/fixtures/stress-helpers";
import { navigateMonths, setMonthView } from "../scenarios/navigate-months";
import { BUDGETS, STRESS_CONFIG } from "../stress.config";
import { buildPrismaEvent, buildPrismaRecurringEvent } from "../vaults/event-builder";
import { PROFILES, type ProfileName } from "../vaults/profiles";

const SCENARIO = "calendar-navigation";
// Profile is env-selectable so the same spec runs at small (default, fast),
// medium, or large. Agents stick to small/medium; large is the user's call.
const PROFILE = PROFILES[(process.env["STRESS_PROFILE"] as ProfileName) ?? "small"] ?? PROFILES.small;
const NOOP = (): void => {};

test.describe("stress: calendar navigation", () => {
	test(`${SCENARIO} @ ${PROFILE.name}`, async ({ calendar }) => {
		const { page, vaultDir } = calendar;

		// Seed a deterministic vault, then wait for the indexer to ingest it all.
		// Tolerate any pre-seeded events by anchoring on the pre-generation count.
		const baselineCount = await indexerEventCount(page);
		// SOURCE events = plain + recurring. This gate runs PRE-render: once the
		// calendar paints, recurrences expand to (and materialize) extra instances,
		// so neither the runtime store nor the on-disk file count stays at the source
		// total. `waitForIndexerToReach` settles on sources before any of that.
		const expectedCount = baselineCount + PROFILE.events + PROFILE.recurring;
		generateVault({
			dir: path.join(vaultDir, PROFILE.directory),
			profile: PROFILE,
			seed: STRESS_CONFIG.seed,
			buildEvent: buildPrismaEvent,
			buildRecurringEvent: buildPrismaRecurringEvent,
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

		// Pass B (explain): one more navigation under a CDP CPU profile, kept
		// separate from the gated repeats above so the sampler's overhead never
		// skews the budgeted timings. Feeds the self-time digest only.
		const cpuProfilePath = path.join(artifactDir, "cpu.cpuprofile");
		const { profile: cpuProfile } = await collectCpuProfile(cdp, () =>
			navigateMonths(page, STRESS_CONFIG.navSteps, NOOP)
		);
		await writeCpuProfile(cpuProfilePath, cpuProfile);
		// Map minified plugin frames back to source via the stress build's external
		// main.js.map (emitted because stress:prepare sets OBSIDIAN_SOURCEMAP=1). Frames
		// from the bundle carry a `prisma-calendar`/`main.js` url; everything else
		// (Obsidian app, electron, node) is left minified. Missing map → unmapped digest.
		const resolveFrame =
			loadBundleSourceMap({
				mapPath: path.join(process.cwd(), "main.js.map"),
				matchesBundle: (url) => url.includes("prisma-calendar") || url.endsWith("main.js"),
			}) ?? undefined;
		const profileDigest: ProfileDigest = digestCpuProfile(cpuProfile, resolveFrame ? { resolveFrame } : {});
		artifacts.push({ kind: "cpu-profile", path: cpuProfilePath, description: "V8 CPU profile (explain pass)" });

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
			profileDigest,
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

		// Internal stage timings must have been recorded by the in-app tracker, incl.
		// recurrence expansion — proof the recurring sources actually drove work.
		expect(snapshot.timings["calendar.buildEvents"]).toBeDefined();
		expect(snapshot.timings["recurrence.expandVisibleRange"]).toBeDefined();
		// Fail on a budget breach or a regression vs the committed baseline.
		expect(report.status, `see ${markdownPath}`).toBe("pass");
	});
});
