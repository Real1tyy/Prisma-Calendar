import { resolveCallFrame, type CpuProfile, type FrameResolver } from "./profile-digest";

// Builds the aggregated call tree from a V8 CPU profile — the data behind the
// flame chart. The profile's `nodes`/`children` already form the aggregated call
// tree (each node is a unique call path); we attach self time (from samples/
// timeDeltas) and roll up totals, resolving frame names through the optional
// sourcemap resolver so the chart reads source names, not minified ones.

const US_PER_MS = 1000;

/** One frame in the call tree. `totalMs` (self + descendants) is the flame width. */
export interface ProfileTreeNode {
	name: string;
	location: string;
	selfMs: number;
	totalMs: number;
	children: ProfileTreeNode[];
}

export interface ProfileTreeOptions {
	/** Maps minified frames back to source before labelling (same resolver the digest uses). */
	resolveFrame?: FrameResolver;
}

function selfTimeByNode(profile: CpuProfile): Map<number, number> {
	const selfUs = new Map<number, number>();
	const sampleCount = Math.min(profile.samples.length, profile.timeDeltas.length);
	for (let i = 0; i < sampleCount; i++) {
		const id = profile.samples[i];
		const delta = profile.timeDeltas[i];
		if (id === undefined || delta === undefined) continue;
		selfUs.set(id, (selfUs.get(id) ?? 0) + delta);
	}
	return selfUs;
}

/** The node no other node lists as a child — V8's synthetic `(root)`. */
function findRootId(profile: CpuProfile): number | undefined {
	const childIds = new Set<number>();
	for (const node of profile.nodes) {
		for (const child of node.children ?? []) childIds.add(child);
	}
	return profile.nodes.find((node) => !childIds.has(node.id))?.id;
}

/**
 * Build the call tree rooted at V8's `(root)`. Each node carries self time and a
 * rolled-up total. The `onStack` set guards the (theoretically impossible) cyclic
 * profile so a malformed input can't infinite-loop.
 */
export function buildProfileTree(profile: CpuProfile, options: ProfileTreeOptions = {}): ProfileTreeNode {
	const nodeById = new Map(profile.nodes.map((node) => [node.id, node]));
	const selfUs = selfTimeByNode(profile);
	const onStack = new Set<number>();

	const build = (id: number): ProfileTreeNode => {
		const node = nodeById.get(id);
		const callFrame = node?.callFrame ?? { functionName: "(unknown)", url: "", lineNumber: -1 };
		const { name, location } = resolveCallFrame(callFrame, options.resolveFrame);
		const selfMs = (selfUs.get(id) ?? 0) / US_PER_MS;

		onStack.add(id);
		const children = (node?.children ?? [])
			.filter((childId) => !onStack.has(childId) && nodeById.has(childId))
			.map(build);
		onStack.delete(id);

		const totalMs = children.reduce((sum, child) => sum + child.totalMs, selfMs);
		return { name, location, selfMs, totalMs, children };
	};

	const rootId = findRootId(profile) ?? profile.nodes[0]?.id;
	if (rootId === undefined) {
		return { name: "(root)", location: "(root)", selfMs: 0, totalMs: 0, children: [] };
	}
	return build(rootId);
}

/**
 * Drop subtrees thinner than `minFraction` of the root's total time, keeping the
 * inlined flame-chart JSON small (a 12k-sample profile is thousands of nodes; the
 * sub-pixel ones add bytes without being readable). Returns a fresh tree.
 */
export function pruneProfileTree(root: ProfileTreeNode, minFraction = 0.005): ProfileTreeNode {
	const threshold = root.totalMs * minFraction;
	const prune = (node: ProfileTreeNode): ProfileTreeNode => ({
		...node,
		children: node.children.filter((child) => child.totalMs >= threshold).map(prune),
	});
	return prune(root);
}

/**
 * The dominant call chain: from the root, repeatedly descend into the heaviest
 * child (by total time) until a leaf. The textual "hot path" — the single stack
 * the profiler spent the most time under, for a compact report line.
 */
export function heaviestStack(root: ProfileTreeNode): ProfileTreeNode[] {
	const stack: ProfileTreeNode[] = [];
	let node: ProfileTreeNode | undefined = root;
	while (node) {
		stack.push(node);
		node = node.children.reduce<ProfileTreeNode | undefined>(
			(heaviest, child) => (heaviest === undefined || child.totalMs > heaviest.totalMs ? child : heaviest),
			undefined
		);
	}
	return stack;
}
