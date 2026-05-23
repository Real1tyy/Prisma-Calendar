import path from "node:path";

import {
	collectCpuProfile,
	diffCdpMetrics,
	generateVault,
	mergeTimings,
	namespaceCdpMetrics,
	readCdpPerformanceMetrics,
	readPerfBridge,
	summarizeSampleGroups,
	writeCpuProfile,
} from "@real1ty-obsidian-plugins/testing/stress";

import { expect, test } from "../../e2e/fixtures/electron";
import { indexerEventCount, waitForIndexerToReach } from "../../e2e/fixtures/stress-helpers";
import { createStressRun, loadPrismaSourceMap, writeStressReport } from "../report";
import { runWriteStorm } from "../scenarios/edit-storm";
import { STORM_CONFIG, STRESS_CONFIG } from "../stress.config";
import { buildPrismaEvent } from "../vaults/event-builder";
import { PROFILES, type ProfileName } from "../vaults/profiles";

const SCENARIO = "event-edit-storm";
const PROFILE = PROFILES[(process.env["STRESS_PROFILE"] as ProfileName) ?? "small"] ?? PROFILES.small;
const BUILD_METRIC = "calendar.buildEvents";

test.describe("stress: event edit storm", () => {
	test(`${SCENARIO} @ ${PROFILE.name}`, async ({ calendar }) => {
		const { page, vaultDir } = calendar;

		// Phase 1 — establish a populated, settled baseline (plain events).
		const baselineCount = await indexerEventCount(page);
		const baseTarget = baselineCount + PROFILE.events;
		generateVault({
			dir: path.join(vaultDir, PROFILE.directory),
			profile: PROFILE,
			seed: STRESS_CONFIG.seed,
			buildEvent: buildPrismaEvent,
		});
		await waitForIndexerToReach(page, baseTarget);

		const cdp = await page.context().newCDPSession(page);
		const { runId, artifactDir } = createStressRun(SCENARIO, PROFILE.name);
		const cpuProfilePath = path.join(artifactDir, "cpu.cpuprofile");

		const before = await readPerfBridge(page);
		const cdpBefore = await readCdpPerformanceMetrics(cdp);
		const buildsBefore = before.timings[BUILD_METRIC]?.count ?? 0;

		// Phase 2 — storm: drop a burst of files at once, profile the indexer +
		// render churn as it converges. The coalescing ratio (files ÷ re-renders)
		// is the headline: ideally many file events fold into few calendar builds.
		const burst = STORM_CONFIG.burstByProfile[PROFILE.name] ?? STORM_CONFIG.burstByProfile["small"] ?? 200;
		const stormTarget = baseTarget + burst;

		const startedAt = new Date().toISOString();
		const stormStart = performance.now();
		const { profile: cpuProfile } = await collectCpuProfile(cdp, () =>
			runWriteStorm(page, vaultDir, { burst, targetIndex: stormTarget })
		);
		const convergeMs = performance.now() - stormStart;
		const finishedAt = new Date().toISOString();
		await writeCpuProfile(cpuProfilePath, cpuProfile);

		const after = await readPerfBridge(page);
		const cdpAfter = await readCdpPerformanceMetrics(cdp);
		const pluginVersion = after.metadata?.["pluginVersion"];
		const buildsDuringStorm = (after.timings[BUILD_METRIC]?.count ?? 0) - buildsBefore;

		const timings = mergeTimings(summarizeSampleGroups({ "editStorm.converge": [convergeMs] }), after.timings);
		const counts: Record<string, number> = {
			...after.counters,
			"editStorm.burstFiles": burst,
			"editStorm.buildsTriggered": buildsDuringStorm,
			// ×1000 so the integer-keyed counts table keeps precision (files per build).
			"editStorm.filesPerBuildX1000": buildsDuringStorm > 0 ? Math.round((burst / buildsDuringStorm) * 1000) : 0,
			...namespaceCdpMetrics(cdpAfter, "cdp"),
			...namespaceCdpMetrics(diffCdpMetrics(cdpBefore, cdpAfter), "cdp.delta"),
		};

		const { markdownPath, htmlPath, report } = writeStressReport({
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
			extraArtifacts: [{ kind: "cpu-profile", path: cpuProfilePath, description: "V8 CPU profile (write storm)" }],
		});
		console.log(`[stress] report: ${markdownPath}`);
		console.log(`[stress] html:   ${htmlPath}`);

		// The burst must have driven at least one build, and far fewer builds than
		// files — proof the indexer coalesces rather than re-rendering per file.
		expect(buildsDuringStorm).toBeGreaterThan(0);
		expect(buildsDuringStorm).toBeLessThan(burst);
		expect(report.status, `see ${markdownPath}`).toBe("pass");
	});
});
