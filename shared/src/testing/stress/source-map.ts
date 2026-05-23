import { readFileSync } from "node:fs";
import { SourceMap } from "node:module";

import type { FrameResolver, RawFrame, ResolvedFrame } from "./profile-digest";

// Builds a FrameResolver from a bundle's external `.map`, so the CPU-profile
// digest can rank `getNextOccurrence  recurring-event-manager.ts:611` instead of
// the minified `RP  main.js:3828`. Uses Node's built-in `node:module` SourceMap
// (no extra dependency); `findEntry` takes 0-based line/column — exactly what V8
// emits in a CPU profile call frame — and returns the original position.

/** The slice of `node:module`'s SourceMap that the resolver depends on. */
export interface SourceMapLookup {
	findEntry(
		lineOffset: number,
		columnOffset: number
	): {
		originalSource?: string;
		originalLine?: number;
		originalColumn?: number;
		name?: string;
	};
}

export interface FrameResolverOptions {
	/**
	 * True when a frame's `url` belongs to the bundle this map describes. Frames
	 * from other scripts (Obsidian's app.js, electron, node internals) MUST be
	 * rejected — feeding their coordinates through the wrong map yields plausible
	 * but bogus positions.
	 */
	matchesBundle: (url: string) => boolean;
}

/**
 * Wrap a parsed source map as a frame resolver. Separate from file I/O so it can
 * be unit-tested with a fake lookup (no real `.map` / VLQ decoding needed).
 */
export function createFrameResolver(sourceMap: SourceMapLookup, options: FrameResolverOptions): FrameResolver {
	return (frame: RawFrame): ResolvedFrame | null => {
		if (frame.lineNumber < 0 || !options.matchesBundle(frame.url)) return null;
		const entry = sourceMap.findEntry(frame.lineNumber, frame.columnNumber ?? 0);
		if (entry.originalSource === undefined || entry.originalLine === undefined) return null;
		return {
			...(entry.name ? { functionName: entry.name } : {}),
			source: entry.originalSource,
			line: entry.originalLine + 1,
			...(entry.originalColumn !== undefined ? { column: entry.originalColumn } : {}),
		};
	};
}

export interface LoadBundleSourceMapOptions extends FrameResolverOptions {
	/** Path to the bundle's external source map (e.g. `<plugin>/main.js.map`). */
	mapPath: string;
}

/**
 * Load a bundle's `.map` and return a frame resolver, or null if the map is
 * missing or unparseable — callers fall back to the unmapped (minified) digest,
 * so a missing map degrades gracefully instead of failing the run.
 */
export function loadBundleSourceMap(options: LoadBundleSourceMapOptions): FrameResolver | null {
	let sourceMap: SourceMapLookup;
	try {
		sourceMap = new SourceMap(JSON.parse(readFileSync(options.mapPath, "utf8")));
	} catch {
		return null;
	}
	return createFrameResolver(sourceMap, { matchesBundle: options.matchesBundle });
}
