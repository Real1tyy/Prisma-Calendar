import type { HeapDigest, HeapDigestEntry } from "./types";

// Parses a V8 `.heapsnapshot` (the file `HeapProfiler.takeHeapSnapshot` streams)
// into a structured, agent-readable summary — the memory analogue of the CPU
// profile digest. The snapshot stores nodes as a flat int array; each node's
// fields are laid out per `meta.node_fields`, and the `type` field indexes into
// `meta.node_types[typeFieldIndex]`. Field positions are resolved by name (not
// hardcoded) so the parser survives V8 layout changes. Pure (no @playwright/test
// import) so it stays unit-testable in a plain node environment.

/** The `meta` block of a heap snapshot — describes the flat `nodes` layout. */
export interface HeapSnapshotMeta {
	node_fields: string[];
	/** Per field: an array of enum names for the `type` field, a bare type name otherwise. */
	node_types: Array<string[] | string>;
}

/** Minimal mirror of the `.heapsnapshot` JSON — only what the digest reads. */
export interface HeapSnapshot {
	snapshot: { meta: HeapSnapshotMeta; node_count: number; edge_count: number };
	nodes: number[];
	strings: string[];
}

export interface HeapDigestOptions {
	/** How many object types to keep in the ranked list (default 10). */
	topTypes?: number;
}

const DEFAULT_TOP_TYPES = 10;
const DETACHED_NAME_PREFIX = "Detached ";
// `detachedness` field values: 0 unknown, 1 attached, 2 detached.
const DETACHEDNESS_DETACHED = 2;

/**
 * Summarize a heap snapshot: node/edge totals, summed self size, the count of
 * detached DOM nodes (the classic retained-view leak signal), and the heaviest
 * object types by self size.
 */
export function digestHeapSnapshot(snapshot: HeapSnapshot, options: HeapDigestOptions = {}): HeapDigest {
	const topTypesN = options.topTypes ?? DEFAULT_TOP_TYPES;
	const { meta, edge_count: edgeCount } = snapshot.snapshot;
	const stride = meta.node_fields.length;
	if (stride <= 0) {
		return { nodeCount: 0, edgeCount, totalSizeBytes: 0, detachedNodeCount: 0, topTypes: [] };
	}

	const typeIdx = meta.node_fields.indexOf("type");
	const nameIdx = meta.node_fields.indexOf("name");
	const sizeIdx = meta.node_fields.indexOf("self_size");
	const detachIdx = meta.node_fields.indexOf("detachedness");
	const typeNamesField = typeIdx >= 0 ? meta.node_types[typeIdx] : undefined;
	const typeNames = Array.isArray(typeNamesField) ? typeNamesField : [];

	const { nodes, strings } = snapshot;
	const byType = new Map<string, { count: number; selfSizeBytes: number }>();
	let totalSizeBytes = 0;
	let detachedNodeCount = 0;
	let nodeCount = 0;

	for (let base = 0; base + stride <= nodes.length; base += stride) {
		nodeCount += 1;
		const typeName = typeIdx >= 0 ? (typeNames[nodes[base + typeIdx] ?? -1] ?? "unknown") : "unknown";
		const selfSize = sizeIdx >= 0 ? (nodes[base + sizeIdx] ?? 0) : 0;
		totalSizeBytes += selfSize;

		const aggregate = byType.get(typeName);
		if (aggregate) {
			aggregate.count += 1;
			aggregate.selfSizeBytes += selfSize;
		} else {
			byType.set(typeName, { count: 1, selfSizeBytes: selfSize });
		}

		const detached =
			detachIdx >= 0
				? nodes[base + detachIdx] === DETACHEDNESS_DETACHED
				: nameIdx >= 0 && (strings[nodes[base + nameIdx] ?? -1] ?? "").startsWith(DETACHED_NAME_PREFIX);
		if (detached) detachedNodeCount += 1;
	}

	const topTypes: HeapDigestEntry[] = [...byType.entries()]
		.map(([type, aggregate]) => ({ type, count: aggregate.count, selfSizeBytes: aggregate.selfSizeBytes }))
		.sort((a, b) => b.selfSizeBytes - a.selfSizeBytes)
		.slice(0, topTypesN);

	return { nodeCount, edgeCount, totalSizeBytes, detachedNodeCount, topTypes };
}
