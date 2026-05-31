import type { PerfSnapshot, PerfTracker, PerfTrackerOptions } from "./types";

// Generic in-app perf bridge: a plugin installs it on `globalThis` so the stress
// harness can drain the tracker from the renderer. Plugin-agnostic — a plugin
// supplies its own live counters + identity metadata; nothing here knows about
// any specific plugin.

/** Global key the bridge installs under; the stress harness reads the same key. */
export const PERF_BRIDGE_GLOBAL_KEY = "__OBSIDIAN_PERF_BRIDGE__";

export interface PerfBridge {
	snapshot(): PerfSnapshot;
	reset(): void;
}

export interface InstallPerfBridgeOptions {
	tracker: PerfTracker;
	/** Tracker options forwarded to `enable()` (sample cap, user-timing marks). */
	trackerOptions?: PerfTrackerOptions;
	/** Live counters merged into each snapshot (events indexed, active views, …). */
	resourceCounters?: () => Record<string, number>;
	/** Identity merged into each snapshot's metadata (pluginId, version, mode, …). */
	metadata?: () => Record<string, string | number | boolean>;
	/** Override the install key (defaults to {@link PERF_BRIDGE_GLOBAL_KEY}). */
	key?: string;
}

/**
 * Enable the tracker and expose a bridge on `globalThis[key]`. Returns a
 * disposer that disables the tracker and removes the global — register it with
 * the plugin so production teardown is clean.
 */
export function installPerfBridge(options: InstallPerfBridgeOptions): () => void {
	const { tracker, trackerOptions, resourceCounters, metadata } = options;
	const key = options.key ?? PERF_BRIDGE_GLOBAL_KEY;

	tracker.enable(trackerOptions);

	const bridge: PerfBridge = {
		snapshot(): PerfSnapshot {
			const base = tracker.snapshot();
			const counters = resourceCounters ? { ...base.counters, ...resourceCounters() } : base.counters;
			if (!metadata) return { ...base, counters };
			return { ...base, counters, metadata: { ...base.metadata, ...metadata() } };
		},
		reset(): void {
			tracker.reset();
		},
	};

	(window as unknown as Record<string, unknown>)[key] = bridge;
	return () => {
		tracker.disable();
		delete (window as unknown as Record<string, unknown>)[key];
	};
}
