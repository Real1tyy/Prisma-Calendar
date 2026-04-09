import type { App } from "obsidian";

import type { Frontmatter, FrontmatterChange, FrontmatterDiff } from "./frontmatter-diff";
import { applyFrontmatterChanges } from "./frontmatter-propagation";
import { FrontmatterPropagationDebouncer } from "./frontmatter-propagation-debouncer";

const PROPAGATION_CLEANUP_DELAY_MS = 2000;

export interface FrontmatterPropagatorConfig {
	/** Debounce interval in milliseconds */
	debounceMs: number;
	/** Prefix for debounce keys (e.g., "category" → "category:Work") */
	debounceKeyPrefix: string;
	/** Whether auto-propagation is enabled */
	isEnabled: () => boolean;
	/** Whether to show confirmation modal instead of auto-propagating */
	isAskBefore: () => boolean;
	/** Returns the set of frontmatter props to exclude from propagation */
	getExcludedProps: () => Set<string>;
	/**
	 * Resolves target file paths to propagate to (must exclude the source).
	 * @param filePath - the file that changed
	 * @param groupKey - the grouping key (e.g., category name, series key)
	 */
	resolveTargets: (filePath: string, groupKey: string) => string[];
	/** Title for the confirmation modal (e.g., "Category series: Work") */
	getModalTitle: (groupKey: string) => string;
	/**
	 * Optional: custom apply function. Defaults to applyFrontmatterChanges.
	 * Use this when you need exclusion filtering at the per-file write level
	 * (e.g., Prisma Calendar's applyFrontmatterChangesToInstance).
	 */
	applyChanges?: (app: App, targetPath: string, sourceFrontmatter: Frontmatter, diff: FrontmatterDiff) => Promise<void>;
	/**
	 * Optional: show confirmation modal. Defaults to showFrontmatterPropagationModal.
	 * Injected to avoid hard dependency on the modal component in headless contexts.
	 */
	showModal?: (
		app: App,
		config: { eventTitle: string; diff: FrontmatterDiff; instanceCount: number; onConfirm: () => void }
	) => void;
}

/**
 * Composable frontmatter propagation — debouncing, loop prevention, batch writes,
 * and optional confirmation modals. Configurable per consumer via FrontmatterPropagatorConfig.
 */
export class FrontmatterPropagator {
	/** File paths currently being propagated to — prevents infinite loops */
	readonly propagatingFilePaths = new Set<string>();

	private readonly debouncer: FrontmatterPropagationDebouncer<{
		sourceFrontmatter: Frontmatter;
		filePath: string;
		groupKey: string;
	}>;

	constructor(
		private readonly app: App,
		private readonly config: FrontmatterPropagatorConfig
	) {
		this.debouncer = new FrontmatterPropagationDebouncer({
			debounceMs: config.debounceMs,
			filterDiff: (diff) => filterExcludedPropsFromDiff(diff, this.config.getExcludedProps()),
		});
	}

	/**
	 * Called when a file's frontmatter changes with a diff.
	 * Schedules debounced propagation to resolved targets.
	 */
	handleDiff(filePath: string, sourceFrontmatter: Frontmatter, diff: FrontmatterDiff, groupKey: string): void {
		if (!this.config.isEnabled() && !this.config.isAskBefore()) return;

		const debounceKey = `${this.config.debounceKeyPrefix}:${groupKey}`;
		const ctx = { sourceFrontmatter, filePath, groupKey };

		this.debouncer.schedule(debounceKey, diff, ctx, (filteredDiff, c) => {
			const targets = this.config.resolveTargets(c.filePath, c.groupKey);
			if (targets.length === 0) return;

			if (this.config.isEnabled()) {
				void this.propagate(c.sourceFrontmatter, filteredDiff, targets);
			} else if (this.config.isAskBefore() && this.config.showModal) {
				this.config.showModal(this.app, {
					eventTitle: this.config.getModalTitle(c.groupKey),
					diff: filteredDiff,
					instanceCount: targets.length,
					onConfirm: () => void this.propagate(c.sourceFrontmatter, filteredDiff, targets),
				});
			}
		});
	}

	/** Returns true if the given file path is currently being propagated to */
	isPropagating(filePath: string): boolean {
		return this.propagatingFilePaths.has(filePath);
	}

	/** Consumes a propagation flag for a file path (call from event handler to acknowledge) */
	acknowledgePropagation(filePath: string): void {
		this.propagatingFilePaths.delete(filePath);
	}

	private async propagate(
		sourceFrontmatter: Frontmatter,
		diff: FrontmatterDiff,
		targetFilePaths: string[]
	): Promise<void> {
		for (const fp of targetFilePaths) {
			this.propagatingFilePaths.add(fp);
		}

		const apply = this.config.applyChanges ?? applyFrontmatterChanges;

		try {
			await Promise.all(targetFilePaths.map((fp) => apply(this.app, fp, sourceFrontmatter, diff)));
		} finally {
			// Delay cleanup to account for indexer processing latency
			setTimeout(() => {
				for (const fp of targetFilePaths) {
					this.propagatingFilePaths.delete(fp);
				}
			}, PROPAGATION_CLEANUP_DELAY_MS);
		}
	}

	destroy(): void {
		this.debouncer.destroy();
		this.propagatingFilePaths.clear();
	}
}

// ─── Utility ─────────────────────────────────────────────────

/** Filters a FrontmatterDiff by removing changes to excluded properties */
export function filterExcludedPropsFromDiff(diff: FrontmatterDiff, excludedProps: Set<string>): FrontmatterDiff {
	const isAllowed = (change: FrontmatterChange) => !excludedProps.has(change.key);

	const added = diff.added.filter(isAllowed);
	const modified = diff.modified.filter(isAllowed);
	const deleted = diff.deleted.filter(isAllowed);

	return {
		...diff,
		added,
		modified,
		deleted,
		hasChanges: added.length > 0 || modified.length > 0 || deleted.length > 0,
	};
}
