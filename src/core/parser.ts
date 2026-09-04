import { FilterEvaluator } from "@real1ty/obsidian-plugins";
import type { BehaviorSubject, Subscription } from "rxjs";

import type { CalendarEvent } from "../types/calendar";
import { buildEventSchemaInput, createEventSchema, type CalendarEventParser } from "../types/event-schemas";
import type { AutomaticFrontmatterWriter, RawEventSource } from "../types/event-source";
import type { PrismaCalendarSettingsStore, SingleCalendarConfig } from "../types/index";
import { findConflictForCalendar } from "../utils/calendar/conflicts";
import { applyDateNormalizationToFile } from "../utils/events/frontmatter";
import { log } from "./logging";

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
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private mainSettingsStore: PrismaCalendarSettingsStore,
		private calendarId: string,
		private writer: AutomaticFrontmatterWriter
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
		const conflict = findConflictForCalendar(this.calendarId, this.mainSettingsStore.currentSettings.calendars);
		const hadConflict = this.hasNormalizationConflict;
		this.hasNormalizationConflict = conflict !== null;
		if (this.hasNormalizationConflict && !hadConflict) {
			log.warn("parser", "Sort-date normalization suspended: another calendar in the same directory disagrees", {
				calendarId: this.calendarId,
			});
		} else if (!this.hasNormalizationConflict && hadConflict) {
			log.info("parser", "Sort-date normalization resumed", { calendarId: this.calendarId });
		}
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
		if (!event) {
			// Debug, not warn: notes without a usable date are routine (untracked
			// notes share the directory), and this runs on every parse.
			log.debug("parser", "Note has no parsable event date", { filePath: source.filePath });
			return null;
		}

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
				this.writer,
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
