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
import { STRESS_CONFIG } from "../stress.config";
import { buildPrismaEvent } from "../vaults/event-builder";
import { PROFILES, type ProfileName } from "../vaults/profiles";

const SCENARIO = "startup";
const PROFILE = PROFILES[(process.env["STRESS_PROFILE"] as ProfileName) ?? "small"] ?? PROFILES.small;

test.describe("stress: startup (cold ingest)", () => {
	test(`${SCENARIO} @ ${PROFILE.name}`, async ({ calendar }) => {
		const { page, vaultDir } = calendar;

		const baselineCount = await indexerEventCount(page);
		const expectedCount = baselineCount + PROFILE.events;

		const cdp = await page.context().newCDPSession(page);
		const { runId, artifactDir } = createStressRun(SCENARIO, PROFILE.name);
		const cpuProfilePath = path.join(artifactDir, "cpu.cpuprofile");
		const cdpBefore = await readCdpPerformanceMetrics(cdp);

		// Cold ingest: drop the whole vault on disk and profile the indexer + first
		// paint as it ingests from empty → target. This is the plugin's load-time
		// hot path — frontmatter parse → event store → calendar build — captured as
		// one flame chart. Plain events only (recurrence's materialization cost is
		// covered by the navigation scenario, and its on-disk overshoot would fight
		// the exact ingest gate here).
		const startedAt = new Date().toISOString();
		const ingestStart = performance.now();
		const { profile: cpuProfile } = await collectCpuProfile(cdp, async () => {
			generateVault({
				dir: path.join(vaultDir, PROFILE.directory),
				profile: PROFILE,
				seed: STRESS_CONFIG.seed,
				buildEvent: buildPrismaEvent,
			});
			// Large ingests far exceed the default 60s expect-poll — give the heavy
			// tier room (the test timeout is raised via STRESS_TIMEOUT_MS for large).
			await waitForIndexerToReach(page, expectedCount, PROFILE.name === "large" ? 900_000 : undefined);
		});
		const ingestMs = performance.now() - ingestStart;
		const finishedAt = new Date().toISOString();
		await writeCpuProfile(cpuProfilePath, cpuProfile);

		const snapshot = await readPerfBridge(page);
		const cdpAfter = await readCdpPerformanceMetrics(cdp);
		const pluginVersion = snapshot.metadata?.["pluginVersion"];

		const timings = mergeTimings(summarizeSampleGroups({ "startup.coldIngest": [ingestMs] }), snapshot.timings);
		const counts: Record<string, number> = {
			...snapshot.counters,
			"startup.eventsIngested": expectedCount - baselineCount,
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
			extraArtifacts: [{ kind: "cpu-profile", path: cpuProfilePath, description: "V8 CPU profile (cold ingest)" }],
		});
		console.log(`[stress] report: ${markdownPath}`);
		console.log(`[stress] html:   ${htmlPath}`);

		// The cold ingest must have driven a calendar build (proof events ingested + painted).
		expect(snapshot.timings["calendar.buildEvents"]).toBeDefined();
		expect(report.status, `see ${markdownPath}`).toBe("pass");
	});
});
