import type { BehaviorSubject, Subscription } from "rxjs";

import { eventDefaults, type UntrackedEvent } from "../../types/calendar";
import type { CalendarEventSource, RawEventSource } from "../../types/event-source";
import type { Frontmatter, SingleCalendarConfig } from "../../types/index";
import { UntrackedFilterEvaluator } from "../../utils/filters/untracked-evaluator";
import type { EventSourceView } from "../event-source-view";
import { IndexedCacheStore } from "./indexed-cache-store";

export class UntrackedEventStore extends IndexedCacheStore<UntrackedEvent> {
	private settingsSubscription: Subscription | null = null;
	private filterEvaluator: UntrackedFilterEvaluator;
	private lastFilterExpressions: string[] = [];

	constructor(
		private eventSource: CalendarEventSource,
		sourceView: EventSourceView,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		super(sourceView);
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
