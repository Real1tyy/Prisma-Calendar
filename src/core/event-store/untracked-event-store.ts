import type { BehaviorSubject, Subscription } from "rxjs";
import type { UntrackedEvent } from "../../types/calendar";
import type { Frontmatter, SingleCalendarConfig } from "../../types/index";
import { UntrackedFilterEvaluator } from "../../utils/untracked-filter-evaluator";
import { IndexedCacheStore } from "./indexed-cache-store";
import type { Indexer, IndexerEvent, RawEventSource } from "../indexer";

export class UntrackedEventStore extends IndexedCacheStore<UntrackedEvent> {
	private settingsSubscription: Subscription | null = null;
	private filterEvaluator: UntrackedFilterEvaluator;
	private lastFilterExpressions: string[] = [];

	constructor(indexer: Indexer, settingsStore: BehaviorSubject<SingleCalendarConfig>) {
		super(indexer, new Set(["untracked-file-changed", "file-changed", "file-deleted"]));
		this.filterEvaluator = new UntrackedFilterEvaluator(settingsStore);
		this.lastFilterExpressions = settingsStore.value.untrackedFilterExpressions;

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

	protected buildTemplate(source: RawEventSource): UntrackedEvent | null {
		if (!this.filterEvaluator.evaluateFilters(source.frontmatter)) {
			return null;
		}

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

	protected override handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "untracked-file-changed":
				if (event.source) {
					this.processFileChange(event.source);
				}
				break;
			case "file-changed":
				if (this.cache.has(event.filePath)) {
					this.invalidate(event.filePath);
				}
				break;
			case "file-deleted":
				this.invalidate(event.filePath);
				break;
		}
	}

	getUntrackedEvents(): UntrackedEvent[] {
		return this.getAll().sort((a, b) => a.title.localeCompare(b.title));
	}

	getEventByPath(filePath: string): UntrackedEvent | null {
		return this.getByPath(filePath);
	}

	override destroy(): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.filterEvaluator.destroy();
		super.destroy();
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
}
