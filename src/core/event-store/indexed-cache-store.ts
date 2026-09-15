import { DebouncedNotifier } from "@real1ty/obsidian-plugins";
import type { Subscription } from "rxjs";

import type { RawEventSource } from "../../types/event-source";
import type { EventSourceEvent, EventSourceView } from "../event-source-view";

/**
 * A cache derived from one scope of the event table. The view decides
 * membership, so a row that stops matching the scope arrives here as a removal
 * — the same signal a deleted note produces, because both mean "this path is no
 * longer one of mine".
 */
export abstract class IndexedCacheStore<TTemplate> extends DebouncedNotifier {
	protected cache = new Map<string, TTemplate>();
	private subscription: Subscription | null = null;

	constructor(protected readonly sourceView: EventSourceView) {
		super();
		this.subscription = this.sourceView.sources$.subscribe((event: EventSourceEvent) => {
			this.handleSourceEvent(event);
		});
	}

	protected abstract buildTemplate(source: RawEventSource): TTemplate | null;

	protected handleSourceEvent(event: EventSourceEvent): void {
		if (event.type === "source-removed") {
			this.invalidate(event.filePath);
			return;
		}
		this.processFileChange(event.source);
	}

	protected processFileChange(source: RawEventSource): void {
		// Always rebuild when a row event arrives. VaultTable already dedupes on
		// structural frontmatter equality, so any event that reaches us reflects a
		// real content change — even if mtime happens to match (e.g.
		// processFrontMatter during bulk category renames).
		const template = this.buildTemplate(source);

		if (template) {
			this.upsert(source.filePath, template);
		} else {
			this.invalidate(source.filePath);
		}
	}

	protected upsert(filePath: string, template: TTemplate): void {
		const oldCached = this.cache.get(filePath);
		if (oldCached) {
			this.onBeforeRemove(oldCached);
		}

		this.cache.set(filePath, template);
		this.onAfterUpsert(template);
		this.scheduleRefresh();
	}

	invalidate(filePath: string): void {
		const cached = this.cache.get(filePath);

		if (cached && this.cache.delete(filePath)) {
			this.onBeforeRemove(cached);
			this.notifyChange();
		}
	}

	getByPath(filePath: string): TTemplate | null {
		return this.cache.get(filePath) ?? null;
	}

	getAll(): TTemplate[] {
		return Array.from(this.cache.values());
	}

	clear(): void {
		for (const cached of this.cache.values()) {
			this.onBeforeRemove(cached);
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
