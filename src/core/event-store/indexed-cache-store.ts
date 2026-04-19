import { DebouncedNotifier } from "@real1ty-obsidian-plugins";
import type { Subscription } from "rxjs";
import { filter } from "rxjs/operators";

import type { CalendarEventSource, IndexerEvent, RawEventSource } from "../../types/event-source";

export interface CacheEntry<T> {
	template: T;
	mtime: number;
}

export abstract class IndexedCacheStore<TTemplate> extends DebouncedNotifier {
	protected cache = new Map<string, CacheEntry<TTemplate>>();
	private subscription: Subscription | null = null;

	constructor(
		protected eventSource: CalendarEventSource,
		private watchedTypes: ReadonlySet<IndexerEvent["type"]>
	) {
		super();
		this.subscription = this.eventSource.events$
			.pipe(filter((event: IndexerEvent) => this.watchedTypes.has(event.type)))
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});
	}

	protected abstract buildTemplate(source: RawEventSource): TTemplate | null;

	protected handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "file-deleted":
				this.invalidate(event.filePath);
				break;
			default:
				if (event.source) {
					this.processFileChange(event.source);
				}
				break;
		}
	}

	protected processFileChange(source: RawEventSource): void {
		// Always rebuild when a file-changed event arrives. VaultTable already
		// dedupes on structural frontmatter equality, so any event that reaches
		// us reflects a real content change — even if mtime happens to match
		// (e.g. processFrontMatter during bulk category renames).
		const template = this.buildTemplate(source);

		if (template) {
			this.upsert(source.filePath, template, source.mtime);
		} else {
			this.invalidate(source.filePath);
		}
	}

	protected upsert(filePath: string, template: TTemplate, mtime: number): void {
		const oldCached = this.cache.get(filePath);
		if (oldCached) {
			this.onBeforeRemove(oldCached.template);
		}

		this.cache.set(filePath, { template, mtime });
		this.onAfterUpsert(template);
		this.scheduleRefresh();
	}

	invalidate(filePath: string): void {
		const cached = this.cache.get(filePath);

		if (cached && this.cache.delete(filePath)) {
			this.onBeforeRemove(cached.template);
			this.notifyChange();
		}
	}

	isUpToDate(filePath: string, mtime: number): boolean {
		const cached = this.cache.get(filePath);
		return cached ? cached.mtime === mtime : false;
	}

	getByPath(filePath: string): TTemplate | null {
		return this.cache.get(filePath)?.template ?? null;
	}

	getAll(): TTemplate[] {
		const results: TTemplate[] = [];
		for (const cached of this.cache.values()) {
			results.push(cached.template);
		}
		return results;
	}

	clear(): void {
		for (const cached of this.cache.values()) {
			this.onBeforeRemove(cached.template);
		}
		this.cache.clear();
		this.notifyChange();
	}

	override destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		super.destroy();
		this.clear();
	}

	protected onBeforeRemove(_old: TTemplate): void {}

	protected onAfterUpsert(_new: TTemplate): void {}
}
