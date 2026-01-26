import { BehaviorSubject, type Observable, type Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { Frontmatter } from "../types";
import type { CalendarEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/index";
import { parseIntoList } from "@real1ty-obsidian-plugins";
import type { EventStore } from "./event-store";
import type { Indexer, IndexerEvent } from "./indexer";

export interface CategoryInfo {
	name: string;
	color: string;
}

export interface CategoryStats {
	total: number;
	timed: number;
	allDay: number;
}

/**
 * Tracks all unique categories across events in the calendar.
 * Maintains a map of category -> CalendarEvent[] for efficient access.
 * Categories are extracted from frontmatter during indexing and maintained
 * as a reactive map that updates as events are added, modified, or deleted.
 * Also resolves category colors from color rules in settings.
 */
export class CategoryTracker {
	private categoryToEvents = new Map<string, CalendarEvent[]>();
	private fileToCategories = new Map<string, Set<string>>();
	private categoriesSubject = new BehaviorSubject<CategoryInfo[]>([]);
	private subscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private _settings: SingleCalendarConfig;

	public readonly categories$: Observable<CategoryInfo[]>;

	constructor(
		private indexer: Indexer,
		private eventStore: EventStore,
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
				this.rebuildCategoryMaps();
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

	private addEventToCategories(event: CalendarEvent): void {
		const categoryProp = this._settings.categoryProp;
		if (!categoryProp) return;

		const categories = parseIntoList(event.meta[categoryProp]);
		for (const category of categories) {
			if (!this.categoryToEvents.has(category)) {
				this.categoryToEvents.set(category, []);
			}
			const events = this.categoryToEvents.get(category)!;
			const existingIndex = events.findIndex((e) => e.ref.filePath === event.ref.filePath);
			if (existingIndex >= 0) {
				events[existingIndex] = event;
			} else {
				events.push(event);
			}
		}
	}

	private rebuildCategoryMaps(): void {
		this.categoryToEvents.clear();

		const allEvents = this.eventStore.getAllEvents();
		for (const event of allEvents) {
			this.addEventToCategories(event);
		}

		this.notifyChange();
	}

	private removeCategoriesFromFile(filePath: string, categoriesToRemove: Set<string>): void {
		for (const category of categoriesToRemove) {
			const events = this.categoryToEvents.get(category);
			if (events) {
				const filtered = events.filter((e) => e.ref.filePath !== filePath);
				if (filtered.length === 0) {
					this.categoryToEvents.delete(category);
				} else {
					this.categoryToEvents.set(category, filtered);
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
		const newCategories = new Set<string>(parseIntoList(frontmatter[categoryProp]));
		const categoriesToRemove = new Set([...oldCategories].filter((cat) => !newCategories.has(cat)));

		if (categoriesToRemove.size > 0) {
			this.removeCategoriesFromFile(filePath, categoriesToRemove);
		}

		if (newCategories.size > 0) {
			this.fileToCategories.set(filePath, newCategories);
		} else {
			this.fileToCategories.delete(filePath);
		}

		const event = this.eventStore.getEventByPath(filePath);
		if (event) {
			this.addEventToCategories(event);
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
		const categories = this.buildCategoryInfoList();
		this.categoriesSubject.next(categories);
	}

	private buildCategoryInfoList(): CategoryInfo[] {
		const categoryNames = Array.from(this.categoryToEvents.keys()).sort((a, b) => a.localeCompare(b));
		return categoryNames.map((name) => ({
			name,
			color: this.resolveCategoryColor(name),
		}));
	}

	private resolveCategoryColor(category: string): string {
		const categoryProp = this._settings.categoryProp;
		if (!categoryProp) return this._settings.defaultNodeColor;

		const escapedCategory = category.replace(/'/g, "\\'");
		const expectedExpression = `${categoryProp}.includes('${escapedCategory}')`;

		for (const rule of this._settings.colorRules) {
			if (rule.enabled && rule.expression === expectedExpression) {
				return rule.color;
			}
		}

		return this._settings.defaultNodeColor;
	}

	getCategories(): string[] {
		return Array.from(this.categoryToEvents.keys()).sort((a, b) => a.localeCompare(b));
	}

	getCategoriesWithColors(): CategoryInfo[] {
		return this.buildCategoryInfoList();
	}

	getEventsWithCategory(category: string): CalendarEvent[] {
		return this.categoryToEvents.get(category) || [];
	}

	getCategoryStats(category: string): CategoryStats {
		const events = this.getEventsWithCategory(category);
		return {
			total: events.length,
			timed: events.filter((e) => e.type === "timed").length,
			allDay: events.filter((e) => e.type === "allDay").length,
		};
	}

	getAllFilesWithCategories(): Set<string> {
		return new Set(this.fileToCategories.keys());
	}

	clear(): void {
		this.categoryToEvents.clear();
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
