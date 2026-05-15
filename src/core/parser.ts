import { FilterEvaluator } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";

import type { CalendarEvent } from "../types/calendar";
import type { CalendarEventParser } from "../types/event-schemas";
import { buildEventSchemaInput, createEventSchema } from "../types/event-schemas";
import type { RawEventSource } from "../types/event-source";
import type { PrismaCalendarSettingsStore, SingleCalendarConfig } from "../types/index";
import { findConflictForCalendar } from "../utils/calendar/conflicts";
import { applyDateNormalizationToFile } from "../utils/events/frontmatter";

export class Parser {
	private settings: SingleCalendarConfig;
	private subscriptions: Subscription[] = [];
	private filterEvaluator: FilterEvaluator<SingleCalendarConfig>;
	private schema: CalendarEventParser;
	// Cached on every settings change so parseEventSource doesn't recompute on
	// every event. The runtime guard that prevents two calendars from racing
	// sort-date writes against the same files — see calendar-conflicts.ts.
	private hasNormalizationConflict = false;

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private mainSettingsStore: PrismaCalendarSettingsStore,
		private calendarId: string
	) {
		this.settings = settingsStore.value;
		this.filterEvaluator = new FilterEvaluator<SingleCalendarConfig>(settingsStore);
		this.schema = createEventSchema(this.settings);
		this.recomputeNormalizationConflict();
		this.subscriptions.push(
			settingsStore.subscribe((newSettings) => {
				this.settings = newSettings;
				this.schema = createEventSchema(newSettings);
			}),
			this.mainSettingsStore.settings$.subscribe(() => {
				this.recomputeNormalizationConflict();
			})
		);
	}

	private recomputeNormalizationConflict(): void {
		this.hasNormalizationConflict =
			findConflictForCalendar(this.calendarId, this.mainSettingsStore.currentSettings.calendars) !== null;
	}

	destroy(): void {
		for (const sub of this.subscriptions) sub.unsubscribe();
		this.subscriptions = [];
	}

	parseEventSource(source: RawEventSource): CalendarEvent | null {
		if (!this.filterEvaluator.evaluateFilters(source.frontmatter)) {
			return null;
		}

		const input = buildEventSchemaInput(
			{ filePath: source.filePath, frontmatter: source.frontmatter, folder: source.folder },
			this.settings
		);
		const event = this.schema.parse(input);
		if (!event) return null;

		// Side effect: normalize sort date on disk.
		// TODO(refactor): extract into the side-effects manager when the table-level
		// migration lands; this stays here so the public Parser API doesn't change.
		// Suppress writes while another calendar in the same directory disagrees
		// on (sortingStrategy, sortDateProp): both parsers would otherwise thrash
		// the same property on every parse and corrupt the IDB cache.
		if (!this.hasNormalizationConflict) {
			const start = event.start;
			const end = event.type === "timed" ? event.end : undefined;
			const allDay = event.type === "allDay";
			void applyDateNormalizationToFile(
				this.app,
				source.filePath,
				source.frontmatter,
				this.settings,
				start,
				end,
				allDay
			);
		}

		return event;
	}
}
