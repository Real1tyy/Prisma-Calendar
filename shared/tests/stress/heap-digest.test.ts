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

// Two attached holders (n0, n3) each point at a detached node via a named
// property edge; n1→n2 is internal to the detached subgraph and must be ignored.
// Exercises the edge-walk retainer aggregation.
function makeSnapshotWithEdges(): HeapSnapshot {
	return {
		snapshot: {
			meta: {
				node_fields: ["type", "name", "id", "self_size", "edge_count", "detachedness"],
				node_types: [["object", "native"], "string", "number", "number", "number", "number"],
				edge_fields: ["type", "name_or_index", "to_node"],
				edge_types: [["context", "element", "property", "internal", "hidden"], "string_or_number", "node"],
			},
			node_count: 4,
			edge_count: 3,
		},
		strings: ["", "Window", "Detached HTMLDivElement", "_view", "child", "_owner"],
		nodes: [
			0,
			1,
			1,
			100,
			1,
			1, // n0 object Window, attached, 1 edge
			1,
			2,
			2,
			40,
			1,
			2, // n1 detached, 1 edge
			1,
			2,
			3,
			30,
			0,
			2, // n2 detached, leaf
			0,
			1,
			4,
			50,
			1,
			1, // n3 object Window, attached, 1 edge
		],
		// 3 property edges (type 2), grouped by source node: n0→n1 "_view", n1→n2 "child", n3→n2 "_owner".
		edges: [2, 3, 6, 2, 4, 12, 2, 5, 12],
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

	it("does not trace retainers unless asked", () => {
		expect(digestHeapSnapshot(makeSnapshotWithEdges()).topRetainers).toEqual([]);
	});

	it("aggregates the external holders that retain detached nodes", () => {
		const digest = digestHeapSnapshot(makeSnapshotWithEdges(), { retainers: true });
		expect(digest.detachedNodeCount).toBe(2);
		// n1→n2 is inside the detached subgraph and excluded; only the attached holders count.
		expect(digest.topRetainers).toEqual([
			{ retainer: "object._view", count: 1 },
			{ retainer: "object._owner", count: 1 },
		]);
	});

	it("returns no retainers when the snapshot has no edges", () => {
		expect(digestHeapSnapshot(makeSnapshot(), { retainers: true }).topRetainers).toEqual([]);
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
