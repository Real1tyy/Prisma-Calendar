import type { Page } from "@playwright/test";

import { seedBulkEvents, waitForIndexerToReach } from "../../e2e/fixtures/stress-helpers";

// A write storm: drop a burst of event files onto disk all at once, then wait for
// the indexer + calendar to converge. This stresses the batch-ingest + render-
// coalescing path — the real concern isn't raw throughput but whether N near-
// simultaneous file events collapse into a few re-renders (good) or N (a storm).
// The caller wraps this in a CPU profile and reads the `calendar.buildEvents`
// count delta to measure the coalescing ratio.

export interface WriteStormOptions {
	/** How many event files to drop in the burst. */
	burst: number;
	/** Indexer event count to converge on (baseline + burst). */
	targetIndex: number;
	/** Title prefix for the burst files (default "Storm"). */
	prefix?: string;
}

/** Drop `burst` event files at once and wait for the indexer to reach `targetIndex`. */
export async function runWriteStorm(page: Page, vaultDir: string, options: WriteStormOptions): Promise<void> {
	seedBulkEvents(vaultDir, options.burst, { prefix: options.prefix ?? "Storm" });
	await waitForIndexerToReach(page, options.targetIndex);
}
