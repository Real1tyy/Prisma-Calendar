import type { ProfileDigest, ProfileDigestEntry } from "./types";

// Parses a raw V8 CPU profile (the object CDP's `Profiler.stop` returns) into a
// ranked self-time digest. This is the agent-autonomy unlock: a `.cpuprofile` is
// JSON, so instead of opening a flame chart by hand we rank functions by self
// time and write the top-N into the run report. Pure (no @playwright/test import)
// so it stays unit-testable in a plain node environment.

/** Minimal mirror of `Protocol.Runtime.CallFrame` — only what the digest reads. */
export interface CpuProfileCallFrame {
	functionName: string;
	url: string;
	/** 0-based, as V8 emits it. */
	lineNumber: number;
	columnNumber?: number;
	scriptId?: string;
}

/** Minimal mirror of `Protocol.Profiler.ProfileNode`. */
export interface CpuProfileNode {
	id: number;
	callFrame: CpuProfileCallFrame;
	hitCount?: number;
	children?: number[];
}

/** Minimal mirror of `Protocol.Profiler.Profile` (timings in microseconds). */
export interface CpuProfile {
	nodes: CpuProfileNode[];
	startTime: number;
	endTime: number;
	samples: number[];
	timeDeltas: number[];
}

/** A minified call frame as V8 emits it (line/column 0-based). */
export interface RawFrame {
	url: string;
	lineNumber: number;
	columnNumber?: number;
}

/** A frame resolved back to original source through a sourcemap. */
export interface ResolvedFrame {
	/** Original function name, when the map carries one (its `names` table). */
	functionName?: string;
	/** Original source path, as it appears in the map's `sources`. */
	source: string;
	/** 1-based original line. */
	line: number;
	/** 0-based original column, when known. */
	column?: number;
}

/**
 * Maps a minified call frame back to its original source position, or null when
 * the frame isn't part of the mapped bundle (native / library / app frames).
 * Built from the bundle's `.map` by `loadBundleSourceMap` (source-map.ts) and
 * injected here, so this parser stays free of fs / sourcemap-library imports and
 * unit-testable with a fake resolver.
 */
export type FrameResolver = (frame: RawFrame) => ResolvedFrame | null;

export interface DigestOptions {
	/** How many functions to keep in the ranked list (default 15). */
	topN?: number;
	/** Keep V8 bookkeeping frames — `(idle)`, `(garbage collector)`, … (default false). */
	includeSynthetic?: boolean;
	/**
	 * When set, each minified frame is mapped back to original source before
	 * aggregation — so the ranking names `getNextOccurrence  recurring-event-manager.ts:611`
	 * instead of `RP  main.js:3828`. Frames the resolver returns null for keep
	 * their minified identity.
	 */
	resolveFrame?: FrameResolver;
}

const DEFAULT_TOP_N = 15;
const ANONYMOUS = "(anonymous)";
const US_PER_MS = 1000;

// V8 emits these synthetic frames for non-code time. They're excluded from the
// "hot functions" ranking by default but still counted toward total profiled
// time, so a function's self-% stays honest relative to the whole window.
const SYNTHETIC_FRAME_NAMES = new Set(["(root)", "(program)", "(idle)", "(garbage collector)", "(metadata)"]);

interface FrameAggregate {
	functionName: string;
	url: string;
	line: number;
	selfUs: number;
	hitCount: number;
}

function basename(url: string): string {
	const slash = url.lastIndexOf("/");
	return slash >= 0 ? url.slice(slash + 1) : url;
}

function formatLocation(functionName: string, url: string, line: number): string {
	if (!url) return functionName === ANONYMOUS ? "(native)" : functionName;
	const file = basename(url);
	return line > 0 ? `${file}:${line}` : file;
}

/**
 * Resolve a call frame to its display identity — apply the optional sourcemap
 * resolver, else fall back to the minified name/url/line. Shared by the self-time
 * digest and the call-tree builder so both label frames identically.
 */
export function resolveCallFrame(
	callFrame: CpuProfileCallFrame,
	resolveFrame?: FrameResolver
): { name: string; url: string; line: number; location: string } {
	const resolved = resolveFrame?.({
		url: callFrame.url,
		lineNumber: callFrame.lineNumber,
		...(callFrame.columnNumber !== undefined ? { columnNumber: callFrame.columnNumber } : {}),
	});
	const name = resolved?.functionName ?? (callFrame.functionName || ANONYMOUS);
	const url = resolved ? resolved.source : callFrame.url;
	const line = resolved ? resolved.line : callFrame.lineNumber >= 0 ? callFrame.lineNumber + 1 : 0;
	return { name, url, line, location: formatLocation(name, url, line) };
}

/**
 * Rank a CPU profile's functions by self time. Self time per node = the sum of
 * `timeDeltas[i]` for every sample where that node was on top of the stack;
 * nodes that share a call frame (same function reached via different paths) are
 * collapsed into a single row.
 */
export function digestCpuProfile(profile: CpuProfile, options: DigestOptions = {}): ProfileDigest {
	const topN = options.topN ?? DEFAULT_TOP_N;
	const includeSynthetic = options.includeSynthetic ?? false;
	const resolveFrame = options.resolveFrame;

	const nodeById = new Map<number, CpuProfileNode>();
	for (const node of profile.nodes) nodeById.set(node.id, node);

	const selfUsByNode = new Map<number, number>();
	const sampleCount = Math.min(profile.samples.length, profile.timeDeltas.length);
	let totalUs = 0;
	for (let i = 0; i < sampleCount; i++) {
		const nodeId = profile.samples[i];
		const delta = profile.timeDeltas[i];
		if (nodeId === undefined || delta === undefined) continue;
		selfUsByNode.set(nodeId, (selfUsByNode.get(nodeId) ?? 0) + delta);
		totalUs += delta;
	}

	const byFrame = new Map<string, FrameAggregate>();
	for (const [nodeId, selfUs] of selfUsByNode) {
		const node = nodeById.get(nodeId);
		if (!node) continue;
		const { name, url, line } = resolveCallFrame(node.callFrame, resolveFrame);
		if (!includeSynthetic && SYNTHETIC_FRAME_NAMES.has(name)) continue;
		const key = `${name} ${url} ${line}`;
		const existing = byFrame.get(key);
		if (existing) {
			existing.selfUs += selfUs;
			existing.hitCount += node.hitCount ?? 0;
		} else {
			byFrame.set(key, { functionName: name, url, line, selfUs, hitCount: node.hitCount ?? 0 });
		}
	}

	const topSelfTime: ProfileDigestEntry[] = [...byFrame.values()]
		.sort((a, b) => b.selfUs - a.selfUs)
		.slice(0, topN)
		.map((frame) => ({
			functionName: frame.functionName,
			url: frame.url,
			line: frame.line,
			location: formatLocation(frame.functionName, frame.url, frame.line),
			selfTimeMs: frame.selfUs / US_PER_MS,
			selfPct: totalUs > 0 ? (frame.selfUs / totalUs) * 100 : 0,
			hitCount: frame.hitCount,
		}));

	return {
		sampleCount,
		durationMs: (profile.endTime - profile.startTime) / US_PER_MS,
		totalSelfTimeMs: totalUs / US_PER_MS,
		topSelfTime,
	};
}
