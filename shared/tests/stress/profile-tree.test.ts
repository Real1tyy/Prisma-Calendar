import { describe, expect, it } from "vitest";

import type { CpuProfile, FrameResolver } from "../../src/testing/stress/profile-digest";
import { buildProfileTree, heaviestStack, pruneProfileTree } from "../../src/testing/stress/profile-tree";

// root(1) → A(2) → B(3); root(1) → C(4). Self (µs): A=200, B=300, C=100, root=0.
// Totals roll up: B=300, A=500, C=100, root=600.
function makeProfile(): CpuProfile {
	return {
		startTime: 0,
		endTime: 600,
		nodes: [
			{ id: 1, callFrame: { functionName: "(root)", url: "", lineNumber: -1 }, children: [2, 4] },
			{ id: 2, callFrame: { functionName: "A", url: "plugin:x", lineNumber: 9 }, children: [3] },
			{ id: 3, callFrame: { functionName: "B", url: "plugin:x", lineNumber: 19 }, children: [] },
			{ id: 4, callFrame: { functionName: "C", url: "plugin:x", lineNumber: 29 }, children: [] },
		],
		samples: [2, 2, 3, 3, 3, 4],
		timeDeltas: [100, 100, 100, 100, 100, 100],
	};
}

describe("buildProfileTree", () => {
	it("rolls up self and total time through the call tree", () => {
		const root = buildProfileTree(makeProfile());
		expect(root.totalMs).toBe(0.6);
		expect(root.selfMs).toBe(0);

		const a = root.children.find((c) => c.name === "A");
		expect(a?.selfMs).toBe(0.2);
		expect(a?.totalMs).toBe(0.5); // 0.2 self + 0.3 child B
		expect(a?.children[0]?.name).toBe("B");
		expect(a?.children[0]?.totalMs).toBe(0.3);

		expect(root.children.find((c) => c.name === "C")?.totalMs).toBe(0.1);
	});

	it("labels frames through the sourcemap resolver", () => {
		const resolveFrame: FrameResolver = (frame) =>
			frame.lineNumber === 9 ? { functionName: "expandRange", source: "src/core/recurrence.ts", line: 42 } : null;
		const root = buildProfileTree(makeProfile(), { resolveFrame });
		const mapped = root.children.find((c) => c.name === "expandRange");
		expect(mapped?.location).toBe("recurrence.ts:42");
	});
});

describe("heaviestStack", () => {
	it("descends into the heaviest child at each level", () => {
		const names = heaviestStack(buildProfileTree(makeProfile())).map((n) => n.name);
		expect(names).toEqual(["(root)", "A", "B"]);
	});
});

describe("pruneProfileTree", () => {
	it("drops subtrees thinner than the fraction of root total", () => {
		// threshold = 0.6 * 0.5 = 0.3 ms → C (0.1) dropped, A (0.5) kept, B (0.3) kept.
		const pruned = pruneProfileTree(buildProfileTree(makeProfile()), 0.5);
		expect(pruned.children.map((c) => c.name)).toEqual(["A"]);
		expect(pruned.children[0]?.children.map((c) => c.name)).toEqual(["B"]);
	});

	it("keeps the whole tree at the default fraction for this fixture", () => {
		const pruned = pruneProfileTree(buildProfileTree(makeProfile()));
		expect(pruned.children.map((c) => c.name).sort()).toEqual(["A", "C"]);
	});
});
