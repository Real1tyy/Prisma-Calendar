import {
	FrontmatterPropagator,
	type ReactiveGroupBy,
	showFrontmatterPropagationModal,
	VaultTableView,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";

import { PROPAGATION_DEBOUNCE_MS } from "../constants";
import type { CalendarEvent } from "../types/calendar";
import type { Frontmatter, SingleCalendarConfig } from "../types/index";
import { applyFrontmatterChangesToInstance, getExcludedProps } from "../utils/event-frontmatter";
import { getEventName } from "../utils/event-naming";
import type { EventFileRepository } from "./event-file-repository";
import type { EventStore } from "./event-store";

/**
 * Tracks name-based event series and handles frontmatter propagation.
 * Extends VaultTableView over all tracked files.
 * Uses ReactiveGroupBy for name-series grouping.
 */
export class NameSeriesTracker extends VaultTableView<Frontmatter> {
	private viewEventsSub: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private settings: SingleCalendarConfig;
	private readonly propagator: FrontmatterPropagator;
	private nameGroups: ReactiveGroupBy<Frontmatter, string>;

	constructor(
		app: App,
		repo: EventFileRepository,
		private eventStore: EventStore,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		super(repo.getTable(), {
			filter: () => true,
			distinctBy: (oldRow, newRow) => {
				const titleProp = this.settings?.titleProp;
				return titleProp !== undefined && oldRow.data[titleProp] === newRow.data[titleProp];
			},
		});

		this.settings = settingsStore.value;

		this.nameGroups = this.createGroupBy((row) => this.getNameKey(row.data, row.filePath));

		this.propagator = new FrontmatterPropagator(app, {
			debounceMs: PROPAGATION_DEBOUNCE_MS,
			debounceKeyPrefix: "name",
			isEnabled: () => this.settings.propagateFrontmatterToNameSeries,
			isAskBefore: () => this.settings.askBeforePropagatingToNameSeries,
			getExcludedProps: () => getExcludedProps(this.settings, this.settings.excludedNameSeriesProps),
			getModalTitle: (groupKey) => `Name series: ${groupKey}`,
			showModal: showFrontmatterPropagationModal,
			applyChanges: (a, targetPath, sourceFm, diff) =>
				applyFrontmatterChangesToInstance(
					a,
					targetPath,
					sourceFm,
					diff,
					getExcludedProps(this.settings, this.settings.excludedNameSeriesProps)
				),
			resolveTargets: (filePath, groupKey) => {
				return this.nameGroups
					.getGroup(groupKey)
					.map((r) => r.filePath)
					.filter((fp) => fp !== filePath);
			},
		});

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			const titlePropChanged = newSettings.titleProp !== this.settings.titleProp;
			this.settings = newSettings;
			if (titlePropChanged) {
				this.nameGroups.destroy();
				this.nameGroups = this.createGroupBy((row) => this.getNameKey(row.data, row.filePath));
			}
		});

		this.viewEventsSub = this.events$.subscribe((event) => {
			if (!this.settings.enableNameSeriesTracking) return;

			if (event.type === "row-updated" && event.diff?.hasChanges && !this.propagator.isPropagating(event.filePath)) {
				const nameKey = this.getNameKey(event.newRow.data, event.filePath);
				if (nameKey && this.nameGroups.getGroup(nameKey).length >= 2) {
					this.propagator.handleDiff(event.filePath, event.newRow.data, event.diff, nameKey);
				}
			}
		});
	}

	override destroy(): void {
		this.viewEventsSub?.unsubscribe();
		this.viewEventsSub = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.propagator.destroy();
		this.nameGroups.destroy();
		super.destroy();
	}

	// ─── Public Query API ─────────────────────────────────────────

	private getNameKey(frontmatter: Record<string, unknown>, filePath: string): string | null {
		const title = getEventName(this.settings.titleProp, frontmatter, filePath, this.settings.calendarTitleProp);
		return title ? title.toLowerCase() : null;
	}

	/** Returns the name-series map as a read-only view */
	getNameSeriesMap(): ReadonlyMap<string, ReadonlySet<string>> {
		const result = new Map<string, Set<string>>();
		for (const [key, rows] of this.nameGroups.getGroups()) {
			result.set(key, new Set(rows.map((r) => r.filePath)));
		}
		return result;
	}

	/** Returns name-based series that contain 2+ events */
	getNameBasedSeries(): Map<string, Set<string>> {
		const result = new Map<string, Set<string>>();
		for (const [key, rows] of this.nameGroups.getMultiMemberGroups()) {
			result.set(key, new Set(rows.map((r) => r.filePath)));
		}
		return result;
	}

	/** Returns CalendarEvents in the name-based series for a given cleaned name key */
	getEventsInNameSeries(nameKey: string): CalendarEvent[] {
		return this.nameGroups
			.getGroup(nameKey)
			.map((row) => this.eventStore.getEventByPath(row.filePath))
			.filter((e): e is CalendarEvent => e !== null);
	}
}
