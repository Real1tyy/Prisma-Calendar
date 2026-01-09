import { DebouncedNotifier } from "@real1ty-obsidian-plugins/utils";
import type { BehaviorSubject, Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { UntrackedEvent } from "../types/calendar";
import type { Frontmatter, SingleCalendarConfig } from "../types/index";
import { UntrackedFilterEvaluator } from "../utils/untracked-filter-evaluator";
import type { Indexer, IndexerEvent, RawEventSource } from "./indexer";

interface CachedUntrackedEvent {
	template: UntrackedEvent;
	mtime: number;
}

export class UntrackedEventStore extends DebouncedNotifier {
	private cache = new Map<string, CachedUntrackedEvent>();
	private subscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private filterEvaluator: UntrackedFilterEvaluator;
	private lastFilterExpressions: string[] = [];

	constructor(
		private indexer: Indexer,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		super();
		this.filterEvaluator = new UntrackedFilterEvaluator(settingsStore);
		this.lastFilterExpressions = settingsStore.value.untrackedFilterExpressions;

		this.subscription = this.indexer.events$
			.pipe(
				filter(
					(event: IndexerEvent) =>
						event.type === "untracked-file-changed" || event.type === "file-changed" || event.type === "file-deleted"
				)
			)
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			const filtersChanged =
				JSON.stringify(this.lastFilterExpressions) !== JSON.stringify(newSettings.untrackedFilterExpressions);

			if (filtersChanged) {
				this.lastFilterExpressions = newSettings.untrackedFilterExpressions;
				this.cache.clear();
				this.indexer.resync();
			}
		});
	}

	private handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "untracked-file-changed":
				if (event.source) {
					this.processFileChange(event.source);
				}
				break;
			case "file-changed":
				// When a file becomes tracked (has start/end/date props), remove it from untracked cache
				if (this.cache.has(event.filePath)) {
					this.invalidate(event.filePath);
				}
				break;
			case "file-deleted":
				this.invalidate(event.filePath);
				break;
		}
	}

	private processFileChange(source: RawEventSource): void {
		if (this.isUpToDate(source.filePath, source.mtime)) {
			return;
		}

		if (!this.filterEvaluator.evaluateFilters(source.frontmatter)) {
			if (this.cache.has(source.filePath)) {
				this.invalidate(source.filePath);
			}
			return;
		}

		const untrackedEvent = this.createUntrackedEvent(source);
		this.updateUntrackedEvent(source.filePath, untrackedEvent, source.mtime);
	}

	private createUntrackedEvent(source: RawEventSource): UntrackedEvent {
		const title = this.extractTitle(source.frontmatter, source.filePath);

		return {
			id: source.filePath,
			ref: { filePath: source.filePath },
			title,
			type: "untracked",
			isVirtual: false,
			skipped: false,
			meta: source.frontmatter,
		};
	}

	private extractTitle(frontmatter: Frontmatter, filePath: string): string {
		const titleCandidates = ["title", "name", "summary"];
		for (const prop of titleCandidates) {
			const value = frontmatter[prop];
			if (typeof value === "string" && value.trim().length > 0) {
				return value.trim();
			}
		}

		// Fallback to filename without extension
		const fileName = filePath.split("/").pop() || filePath;
		return fileName.replace(/\.md$/, "");
	}

	private updateUntrackedEvent(filePath: string, template: UntrackedEvent, mtime: number): void {
		this.cache.set(filePath, { template, mtime });
		this.scheduleRefresh();
	}

	private invalidate(filePath: string): void {
		if (this.cache.delete(filePath)) {
			this.notifyChange();
		}
	}

	private isUpToDate(filePath: string, mtime: number): boolean {
		const cached = this.cache.get(filePath);
		return cached ? cached.mtime === mtime : false;
	}

	getUntrackedEvents(): UntrackedEvent[] {
		const results: UntrackedEvent[] = [];

		for (const cached of this.cache.values()) {
			results.push(cached.template);
		}

		return results.sort((a, b) => a.title.localeCompare(b.title));
	}

	getEventByPath(filePath: string): UntrackedEvent | null {
		return this.cache.get(filePath)?.template ?? null;
	}

	clear(): void {
		this.cache.clear();
		this.notifyChange();
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.filterEvaluator.destroy();
		super.destroy();
		this.clear();
	}
}
