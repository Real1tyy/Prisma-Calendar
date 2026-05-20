import {
	debounceMsForEnv,
	FrontmatterPropagator,
	parseIntoList,
	showFrontmatterPropagationModal,
	toSafeString,
	VaultTableView,
	type ReactiveMultiGroupBy,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { BehaviorSubject, type Observable, type Subscription } from "rxjs";

import { PROPAGATION_DEBOUNCE_MS } from "../constants";
import type { Frontmatter } from "../types";
import type { CalendarEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/index";
import { applyFrontmatterChangesToInstance } from "../utils/events/frontmatter";
import { getCategoryExpression } from "../utils/filters/expressions";
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
	untracked: number;
}

type EventKind = "timed" | "allDay" | "untracked";

/**
 * Tracks all unique categories across events in the calendar.
 * Extends VaultTableView filtered to files that have categories.
 *
 * Grouping is split by event kind so per-category stats are O(1) — three
 * reactive multi-groups (timed / all-day / untracked) auto-update as the
 * indexer fires row events. Classification is read straight off the row's
 * frontmatter using the configured startProp / dateProp; a file with no
 * date or time keys is "untracked", same definition the indexer applies.
 */
export class CategoryTracker extends VaultTableView<Frontmatter> {
	private categoriesSubject = new BehaviorSubject<CategoryInfo[]>([]);
	private viewEventsSub: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private settings: SingleCalendarConfig;
	private readonly propagator: FrontmatterPropagator;
	private categoryGroups: ReactiveMultiGroupBy<Frontmatter, string>;
	private timedGroups: ReactiveMultiGroupBy<Frontmatter, string>;
	private allDayGroups: ReactiveMultiGroupBy<Frontmatter, string>;
	private untrackedGroups: ReactiveMultiGroupBy<Frontmatter, string>;

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
			distinctBy: (oldRow, newRow) => this.rowsEquivalent(oldRow.data, newRow.data),
		});

		this.settings = settings;
		this.categories$ = this.categoriesSubject.asObservable();

		this.categoryGroups = this.buildCategoryGroups();
		this.timedGroups = this.buildKindGroups("timed");
		this.allDayGroups = this.buildKindGroups("allDay");
		this.untrackedGroups = this.buildKindGroups("untracked");

		this.propagator = new FrontmatterPropagator(app, {
			debounceMs: debounceMsForEnv(PROPAGATION_DEBOUNCE_MS),
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
			const dateClassChanged =
				newSettings.startProp !== this.settings.startProp ||
				newSettings.dateProp !== this.settings.dateProp ||
				newSettings.endProp !== this.settings.endProp;
			this.settings = newSettings;
			if (categoryPropChanged || dateClassChanged) {
				this.updateFilter((row) => this.hasCategoryValues(row.data, newSettings.categoryProp));
				this.rebuildAllGroups();
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
		const trackedRows = [...this.timedGroups.getGroup(category), ...this.allDayGroups.getGroup(category)];
		return trackedRows
			.map((row) => this.eventStore.getEventByPath(row.filePath))
			.filter((e): e is CalendarEvent => e !== null);
	}

	getFilePathsWithCategory(category: string): string[] {
		return this.categoryGroups.getGroup(category).map((row) => row.filePath);
	}

	getUntrackedFilePathsWithCategory(category: string): string[] {
		return this.untrackedGroups.getGroup(category).map((row) => row.filePath);
	}

	getCategoryStats(category: string): CategoryStats {
		const timed = this.timedGroups.getGroup(category).length;
		const allDay = this.allDayGroups.getGroup(category).length;
		const untracked = this.untrackedGroups.getGroup(category).length;
		return { total: timed + allDay + untracked, timed, allDay, untracked };
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

	private buildCategoryInfoList(): CategoryInfo[] {
		return this.getCategories().map((name) => ({
			name,
			color: this.resolveCategoryColor(name),
		}));
	}

	private buildCategoryGroups(): ReactiveMultiGroupBy<Frontmatter, string> {
		return this.createMultiGroupBy((row) => this.categoriesOf(row.data));
	}

	private buildKindGroups(kind: EventKind): ReactiveMultiGroupBy<Frontmatter, string> {
		return this.createMultiGroupBy((row) => (this.classifyRow(row.data) === kind ? this.categoriesOf(row.data) : []));
	}

	private rebuildAllGroups(): void {
		this.categoryGroups.destroy();
		this.timedGroups.destroy();
		this.allDayGroups.destroy();
		this.untrackedGroups.destroy();
		this.categoryGroups = this.buildCategoryGroups();
		this.timedGroups = this.buildKindGroups("timed");
		this.allDayGroups = this.buildKindGroups("allDay");
		this.untrackedGroups = this.buildKindGroups("untracked");
	}

	private categoriesOf(data: Frontmatter): string[] {
		const prop = this.settings.categoryProp;
		return prop ? parseIntoList(data[prop]) : [];
	}

	private classifyRow(data: Frontmatter): EventKind {
		if (data[this.settings.startProp] != null && data[this.settings.startProp] !== "") return "timed";
		if (data[this.settings.dateProp] != null && data[this.settings.dateProp] !== "") return "allDay";
		return "untracked";
	}

	private hasCategoryValues(data: Frontmatter, categoryProp: string | undefined): boolean {
		if (!categoryProp) return false;
		return parseIntoList(data[categoryProp]).length > 0;
	}

	/**
	 * Suppress row-updated when neither the category list nor the kind changed —
	 * the kind is part of the cache key now, not just the category set, so a
	 * file flipping from "no Start Date" to "has Start Date" must still flow
	 * through even if the categories were untouched.
	 */
	private rowsEquivalent(oldData: Frontmatter, newData: Frontmatter): boolean {
		const prop = this.settings.categoryProp;
		if (prop) {
			const oldCat = toSafeString(oldData[prop]) ?? "";
			const newCat = toSafeString(newData[prop]) ?? "";
			if (oldCat !== newCat) return false;
		}
		return this.classifyRow(oldData) === this.classifyRow(newData);
	}

	private resolveCategoryColor(category: string): string {
		const categoryProp = this.settings.categoryProp;
		if (!categoryProp) return this.settings.defaultNodeColor;

		const expectedExpression = getCategoryExpression(category, categoryProp);

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
		this.timedGroups.destroy();
		this.allDayGroups.destroy();
		this.untrackedGroups.destroy();
		this.categoriesSubject.complete();
		super.destroy();
	}
}
