import path from "node:path";

import type { Page } from "@playwright/test";
import { PERF_BRIDGE_GLOBAL_KEY } from "@real1ty-obsidian-plugins/perf";
import {
	collectCpuProfile,
	diffCdpMetrics,
	generateVault,
	mergeTimings,
	namespaceCdpMetrics,
	readCdpPerformanceMetrics,
	readPerfBridge,
	resetPerfBridge,
	summarizeSampleGroups,
	writeCpuProfile,
} from "@real1ty-obsidian-plugins/testing/stress";

import { expect, test } from "../../e2e/fixtures/electron";
import { indexerEventCount, waitForIndexerToSettle } from "../../e2e/fixtures/stress-helpers";
import { createStressRun, loadPrismaSourceMap, writeStressReport } from "../report";
import { STRESS_CONFIG } from "../stress.config";
import { buildPrismaEvent, buildPrismaRecurringEvent } from "../vaults/event-builder";
import { PROFILES, type ProfileName } from "../vaults/profiles";

const SCENARIO = "year-view";
const PROFILE = PROFILES[(process.env["STRESS_PROFILE"] as ProfileName) ?? "small"] ?? PROFILES.small;
const EXPAND_METRIC = "recurrence.expandVisibleRange";

/** Wait until the calendar has expanded recurrence for the current (year) range. */
async function waitForExpansion(page: Page): Promise<void> {
	await page.waitForFunction(
		({ key, metric }) => {
			const bridge = (globalThis as Record<string, unknown>)[key] as
				| { snapshot: () => { timings: Record<string, { count: number }> } }
				| undefined;
			return (bridge?.snapshot().timings[metric]?.count ?? 0) > 0;
		},
		{ key: PERF_BRIDGE_GLOBAL_KEY, metric: EXPAND_METRIC }
	);
}

test.describe("stress: year view", () => {
	test(`${SCENARIO} @ ${PROFILE.name}`, async ({ calendar }) => {
		const { page, vaultDir } = calendar;

		// Recurrence is the point: a year window expands every source's occurrences.
		// Settle on >= sources (materialization overshoots the exact count).
		const baselineCount = await indexerEventCount(page);
		const sourceTotal = baselineCount + PROFILE.events + PROFILE.recurring;
		generateVault({
			dir: path.join(vaultDir, PROFILE.directory),
			profile: PROFILE,
			seed: STRESS_CONFIG.seed,
			buildEvent: buildPrismaEvent,
			buildRecurringEvent: buildPrismaRecurringEvent,
		});
		await waitForIndexerToSettle(page, sourceTotal);

		const cdp = await page.context().newCDPSession(page);
		await resetPerfBridge(page);
		const cdpBefore = await readCdpPerformanceMetrics(cdp);

		// Measure the single switch-to-year render. The toolbar destabilizes under the
		// heavy year layout, so we don't drive nav clicks — switching once and reading
		// the recurrence-expansion stage timing captures the O(range × sources) cost
		// (and the CPU flame shows where it goes) without racing FullCalendar's layout.
		const startedAt = new Date().toISOString();
		const renderStart = performance.now();
		const { profile: cpuProfile } = await collectCpuProfile(cdp, async () => {
			await calendar.switchMode("year");
			await waitForExpansion(page);
		});
		const yearRenderMs = performance.now() - renderStart;
		const finishedAt = new Date().toISOString();

		const { runId, artifactDir } = createStressRun(SCENARIO, PROFILE.name);
		const cpuProfilePath = path.join(artifactDir, "cpu.cpuprofile");
		await writeCpuProfile(cpuProfilePath, cpuProfile);

		const snapshot = await readPerfBridge(page);
		const cdpAfter = await readCdpPerformanceMetrics(cdp);
		const pluginVersion = snapshot.metadata?.["pluginVersion"];

		const timings = mergeTimings(summarizeSampleGroups({ "view.yearRender": [yearRenderMs] }), snapshot.timings);
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
			extraArtifacts: [{ kind: "cpu-profile", path: cpuProfilePath, description: "V8 CPU profile (year render)" }],
		});
		console.log(`[stress] report: ${markdownPath}`);
		console.log(`[stress] html:   ${htmlPath}`);

		// The year render must have expanded recurrence over the year window.
		expect(snapshot.timings[EXPAND_METRIC]).toBeDefined();
		expect(report.status, `see ${markdownPath}`).toBe("pass");
	});
});
