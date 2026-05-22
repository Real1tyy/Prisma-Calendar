import { describe, expect, it } from "vitest";

import { digestHeapSnapshot, type HeapSnapshot } from "../../src/testing/stress/heap-digest";

// Two object types (object, native), two of which are detached DOM nodes flagged
// via the modern `detachedness` field (2 = detached). Field positions are
// deliberately ordered as V8 emits them so the by-name index resolution is exercised.
function makeSnapshot(): HeapSnapshot {
	return {
		snapshot: {
			meta: {
				node_fields: ["type", "name", "id", "self_size", "edge_count", "detachedness"],
				node_types: [["object", "native", "string"], "string", "number", "number", "number", "number"],
			},
			node_count: 4,
			edge_count: 3,
		},
		strings: ["", "Window", "Detached HTMLDivElement", "Foo"],
		nodes: [
			0,
			1,
			1,
			100,
			0,
			1, // object Window, attached
			1,
			2,
			2,
			40,
			0,
			2, // native Detached…, detached
			0,
			3,
			3,
			60,
			0,
			0, // object Foo
			1,
			2,
			4,
			40,
			0,
			2, // native Detached…, detached
		],
	};
}

// Older snapshots omit `detachedness`; detached DOM is then detected by the
// "Detached " name prefix V8 / DevTools assigns.
function makeSnapshotWithoutDetachedness(): HeapSnapshot {
	return {
		snapshot: {
			meta: {
				node_fields: ["type", "name", "id", "self_size", "edge_count"],
				node_types: [["native", "object"], "string", "number", "number", "number"],
			},
			node_count: 2,
			edge_count: 0,
		},
		strings: ["", "Detached HTMLDivElement", "Window"],
		nodes: [
			0,
			1,
			1,
			30,
			0, // native Detached…
			1,
			2,
			2,
			50,
			0, // object Window
		],
	};
}

describe("digestHeapSnapshot", () => {
	it("counts nodes, edges and summed retained size", () => {
		const digest = digestHeapSnapshot(makeSnapshot());
		expect(digest.nodeCount).toBe(4);
		expect(digest.edgeCount).toBe(3);
		expect(digest.totalSizeBytes).toBe(240); // 100 + 40 + 60 + 40
	});

	it("counts detached DOM nodes via the detachedness field", () => {
		expect(digestHeapSnapshot(makeSnapshot()).detachedNodeCount).toBe(2);
	});

	it("falls back to the 'Detached ' name prefix when detachedness is absent", () => {
		expect(digestHeapSnapshot(makeSnapshotWithoutDetachedness()).detachedNodeCount).toBe(1);
	});

	it("ranks object types by summed self size", () => {
		const { topTypes } = digestHeapSnapshot(makeSnapshot());
		expect(topTypes).toEqual([
			{ type: "object", count: 2, selfSizeBytes: 160 },
			{ type: "native", count: 2, selfSizeBytes: 80 },
		]);
	});

	it("truncates to topTypes", () => {
		const { topTypes } = digestHeapSnapshot(makeSnapshot(), { topTypes: 1 });
		expect(topTypes).toEqual([{ type: "object", count: 2, selfSizeBytes: 160 }]);
	});

	it("returns an empty digest for a snapshot with no nodes", () => {
		const empty: HeapSnapshot = {
			snapshot: {
				meta: { node_fields: ["type", "name", "id", "self_size", "edge_count"], node_types: [[], "string"] },
				node_count: 0,
				edge_count: 0,
			},
			strings: [],
			nodes: [],
		};
		const digest = digestHeapSnapshot(empty);
		expect(digest.nodeCount).toBe(0);
		expect(digest.totalSizeBytes).toBe(0);
		expect(digest.detachedNodeCount).toBe(0);
		expect(digest.topTypes).toEqual([]);
	});
});
