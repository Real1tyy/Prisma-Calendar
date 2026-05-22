export interface RepeatOptions {
	warmup: number;
	repeats: number;
}

export type RepeatPhase = "warmup" | "measured";

/**
 * Run an action `warmup` times (results discarded) then `repeats` times
 * (results collected). Warmup absorbs JIT warm-up and cache fill so the
 * measured samples are steady-state.
 */
export async function runRepeats<T>(
	options: RepeatOptions,
	fn: (index: number, phase: RepeatPhase) => Promise<T>
): Promise<T[]> {
	for (let index = 0; index < options.warmup; index++) {
		await fn(index, "warmup");
	}
	const results: T[] = [];
	for (let index = 0; index < options.repeats; index++) {
		results.push(await fn(index, "measured"));
	}
	return results;
}
