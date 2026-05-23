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
import { HEAVY_VIEW_NAMES, renderHeavyViews } from "../scenarios/render-views";
import { STRESS_CONFIG } from "../stress.config";
import { buildPrismaEvent } from "../vaults/event-builder";
import { PROFILES, type ProfileName } from "../vaults/profiles";

const SCENARIO = "view-render";
const PROFILE = PROFILES[(process.env["STRESS_PROFILE"] as ProfileName) ?? "small"] ?? PROFILES.small;

test.describe("stress: heavy view render", () => {
	test(`${SCENARIO} @ ${PROFILE.name}`, async ({ calendar }) => {
		const { page, vaultDir } = calendar;

		const baselineCount = await indexerEventCount(page);
		const expectedCount = baselineCount + PROFILE.events;
		generateVault({
			dir: path.join(vaultDir, PROFILE.directory),
			profile: PROFILE,
			seed: STRESS_CONFIG.seed,
			buildEvent: buildPrismaEvent,
		});
		await waitForIndexerToReach(page, expectedCount);

		// Heatmap / gantt / dashboard are Pro-gated — without this they render the
		// upgrade banner instead of the view, and the container never appears.
		await calendar.unlockPro();

		const cdp = await page.context().newCDPSession(page);
		const { runId, artifactDir } = createStressRun(SCENARIO, PROFILE.name);
		const cpuProfilePath = path.join(artifactDir, "cpu.cpuprofile");

		// Warmup cycle (lazy view-module init, first-mount caches) discarded.
		await renderHeavyViews(page, () => {});

		const samplesByView: Record<string, number[]> = Object.fromEntries(HEAVY_VIEW_NAMES.map((name) => [name, []]));
		const cdpBefore = await readCdpPerformanceMetrics(cdp);
		const startedAt = new Date().toISOString();
		for (let i = 0; i < STRESS_CONFIG.repeats; i++) {
			await renderHeavyViews(page, (name, ms) => samplesByView[name]?.push(ms));
		}
		const finishedAt = new Date().toISOString();

		// Explain pass: one more cycle under a CPU profile, separate from the gated
		// samples above so the sampler's overhead never skews the recorded timings.
		const { profile: cpuProfile } = await collectCpuProfile(cdp, () => renderHeavyViews(page, () => {}));
		await writeCpuProfile(cpuProfilePath, cpuProfile);

		const snapshot = await readPerfBridge(page);
		const cdpAfter = await readCdpPerformanceMetrics(cdp);
		const pluginVersion = snapshot.metadata?.["pluginVersion"];

		const viewGroups = Object.fromEntries(
			Object.entries(samplesByView).map(([name, samples]) => [`view.${name}`, samples])
		);
		const timings = mergeTimings(summarizeSampleGroups(viewGroups), snapshot.timings);
		const counts: Record<string, number> = {
			...snapshot.counters,
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
			extraArtifacts: [{ kind: "cpu-profile", path: cpuProfilePath, description: "V8 CPU profile (view renders)" }],
		});
		console.log(`[stress] report: ${markdownPath}`);
		console.log(`[stress] html:   ${htmlPath}`);

		// Every heavy view painted and was timed across the repeats.
		for (const name of HEAVY_VIEW_NAMES) {
			expect(timings[`view.${name}`]?.count).toBe(STRESS_CONFIG.repeats);
		}
		expect(report.status, `see ${markdownPath}`).toBe("pass");
	});
});
