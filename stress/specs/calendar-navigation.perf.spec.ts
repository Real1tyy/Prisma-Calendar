import path from "node:path";

import {
	collectCpuProfile,
	diffCdpMetrics,
	generateVault,
	mergeTimings,
	namespaceCdpMetrics,
	readCdpPerformanceMetrics,
	readPerfBridge,
	resetPerfBridge,
	runRepeats,
	summarizeSampleGroups,
	writeCpuProfile,
} from "@real1ty-obsidian-plugins/testing/stress";

import { expect, test } from "../../e2e/fixtures/electron";
import { indexerEventCount, waitForIndexerToReach } from "../../e2e/fixtures/stress-helpers";
import { createStressRun, loadPrismaSourceMap, writeStressReport } from "../report";
import { navigateMonths, setMonthView } from "../scenarios/navigate-months";
import { STRESS_CONFIG } from "../stress.config";
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

		const { runId, artifactDir } = createStressRun(SCENARIO, PROFILE.name);
		const cpuProfilePath = path.join(artifactDir, "cpu.cpuprofile");

		// Pass B (explain): one more navigation under a CDP CPU profile, kept
		// separate from the gated repeats above so the sampler's overhead never
		// skews the budgeted timings. Feeds the self-time digest + flame chart only.
		const { profile: cpuProfile } = await collectCpuProfile(cdp, () =>
			navigateMonths(page, STRESS_CONFIG.navSteps, NOOP)
		);
		await writeCpuProfile(cpuProfilePath, cpuProfile);

		const pluginVersion = snapshot.metadata?.["pluginVersion"];
		const { markdownPath, report } = writeStressReport({
			runId,
			artifactDir,
			scenario: SCENARIO,
			profileName: PROFILE.name,
			startedAt,
			finishedAt,
			timings,
			counts,
			collectors: ["prisma", "cdp"],
			cpuProfile,
			resolveFrame: loadPrismaSourceMap(),
			pluginVersion: typeof pluginVersion === "string" ? pluginVersion : undefined,
			extraArtifacts: [{ kind: "cpu-profile", path: cpuProfilePath, description: "V8 CPU profile (explain pass)" }],
		});
		console.log(`[stress] report: ${markdownPath}`);

		// Internal stage timings must have been recorded by the in-app tracker, incl.
		// recurrence expansion — proof the recurring sources actually drove work.
		expect(snapshot.timings["calendar.buildEvents"]).toBeDefined();
		expect(snapshot.timings["recurrence.expandVisibleRange"]).toBeDefined();
		// Fail on a budget breach or a regression vs the committed baseline.
		expect(report.status, `see ${markdownPath}`).toBe("pass");
	});
});
