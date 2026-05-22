import { describe, expect, it } from "vitest";

import { runRepeats, type RepeatPhase } from "../../src/testing/stress/runner/repeat";

describe("runRepeats", () => {
	it("runs warmup passes first, then collects measured results", async () => {
		const phases: RepeatPhase[] = [];
		const results = await runRepeats({ warmup: 2, repeats: 3 }, async (index, phase) => {
			phases.push(phase);
			return index;
		});
		expect(phases).toEqual(["warmup", "warmup", "measured", "measured", "measured"]);
		expect(results).toEqual([0, 1, 2]);
	});

	it("collects nothing when repeats is zero", async () => {
		const results = await runRepeats({ warmup: 1, repeats: 0 }, async (index) => index);
		expect(results).toEqual([]);
	});

	it("runs sequentially (each call awaits the previous)", async () => {
		const order: number[] = [];
		await runRepeats({ warmup: 0, repeats: 3 }, async (index) => {
			await Promise.resolve();
			order.push(index);
		});
		expect(order).toEqual([0, 1, 2]);
	});
});
