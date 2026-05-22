import { readFileSync } from "node:fs";
import path from "node:path";

import {
	buildArtifactDir,
	buildRunStem,
	captureEnvironment,
	captureGitInfo,
	collectGarbage,
	digestHeapSnapshot,
	evaluateBudgets,
	flattenMetrics,
	generateVault,
	hasRegression,
	readCdpPerformanceMetrics,
	readPerfBridge,
	takeHeapSnapshot,
	writeRunReports,
	type HeapDigest,
	type StressArtifact,
	type StressRunReport,
} from "@real1ty-obsidian-plugins/testing/stress";

import { expect, test } from "../../e2e/fixtures/electron";
import { indexerEventCount, waitForIndexerToReach } from "../../e2e/fixtures/stress-helpers";
import { openCloseViewLoop } from "../scenarios/open-close-view-loop";
import { BUDGETS, MEMORY_CONFIG, STRESS_CONFIG } from "../stress.config";
import { buildPrismaEvent } from "../vaults/event-builder";
import { SMALL_PROFILE } from "../vaults/profiles";

const SCENARIO = "memory-leak";
// A leak lives in the open/close lifecycle, not the data volume — the small
// profile keeps heap snapshots cheap to capture and parse.
const PROFILE = SMALL_PROFILE;
const HEAP_USED_METRIC = "JSHeapUsedSize";

test.describe("stress: memory leak", () => {
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

		const cdp = await page.context().newCDPSession(page);
		const runId = buildRunStem({ profile: PROFILE.name, scenario: SCENARIO });
		const artifactDir = buildArtifactDir(STRESS_CONFIG.artifactRoot, runId);

		// Warmup cycles reach steady state (lazy module init, first-mount caches)
		// so the measured loop's growth reflects per-cycle retention, not one-time setup.
		await openCloseViewLoop(page, MEMORY_CONFIG.warmupCycles);

		await collectGarbage(cdp);
		const before = await readCdpPerformanceMetrics(cdp);
		await takeHeapSnapshot(cdp, path.join(artifactDir, "heap-before.heapsnapshot"));

		const startedAt = new Date().toISOString();
		await openCloseViewLoop(page, MEMORY_CONFIG.cycles);
		const finishedAt = new Date().toISOString();

		// Force GC before the "after" reading so anything still on the heap is
		// genuinely retained, not merely uncollected.
		await collectGarbage(cdp);
		const after = await readCdpPerformanceMetrics(cdp);
		const afterSnapshotPath = path.join(artifactDir, "heap-after.heapsnapshot");
		await takeHeapSnapshot(cdp, afterSnapshotPath);
		const heapDigest: HeapDigest = digestHeapSnapshot(JSON.parse(readFileSync(afterSnapshotPath, "utf8")));

		const snapshot = await readPerfBridge(page);
		const jsHeapBefore = before[HEAP_USED_METRIC] ?? 0;
		const jsHeapAfter = after[HEAP_USED_METRIC] ?? 0;
		const counts: Record<string, number> = {
			...snapshot.counters,
			"heap.jsHeapUsedBefore": jsHeapBefore,
			"heap.jsHeapUsedAfter": jsHeapAfter,
			"heap.growthBytes": jsHeapAfter - jsHeapBefore,
			"heap.detachedNodes": heapDigest.detachedNodeCount,
		};

		const artifacts: StressArtifact[] = [
			{ kind: "json", path: path.join(artifactDir, "run.json") },
			{ kind: "markdown", path: path.join(artifactDir, "report.md") },
			{ kind: "heap-snapshot", path: path.join(artifactDir, "heap-before.heapsnapshot"), description: "pre-loop heap" },
			{ kind: "heap-snapshot", path: afterSnapshotPath, description: "post-loop heap (post-GC)" },
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
				repeats: MEMORY_CONFIG.cycles,
				warmup: MEMORY_CONFIG.warmupCycles,
				collectors: ["prisma", "cdp", "heap"],
			},
			timings: {},
			counts,
			budgetFailures: evaluateBudgets(flattenMetrics({}, counts), BUDGETS[SCENARIO] ?? {}),
			regressions: [],
			artifacts,
			heapDigest,
		};
		report.status = report.budgetFailures.length > 0 || hasRegression(report.regressions) ? "fail" : "pass";

		const { markdownPath } = writeRunReports(artifactDir, report);
		console.log(`[stress] report: ${markdownPath}`);

		expect(snapshot.counters["index.eventsIndexed"]).toBe(expectedCount);
		// Every calendar leaf must be gone after the final teardown.
		expect(snapshot.counters["resources.activeViews"]).toBe(0);
		expect(report.status, `see ${markdownPath}`).toBe("pass");
	});
});
