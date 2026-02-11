import type { FrontmatterDiff } from "./frontmatter-diff";
import { mergeFrontmatterDiffs } from "./frontmatter-diff";

export interface FrontmatterPropagationDebouncerOptions {
	debounceMs: number;
	/** Filters the merged diff before invoking onFlush. Called once per flush. */
	filterDiff?: (diff: FrontmatterDiff) => FrontmatterDiff;
}

interface AccumulatedEntry<T> {
	diffs: FrontmatterDiff[];
	latestContext: T;
}

/**
 * Debounces frontmatter propagation by accumulating diffs per key and invoking
 * a callback with the merged (and optionally filtered) diff when the timer fires.
 * The latest context from the most recent schedule() call is passed to onFlush.
 */
export class FrontmatterPropagationDebouncer<T = void> {
	private timers = new Map<string, ReturnType<typeof setTimeout>>();
	private accumulated = new Map<string, AccumulatedEntry<T>>();
	private options: FrontmatterPropagationDebouncerOptions;

	constructor(options: FrontmatterPropagationDebouncerOptions) {
		this.options = options;
	}

	/**
	 * Schedules a diff for the given key. When debounce fires, onFlush is called with
	 * the merged diff (and filtered if filterDiff was provided) and the latest context.
	 */
	schedule(
		key: string,
		diff: FrontmatterDiff,
		context: T,
		onFlush: (filteredDiff: FrontmatterDiff, context: T) => void
	): void {
		const existing = this.timers.get(key);
		if (existing) {
			clearTimeout(existing);
		}

		const entry = this.accumulated.get(key);
		if (entry) {
			entry.diffs.push(diff);
			entry.latestContext = context;
		} else {
			this.accumulated.set(key, { diffs: [diff], latestContext: context });
		}

		const timer = setTimeout(() => {
			const entry = this.accumulated.get(key);
			this.timers.delete(key);
			this.accumulated.delete(key);

			if (!entry || entry.diffs.length === 0) return;

			const merged = mergeFrontmatterDiffs(entry.diffs);
			const filtered = this.options.filterDiff ? this.options.filterDiff(merged) : merged;

			if (filtered.hasChanges) {
				onFlush(filtered, entry.latestContext);
			}
		}, this.options.debounceMs);

		this.timers.set(key, timer);
	}

	destroy(): void {
		for (const timer of this.timers.values()) {
			clearTimeout(timer);
		}
		this.timers.clear();
		this.accumulated.clear();
	}
}
