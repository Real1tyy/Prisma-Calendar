import { describe, expect, it } from "vitest";

import { digestCpuProfile, type CpuProfile } from "../../src/testing/stress/profile-digest";

const A_URL = "file:///home/x/a.ts";
const B_URL = "file:///home/x/b.ts";

// functionA is reached via two nodes (2 + 5) so the digest must collapse them.
// Synthetic frames (root/idle) and one anonymous native frame exercise the
// exclusion + labelling paths. timeDeltas are microseconds.
function makeProfile(): CpuProfile {
	return {
		startTime: 0,
		endTime: 1775,
		nodes: [
			{ id: 1, callFrame: { functionName: "(root)", url: "", lineNumber: -1 } },
			{ id: 2, callFrame: { functionName: "functionA", url: A_URL, lineNumber: 9 }, hitCount: 2 },
			{ id: 3, callFrame: { functionName: "functionB", url: B_URL, lineNumber: 19 }, hitCount: 1 },
			{ id: 4, callFrame: { functionName: "(idle)", url: "", lineNumber: -1 } },
			{ id: 5, callFrame: { functionName: "functionA", url: A_URL, lineNumber: 9 }, hitCount: 3 },
			{ id: 6, callFrame: { functionName: "", url: "", lineNumber: -1 } },
		],
		samples: [2, 2, 3, 5, 4, 1, 6],
		timeDeltas: [100, 100, 200, 300, 1000, 50, 25],
	};
}

const EMPTY_PROFILE: CpuProfile = { nodes: [], startTime: 0, endTime: 0, samples: [], timeDeltas: [] };

describe("digestCpuProfile", () => {
	it("collapses nodes that share a call frame into one self-time row", () => {
		const digest = digestCpuProfile(makeProfile());
		const a = digest.topSelfTime.find((entry) => entry.functionName === "functionA");
		expect(a?.selfTimeMs).toBe(0.5); // (200 + 300) µs
		expect(a?.hitCount).toBe(5); // 2 + 3
	});

	it("ranks functions by self time descending", () => {
		const names = digestCpuProfile(makeProfile()).topSelfTime.map((entry) => entry.functionName);
		expect(names).toEqual(["functionA", "functionB", "(anonymous)"]);
	});

	it("excludes synthetic frames (root/idle) by default", () => {
		const names = digestCpuProfile(makeProfile()).topSelfTime.map((entry) => entry.functionName);
		expect(names).not.toContain("(idle)");
		expect(names).not.toContain("(root)");
	});

	it("includes synthetic frames when asked, ranking idle by its self time", () => {
		const digest = digestCpuProfile(makeProfile(), { includeSynthetic: true });
		expect(digest.topSelfTime[0]?.functionName).toBe("(idle)"); // 1000µs dominates
	});

	it("truncates to topN", () => {
		const digest = digestCpuProfile(makeProfile(), { topN: 1 });
		expect(digest.topSelfTime).toHaveLength(1);
		expect(digest.topSelfTime[0]?.functionName).toBe("functionA");
	});

	it("formats source location 1-based as file:line", () => {
		const digest = digestCpuProfile(makeProfile());
		expect(digest.topSelfTime.find((entry) => entry.functionName === "functionA")?.location).toBe("a.ts:10");
		expect(digest.topSelfTime.find((entry) => entry.functionName === "functionB")?.location).toBe("b.ts:20");
	});

	it("labels anonymous native frames", () => {
		const anon = digestCpuProfile(makeProfile()).topSelfTime.find((entry) => entry.functionName === "(anonymous)");
		expect(anon?.location).toBe("(native)");
	});

	it("reports self-% relative to total profiled time", () => {
		const digest = digestCpuProfile(makeProfile());
		const a = digest.topSelfTime.find((entry) => entry.functionName === "functionA");
		expect(a?.selfPct).toBeCloseTo((500 / 1775) * 100, 5);
		expect(digest.totalSelfTimeMs).toBeCloseTo(1.775, 5);
		expect(digest.durationMs).toBeCloseTo(1.775, 5);
		expect(digest.sampleCount).toBe(7);
	});

	it("returns an empty digest for a profile with no samples", () => {
		const digest = digestCpuProfile(EMPTY_PROFILE);
		expect(digest.topSelfTime).toEqual([]);
		expect(digest.totalSelfTimeMs).toBe(0);
		expect(digest.sampleCount).toBe(0);
	});
});
