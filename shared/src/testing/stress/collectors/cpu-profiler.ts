import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CDPSession } from "@playwright/test";

import type { CpuProfile } from "../profile-digest";

// CDP CPU profiler — the "explain" half of the two-pass measurement. Run it in a
// SEPARATE pass from the clean gating pass: the sampler adds overhead that would
// contaminate the budgeted timings, so it must never wrap the action whose
// numbers feed budgets/baselines. Its output feeds the self-time digest only.

const DEFAULT_SAMPLING_INTERVAL_US = 1000;

export interface CpuProfilerOptions {
	/** Sampler interval in microseconds — 1000 (1ms) is low-overhead/coarse; drop to 100 for finer hot-function resolution. */
	samplingIntervalUs?: number;
}

/** Wrap an action in a CDP CPU profile and return both its result and the raw profile. */
export async function collectCpuProfile<T>(
	session: CDPSession,
	fn: () => Promise<T>,
	options: CpuProfilerOptions = {}
): Promise<{ result: T; profile: CpuProfile }> {
	await session.send("Profiler.enable");
	await session.send("Profiler.setSamplingInterval", {
		interval: options.samplingIntervalUs ?? DEFAULT_SAMPLING_INTERVAL_US,
	});
	await session.send("Profiler.start");
	try {
		const result = await fn();
		const { profile } = await session.send("Profiler.stop");
		return { result, profile: profile as CpuProfile };
	} catch (error) {
		await session.send("Profiler.stop").catch(() => undefined);
		throw error;
	}
}

/** Persist a raw V8 CPU profile as a `.cpuprofile` (opens in DevTools / Speedscope). */
export async function writeCpuProfile(filePath: string, profile: CpuProfile): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(profile), "utf8");
}
