import { BehaviorSubject, type Observable, type Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { SingleCalendarConfig } from "../types/index";
import type { Indexer, IndexerEvent } from "./indexer";

/**
 * Tracks all unique categories across events in the calendar.
 * Categories are extracted from frontmatter during indexing and maintained
 * as a reactive set that updates as events are added, modified, or deleted.
 */
export class CategoryTracker {
	private categories = new Set<string>();
	private categoriesSubject = new BehaviorSubject<Set<string>>(new Set());
	private subscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private _settings: SingleCalendarConfig;

	public readonly categories$: Observable<Set<string>>;

	constructor(
		private indexer: Indexer,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		this._settings = settingsStore.value;
		this.categories$ = this.categoriesSubject.asObservable();

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			this._settings = newSettings;
		});

		this.subscription = this.indexer.events$
			.pipe(filter((event: IndexerEvent) => event.type === "file-changed" || event.type === "file-deleted"))
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});

		this.indexingCompleteSubscription = this.indexer.indexingComplete$.subscribe((isComplete) => {
			if (isComplete) {
				this.notifyChange();
			}
		});
	}

	private handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.extractCategory(event.source.frontmatter);
				}
				break;
			case "file-deleted":
				// We don't remove categories on deletion as they may be used by other events
				// A full rescan would be needed to accurately remove orphaned categories
				break;
		}
	}

	private extractCategory(frontmatter: Record<string, unknown>): void {
		const categoryProp = this._settings.categoryProp;
		if (!categoryProp) return;

		const categoryValue = frontmatter[categoryProp];
		if (categoryValue === undefined || categoryValue === null) return;

		// Handle both single string and array of categories
		if (Array.isArray(categoryValue)) {
			for (const cat of categoryValue) {
				if (typeof cat === "string" && cat.trim()) {
					this.categories.add(cat.trim());
				}
			}
		} else if (typeof categoryValue === "string" && categoryValue.trim()) {
			this.categories.add(categoryValue.trim());
		}
	}

	private notifyChange(): void {
		this.categoriesSubject.next(new Set(this.categories));
	}

	getCategories(): string[] {
		return Array.from(this.categories).sort((a, b) => a.localeCompare(b));
	}

	clear(): void {
		this.categories.clear();
		this.notifyChange();
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.categoriesSubject.complete();
	}
}
