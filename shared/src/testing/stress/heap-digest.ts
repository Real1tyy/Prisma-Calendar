import type { HeapDigest, HeapDigestEntry, RetainerEntry } from "./types";

// Parses a V8 `.heapsnapshot` (the file `HeapProfiler.takeHeapSnapshot` streams)
// into a structured, agent-readable summary — the memory analogue of the CPU
// profile digest. The snapshot stores nodes as a flat int array; each node's
// fields are laid out per `meta.node_fields`, and the `type` field indexes into
// `meta.node_types[typeFieldIndex]`. Field positions are resolved by name (not
// hardcoded) so the parser survives V8 layout changes. Pure (no @playwright/test
// import) so it stays unit-testable in a plain node environment.

/** The `meta` block of a heap snapshot — describes the flat `nodes`/`edges` layout. */
export interface HeapSnapshotMeta {
	node_fields: string[];
	/** Per field: an array of enum names for the `type` field, a bare type name otherwise. */
	node_types: Array<string[] | string>;
	edge_fields?: string[];
	edge_types?: Array<string[] | string>;
}

/** Minimal mirror of the `.heapsnapshot` JSON — only what the digest reads. */
export interface HeapSnapshot {
	snapshot: { meta: HeapSnapshotMeta; node_count: number; edge_count: number };
	nodes: number[];
	/** Flat edge array, grouped by source node in node order. Absent in trimmed fixtures. */
	edges?: number[];
	strings: string[];
}

export interface HeapDigestOptions {
	/** How many object types to keep in the ranked list (default 10). */
	topTypes?: number;
	/** Also trace what retains the detached nodes (requires `edges`; default false — it's an extra full edge pass). */
	retainers?: boolean;
	/** How many retainer keys to keep (default 10). */
	topRetainers?: number;
}

const DEFAULT_TOP_TYPES = 10;
const DEFAULT_TOP_RETAINERS = 10;
const DETACHED_NAME_PREFIX = "Detached ";
// `detachedness` field values: 0 unknown, 1 attached, 2 detached.
const DETACHEDNESS_DETACHED = 2;
// Element/hidden edges are array indices — bucket them so the index noise collapses.
const INDEXED_EDGE_TYPES = new Set(["element", "hidden"]);
const INDEXED_EDGE_NAME = "[]";

interface NodeLayout {
	stride: number;
	typeIdx: number;
	nameIdx: number;
	sizeIdx: number;
	detachIdx: number;
	edgeCountIdx: number;
	typeNames: string[];
}

function resolveNodeLayout(meta: HeapSnapshotMeta): NodeLayout {
	const typeIdx = meta.node_fields.indexOf("type");
	const typeNamesField = typeIdx >= 0 ? meta.node_types[typeIdx] : undefined;
	return {
		stride: meta.node_fields.length,
		typeIdx,
		nameIdx: meta.node_fields.indexOf("name"),
		sizeIdx: meta.node_fields.indexOf("self_size"),
		detachIdx: meta.node_fields.indexOf("detachedness"),
		edgeCountIdx: meta.node_fields.indexOf("edge_count"),
		typeNames: Array.isArray(typeNamesField) ? typeNamesField : [],
	};
}

function isNodeDetached(nodes: number[], strings: string[], base: number, layout: NodeLayout): boolean {
	if (layout.detachIdx >= 0) return nodes[base + layout.detachIdx] === DETACHEDNESS_DETACHED;
	if (layout.nameIdx < 0) return false;
	return (strings[nodes[base + layout.nameIdx] ?? -1] ?? "").startsWith(DETACHED_NAME_PREFIX);
}

/**
 * Walk the edge array once and aggregate, for every detached node, the external
 * holder that pins it: keyed by `holderType.edgeName`. Edges are grouped by source
 * node in node order, so a running cursor maps each edge back to its source.
 * Self-edges inside the detached subgraph are skipped — only the boundary that
 * keeps the leak reachable is counted. This is the "what's retaining it?" answer.
 */
function computeTopRetainers(
	snapshot: HeapSnapshot,
	isDetached: Uint8Array,
	layout: NodeLayout,
	topN: number
): RetainerEntry[] {
	const { edges, nodes, strings } = snapshot;
	const edgeFields = snapshot.snapshot.meta.edge_fields;
	if (!edges || edges.length === 0 || !edgeFields || edgeFields.length === 0) return [];

	const edgeStride = edgeFields.length;
	const edgeTypeIdx = edgeFields.indexOf("type");
	const edgeNameIdx = edgeFields.indexOf("name_or_index");
	const edgeToIdx = edgeFields.indexOf("to_node");
	if (edgeToIdx < 0) return [];
	const edgeTypesField = edgeTypeIdx >= 0 ? snapshot.snapshot.meta.edge_types?.[edgeTypeIdx] : undefined;
	const edgeTypeNames = Array.isArray(edgeTypesField) ? edgeTypesField : [];

	const counts = new Map<string, number>();
	const nodeCount = isDetached.length;
	let edgeCursor = 0;
	for (let i = 0; i < nodeCount; i++) {
		const nodeBase = i * layout.stride;
		const edgeCount = layout.edgeCountIdx >= 0 ? (nodes[nodeBase + layout.edgeCountIdx] ?? 0) : 0;
		const sourceDetached = isDetached[i] === 1;
		const sourceType =
			layout.typeIdx >= 0 ? (layout.typeNames[nodes[nodeBase + layout.typeIdx] ?? -1] ?? "unknown") : "unknown";
		for (let e = 0; e < edgeCount; e++) {
			const edgeBase = (edgeCursor + e) * edgeStride;
			const toOrdinal = Math.floor((edges[edgeBase + edgeToIdx] ?? -1) / layout.stride);
			if (toOrdinal < 0 || toOrdinal >= nodeCount || isDetached[toOrdinal] !== 1 || sourceDetached) continue;
			const edgeTypeName = edgeTypeIdx >= 0 ? (edgeTypeNames[edges[edgeBase + edgeTypeIdx] ?? -1] ?? "?") : "?";
			const edgeName = INDEXED_EDGE_TYPES.has(edgeTypeName)
				? INDEXED_EDGE_NAME
				: (strings[edges[edgeBase + edgeNameIdx] ?? -1] ?? "?");
			const key = `${sourceType}.${edgeName}`;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		edgeCursor += edgeCount;
	}

	return [...counts.entries()]
		.map(([retainer, count]) => ({ retainer, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, topN);
}

/**
 * Summarize a heap snapshot: node/edge totals, summed self size, the count of
 * detached DOM nodes (the classic retained-view leak signal), the heaviest object
 * types by self size, and — when `retainers` is set — what holds the detached nodes.
 */
export function digestHeapSnapshot(snapshot: HeapSnapshot, options: HeapDigestOptions = {}): HeapDigest {
	const topTypesN = options.topTypes ?? DEFAULT_TOP_TYPES;
	const wantRetainers = options.retainers ?? false;
	const { edge_count: edgeCount } = snapshot.snapshot;
	const layout = resolveNodeLayout(snapshot.snapshot.meta);
	if (layout.stride <= 0) {
		return { nodeCount: 0, edgeCount, totalSizeBytes: 0, detachedNodeCount: 0, topTypes: [], topRetainers: [] };
	}

	const { nodes, strings } = snapshot;
	const nodeCount = Math.floor(nodes.length / layout.stride);
	const isDetached = wantRetainers ? new Uint8Array(nodeCount) : undefined;
	const byType = new Map<string, { count: number; selfSizeBytes: number }>();
	let totalSizeBytes = 0;
	let detachedNodeCount = 0;

	for (let i = 0; i < nodeCount; i++) {
		const base = i * layout.stride;
		const typeName =
			layout.typeIdx >= 0 ? (layout.typeNames[nodes[base + layout.typeIdx] ?? -1] ?? "unknown") : "unknown";
		const selfSize = layout.sizeIdx >= 0 ? (nodes[base + layout.sizeIdx] ?? 0) : 0;
		totalSizeBytes += selfSize;

		const aggregate = byType.get(typeName);
		if (aggregate) {
			aggregate.count += 1;
			aggregate.selfSizeBytes += selfSize;
		} else {
			byType.set(typeName, { count: 1, selfSizeBytes: selfSize });
		}

		if (isNodeDetached(nodes, strings, base, layout)) {
			detachedNodeCount += 1;
			if (isDetached) isDetached[i] = 1;
		}
	}

	const topTypes: HeapDigestEntry[] = [...byType.entries()]
		.map(([type, aggregate]) => ({ type, count: aggregate.count, selfSizeBytes: aggregate.selfSizeBytes }))
		.sort((a, b) => b.selfSizeBytes - a.selfSizeBytes)
		.slice(0, topTypesN);

	const topRetainers = isDetached
		? computeTopRetainers(snapshot, isDetached, layout, options.topRetainers ?? DEFAULT_TOP_RETAINERS)
		: [];

	return { nodeCount, edgeCount, totalSizeBytes, detachedNodeCount, topTypes, topRetainers };
}
