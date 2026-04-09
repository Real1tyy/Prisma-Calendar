import type { BehaviorSubject, Subscription } from "rxjs";

import type { UntrackedEvent } from "../../types/calendar";
import { eventDefaults } from "../../types/calendar";
import type { CalendarEventSource, IndexerEvent, RawEventSource } from "../../types/event-source";
import type { Frontmatter, SingleCalendarConfig } from "../../types/index";
import { UntrackedFilterEvaluator } from "../../utils/untracked-filter-evaluator";
import { IndexedCacheStore } from "./indexed-cache-store";

export class UntrackedEventStore extends IndexedCacheStore<UntrackedEvent> {
	private settingsSubscription: Subscription | null = null;
	private filterEvaluator: UntrackedFilterEvaluator;
	private lastFilterExpressions: string[] = [];

	constructor(eventSource: CalendarEventSource, settingsStore: BehaviorSubject<SingleCalendarConfig>) {
		super(eventSource, new Set(["untracked-file-changed", "file-changed", "file-deleted"]));
		this.filterEvaluator = new UntrackedFilterEvaluator(settingsStore);
		this.lastFilterExpressions = settingsStore.value.untrackedFilterExpressions;

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			const filtersChanged =
				JSON.stringify(this.lastFilterExpressions) !== JSON.stringify(newSettings.untrackedFilterExpressions);

			if (filtersChanged) {
				this.lastFilterExpressions = newSettings.untrackedFilterExpressions;
				this.cache.clear();
				this.eventSource.resync();
			}
		});
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

	protected override buildTemplate(source: RawEventSource): UntrackedEvent | null {
		if (!this.filterEvaluator.evaluateFilters(source.frontmatter)) {
			return null;
		}

		const title = this.extractTitle(source.frontmatter, source.filePath);

		return {
			...eventDefaults(),
			id: source.filePath,
			ref: { filePath: source.filePath },
			title,
			type: "untracked",
			meta: source.frontmatter,
		};
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
