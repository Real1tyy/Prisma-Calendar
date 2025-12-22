import { BehaviorSubject, type Observable, type Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { Frontmatter } from "../types";
import type { SingleCalendarConfig } from "../types/index";
import { parseIntoList } from "../utils/list-utils";
import type { Indexer, IndexerEvent } from "./indexer";

/**
 * Tracks all unique categories across events in the calendar.
 * Maintains a map of category -> Set of file paths that have that category.
 * Categories are extracted from frontmatter during indexing and maintained
 * as a reactive map that updates as events are added, modified, or deleted.
 */
export class CategoryTracker {
	private categoryToFiles = new Map<string, Set<string>>();
	private fileToCategories = new Map<string, Set<string>>();
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
					this.updateFileCategories(event.filePath, event.source.frontmatter);
				}
				break;
			case "file-deleted":
				this.removeFile(event.filePath);
				break;
		}
	}

	private removeCategoriesFromFile(filePath: string, categoriesToRemove: Set<string>): void {
		for (const category of categoriesToRemove) {
			const fileSet = this.categoryToFiles.get(category);
			if (fileSet) {
				fileSet.delete(filePath);
				if (fileSet.size === 0) {
					this.categoryToFiles.delete(category);
				}
			} else {
				console.error(
					`Category ${category} not found for file ${filePath}, this should not happen, please report this as a bug.`
				);
			}
		}
	}

	private updateFileCategories(filePath: string, frontmatter: Frontmatter): void {
		const categoryProp = this._settings.categoryProp;
		if (!categoryProp) return;

		const oldCategories = this.fileToCategories.get(filePath) || new Set<string>();
		const newCategories = new Set(parseIntoList(frontmatter[categoryProp]));
		const categoriesToRemove = new Set([...oldCategories].filter((cat) => !newCategories.has(cat)));

		if (categoriesToRemove.size > 0) {
			this.removeCategoriesFromFile(filePath, categoriesToRemove);
		}

		for (const newCat of newCategories) {
			if (!this.categoryToFiles.has(newCat)) {
				this.categoryToFiles.set(newCat, new Set());
			}
			this.categoryToFiles.get(newCat)!.add(filePath);
		}

		if (newCategories.size > 0) {
			this.fileToCategories.set(filePath, newCategories);
		} else {
			this.fileToCategories.delete(filePath);
		}

		this.notifyChange();
	}

	private removeFile(filePath: string): void {
		const categories = this.fileToCategories.get(filePath);
		if (!categories) return;

		this.removeCategoriesFromFile(filePath, categories);

		this.fileToCategories.delete(filePath);
		this.notifyChange();
	}

	private notifyChange(): void {
		this.categoriesSubject.next(new Set(this.categoryToFiles.keys()));
	}

	getCategories(): string[] {
		return Array.from(this.categoryToFiles.keys()).sort((a, b) => a.localeCompare(b));
	}

	getEventsWithCategory(category: string): Set<string> {
		return new Set(this.categoryToFiles.get(category) || []);
	}

	getAllFilesWithCategories(): Set<string> {
		return new Set(this.fileToCategories.keys());
	}

	clear(): void {
		this.categoryToFiles.clear();
		this.fileToCategories.clear();
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
