// Deterministic PRNG so generated vaults are byte-identical across runs — the
// foundation of reproducible stress measurement. mulberry32: tiny, fast, and
// stable; never use Math.random() in the harness. Do not change the `next()`
// implementation without updating any byte-identical fixture expectations.

export interface SeededRandom {
	/** Next pseudo-random float in [0, 1). */
	next(): number;

	/** Integer in [min, max] inclusive. */
	int(min: number, max: number): number;

	/** Pick a pseudo-random element; throws on empty input. */
	pick<T>(items: readonly T[]): T;

	/** True with probability `p` in [0, 1]. Default 0.5. */
	bool(p?: number): boolean;
}

export function createSeededRandom(seed: number): SeededRandom {
	if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
		throw new Error(`createSeededRandom() seed must be a finite integer. Received: ${seed}`);
	}

	let state = seed >>> 0;

	const next = (): number => {
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

	return {
		next,

		int(min, max) {
			if (!Number.isInteger(min) || !Number.isInteger(max)) {
				throw new Error(`SeededRandom.int() bounds must be integers. Received: ${min}, ${max}`);
			}

			if (max < min) {
				throw new Error(`SeededRandom.int() max must be >= min. Received: ${min}, ${max}`);
			}

			return min + Math.floor(next() * (max - min + 1));
		},

		pick(items) {
			if (items.length === 0) {
				throw new Error("SeededRandom.pick() called on an empty array");
			}

			const index = Math.floor(next() * items.length);
			const choice = items[index];
			if (choice === undefined) {
				throw new Error("SeededRandom.pick() invariant violated: index out of range");
			}
			return choice;
		},

		bool(p = 0.5) {
			if (!Number.isFinite(p) || p < 0 || p > 1) {
				throw new Error(`SeededRandom.bool() probability must be in [0, 1]. Received: ${p}`);
			}

			return next() < p;
		},
	};
}
