import {
	FrontmatterPropagator,
	parseIntoList,
	type ReactiveMultiGroupBy,
	showFrontmatterPropagationModal,
	VaultTableView,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { BehaviorSubject, type Observable, type Subscription } from "rxjs";

import { PROPAGATION_DEBOUNCE_MS } from "../constants";
import type { Frontmatter } from "../types";
import type { CalendarEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/index";
import { applyFrontmatterChangesToInstance } from "../utils/event-frontmatter";
import { getExcludedProps } from "../utils/frontmatter/props";
import type { EventFileRepository } from "./event-file-repository";
import type { EventStore } from "./event-store";

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
 * Extends VaultTableView filtered to files that have categories.
 * Uses ReactiveMultiGroupBy for category grouping.
 */
export class CategoryTracker extends VaultTableView<Frontmatter> {
	private categoriesSubject = new BehaviorSubject<CategoryInfo[]>([]);
	private viewEventsSub: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private settings: SingleCalendarConfig;
	private readonly propagator: FrontmatterPropagator;
	private categoryGroups: ReactiveMultiGroupBy<Frontmatter, string>;

	public readonly categories$: Observable<CategoryInfo[]>;

	constructor(
		app: App,
		repo: EventFileRepository,
		private eventStore: EventStore,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		const settings = settingsStore.value;
		super(repo.getTable(), {
			filter: (row) => this.hasCategoryValues(row.data, settings.categoryProp),
			distinctBy: (oldRow, newRow) => this.categoryValuesEqual(oldRow.data, newRow.data, this.settings.categoryProp),
		});

		this.settings = settings;
		this.categories$ = this.categoriesSubject.asObservable();

		this.categoryGroups = this.buildCategoryGroups();

		this.propagator = new FrontmatterPropagator(app, {
			debounceMs: PROPAGATION_DEBOUNCE_MS,
			debounceKeyPrefix: "category",
			isEnabled: () => this.settings.propagateFrontmatterToCategorySeries,
			isAskBefore: () => this.settings.askBeforePropagatingToCategorySeries,
			getExcludedProps: () => getExcludedProps(this.settings, this.settings.excludedCategorySeriesProps),
			getModalTitle: (groupKey) => `Category series: ${groupKey}`,
			showModal: showFrontmatterPropagationModal,
			applyChanges: (a, targetPath, sourceFm, diff) =>
				applyFrontmatterChangesToInstance(
					a,
					targetPath,
					sourceFm,
					diff,
					getExcludedProps(this.settings, this.settings.excludedCategorySeriesProps)
				),
			resolveTargets: (filePath, groupKey) => this.getFilePathsWithCategory(groupKey).filter((fp) => fp !== filePath),
		});

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			const categoryPropChanged = newSettings.categoryProp !== this.settings.categoryProp;
			this.settings = newSettings;
			if (categoryPropChanged) {
				this.updateFilter((row) => this.hasCategoryValues(row.data, newSettings.categoryProp));
				this.categoryGroups.destroy();
				this.categoryGroups = this.buildCategoryGroups();
				this.categoriesSubject.next(this.buildCategoryInfoList());
			}
		});

		this.viewEventsSub = this.events$.subscribe((event) => {
			this.categoriesSubject.next(this.buildCategoryInfoList());

			if (event.type === "row-updated" && event.diff?.hasChanges && !this.propagator.isPropagating(event.filePath)) {
				const categoryProp = this.settings.categoryProp;
				if (categoryProp) {
					for (const cat of parseIntoList(event.newRow.data[categoryProp])) {
						if (this.categoryGroups.getGroup(cat).length >= 2) {
							this.propagator.handleDiff(event.filePath, event.newRow.data, event.diff, cat);
						}
					}
				}
			}
		});
	}

	// ─── Public Query API ────────────────────────────────────────

	getCategories(): string[] {
		return this.categoryGroups.getKeys().sort((a, b) => a.localeCompare(b));
	}

	getCategoriesWithColors(): CategoryInfo[] {
		return this.buildCategoryInfoList();
	}

	getEventsWithCategory(category: string): CalendarEvent[] {
		return this.categoryGroups
			.getGroup(category)
			.map((row) => this.eventStore.getEventByPath(row.filePath))
			.filter((e): e is CalendarEvent => e !== null);
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
		return new Set(this.toArray().map((row) => row.filePath));
	}

	getCategoryColor(category: string): string {
		return this.resolveCategoryColor(category);
	}

	clear(): void {
		this.categoriesSubject.next([]);
	}

	// ─── Internal ────────────────────────────────────────────────

	private getFilePathsWithCategory(category: string): string[] {
		return this.categoryGroups.getGroup(category).map((row) => row.filePath);
	}

	private buildCategoryInfoList(): CategoryInfo[] {
		return this.getCategories().map((name) => ({
			name,
			color: this.resolveCategoryColor(name),
		}));
	}

	private buildCategoryGroups(): ReactiveMultiGroupBy<Frontmatter, string> {
		return this.createMultiGroupBy((row) => {
			const prop = this.settings.categoryProp;
			return prop ? parseIntoList(row.data[prop]) : [];
		});
	}

	private hasCategoryValues(data: Frontmatter, categoryProp: string | undefined): boolean {
		if (!categoryProp) return false;
		return parseIntoList(data[categoryProp]).length > 0;
	}

	private categoryValuesEqual(oldData: Frontmatter, newData: Frontmatter, categoryProp: string | undefined): boolean {
		if (!categoryProp) return true;
		const oldVal = oldData[categoryProp];
		const newVal = newData[categoryProp];
		return String(oldVal ?? "") === String(newVal ?? "");
	}

	private resolveCategoryColor(category: string): string {
		const categoryProp = this.settings.categoryProp;
		if (!categoryProp) return this.settings.defaultNodeColor;

		const escapedCategory = category.replace(/'/g, "\\'");
		const expectedExpression = `${categoryProp}.includes('${escapedCategory}')`;

		for (const rule of this.settings.colorRules) {
			if (rule.enabled && rule.expression === expectedExpression) {
				return rule.color;
			}
		}

		return this.settings.defaultNodeColor;
	}

	override destroy(): void {
		this.viewEventsSub?.unsubscribe();
		this.viewEventsSub = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.propagator.destroy();
		this.categoryGroups.destroy();
		this.categoriesSubject.complete();
		super.destroy();
	}
}
