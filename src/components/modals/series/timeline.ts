import {
	cls,
	ColorEvaluator,
	hasVeryCloseShadeFromRgb,
	parseColorToRgb,
	type RgbColor,
	showModal,
	toLocalISOString,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { DataSet } from "vis-data";
import { type DataItem, Timeline, type TimelineOptions } from "vis-timeline";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { resolveEventColor } from "../../../utils/event-color";
import { cleanupTitle } from "../../../utils/event-naming";
import { buildEventTooltip } from "../../../utils/format";
import { type PreviewEventData, showEventPreviewModal } from "../preview/event-preview";

const RANGE_CHANGE_DEBOUNCE_MS = 200;
const RANGE_BUFFER_FACTOR = 0.25;
const ALL_DAY_DISPLAY_HOURS = 4;

export interface EventSeriesTimelineConfig {
	/** Static event set (e.g., series/category subset). When omitted, queries eventStore by visible range. */
	events?: CalendarEvent[];
	title: string;
	fillContainer?: boolean;
}

export interface TimelineHandle {
	destroy: () => void;
	invalidateAndRefetch: () => void;
}

// ─── Range Tracker ───────────────────────────────────────────

interface FetchedRange {
	start: number;
	end: number;
}

class FetchedRangeTracker {
	private ranges: FetchedRange[] = [];

	addRange(start: number, end: number): void {
		this.ranges.push({ start, end });
		this.mergeOverlapping();
	}

	getUncoveredRanges(start: number, end: number): FetchedRange[] {
		const uncovered: FetchedRange[] = [];
		let cursor = start;

		for (const range of this.ranges) {
			if (range.start > cursor) {
				uncovered.push({ start: cursor, end: Math.min(range.start, end) });
			}
			cursor = Math.max(cursor, range.end);
			if (cursor >= end) break;
		}

		if (cursor < end) {
			uncovered.push({ start: cursor, end });
		}

		return uncovered;
	}

	clear(): void {
		this.ranges = [];
	}

	private mergeOverlapping(): void {
		if (this.ranges.length <= 1) return;
		this.ranges.sort((a, b) => a.start - b.start);
		const merged: FetchedRange[] = [this.ranges[0]];
		for (let i = 1; i < this.ranges.length; i++) {
			const last = merged[merged.length - 1];
			const curr = this.ranges[i];
			if (curr.start <= last.end) {
				last.end = Math.max(last.end, curr.end);
			} else {
				merged.push(curr);
			}
		}
		this.ranges = merged;
	}
}

// ─── Helpers ─────────────────────────────────────────────────

function filterEventsByRange(events: CalendarEvent[], startMs: number, endMs: number): CalendarEvent[] {
	return events.filter((e) => {
		const ms = new Date(e.start).getTime();
		return ms >= startMs && ms <= endMs;
	});
}

// ─── Rendering ───────────────────────────────────────────────

export function renderTimelineInto(
	container: HTMLElement,
	app: App,
	bundle: CalendarBundle,
	config: EventSeriesTimelineConfig
): TimelineHandle {
	let timeline: Timeline | null = null;
	let items: DataSet<DataItem> | null = null;
	const eventMap = new Map<string, CalendarEvent>();
	const colorEvaluator = new ColorEvaluator<SingleCalendarConfig>(bundle.settingsStore.settings$);
	const rangeTracker = new FetchedRangeTracker();
	let rangeChangeTimer: ReturnType<typeof setTimeout> | null = null;

	const header = container.createDiv(cls("timeline-modal-header"));
	header.createEl("h2", { text: config.title });

	const controls = container.createDiv(cls("timeline-nav-controls"));
	const dateGroup = controls.createDiv(cls("timeline-nav-date-group"));

	const createNumericInput = (placeholder: string, min: string, max: string): HTMLInputElement =>
		dateGroup.createEl("input", {
			type: "number",
			cls: cls("timeline-nav-input"),
			attr: { placeholder, min, max },
		});

	const yearInput = createNumericInput("Year", "1900", "2100");
	const monthInput = createNumericInput("Month", "1", "12");
	const dayInput = createNumericInput("Day", "1", "31");

	const now = new Date();
	yearInput.value = String(now.getFullYear());
	monthInput.value = String(now.getMonth() + 1);
	dayInput.value = String(now.getDate());

	const goBtn = controls.createEl("button", {
		text: "Go",
		cls: cls("timeline-nav-btn"),
	});

	const todayBtn = controls.createEl("button", {
		text: "Today",
		cls: cls("timeline-nav-btn"),
	});

	function navigateToInput(): void {
		if (!timeline) return;

		const year = parseInt(yearInput.value);
		const month = parseInt(monthInput.value) || 1;
		const day = parseInt(dayInput.value) || 1;

		if (isNaN(year)) return;

		const target = new Date(year, month - 1, day);
		if (isNaN(target.getTime())) return;

		timeline.moveTo(target);
	}

	function navigateToToday(): void {
		if (!timeline) return;

		const today = new Date();
		yearInput.value = String(today.getFullYear());
		monthInput.value = String(today.getMonth() + 1);
		dayInput.value = String(today.getDate());
		timeline.moveTo(today);
	}

	goBtn.addEventListener("click", navigateToInput);
	todayBtn.addEventListener("click", navigateToToday);

	const onEnter = (e: KeyboardEvent) => {
		if (e.key === "Enter") navigateToInput();
	};
	yearInput.addEventListener("keydown", onEnter);
	monthInput.addEventListener("keydown", onEnter);
	dayInput.addEventListener("keydown", onEnter);

	const timelineContainer = container.createDiv(cls("timeline-modal-container"));

	function openPreviewModal(event: CalendarEvent): void {
		const previewEvent: PreviewEventData = {
			title: event.title,
			start: new Date(event.start),
			end: event.type === "timed" && event.end ? new Date(event.end) : null,
			allDay: event.type === "allDay",
			extendedProps: { filePath: event.ref.filePath },
		};
		showEventPreviewModal(app, bundle, previewEvent);
	}

	let cachedTextColorRgb: RgbColor | null = null;
	let cachedTextColorSource: string | null = null;

	function resolveTextColor(eventColor: string | undefined, settings: SingleCalendarConfig): string | undefined {
		if (!eventColor) return undefined;
		if (cachedTextColorSource !== settings.eventTextColor) {
			cachedTextColorRgb = parseColorToRgb(settings.eventTextColor);
			cachedTextColorSource = settings.eventTextColor;
		}
		if (!cachedTextColorRgb) return settings.eventTextColor;
		return hasVeryCloseShadeFromRgb(cachedTextColorRgb, eventColor)
			? settings.eventTextColorAlt
			: settings.eventTextColor;
	}

	function toItem(event: CalendarEvent, settings: SingleCalendarConfig) {
		const startDate = new Date(event.start);
		const eventColor = resolveEventColor(event.meta, bundle, colorEvaluator);
		const textColor = resolveTextColor(eventColor, settings);
		const content = cleanupTitle(event.title);
		const tooltip = buildEventTooltip(event, settings);

		const classes: string[] = [];
		if (event.skipped) classes.push(cls("timeline-item-skipped"));
		classes.push(event.type === "allDay" ? cls("timeline-item-allday") : cls("timeline-item-timed"));

		const styleParts: string[] = [];
		if (eventColor) styleParts.push(`background-color: ${eventColor}; border-color: ${eventColor};`);
		if (textColor) styleParts.push(`color: ${textColor};`);

		const base = {
			id: event.ref.filePath,
			content,
			title: tooltip,
			start: startDate,
			className: classes.join(" "),
			style: styleParts.join(" "),
		};

		if (event.type === "timed" && event.end) {
			return { ...base, end: new Date(event.end), type: "range" as const };
		}

		if (event.type === "allDay") {
			const end = new Date(startDate);
			end.setHours(startDate.getHours() + ALL_DAY_DISPLAY_HOURS);
			return { ...base, end, type: "range" as const };
		}

		return { ...base, type: "point" as const };
	}

	// ─── Data Fetching ───────────────────────────────────────

	async function fetchEventsForRange(startMs: number, endMs: number): Promise<CalendarEvent[]> {
		if (config.events) {
			return filterEventsByRange(config.events, startMs, endMs);
		}
		return bundle.eventStore.getEvents({
			start: toLocalISOString(new Date(startMs)),
			end: toLocalISOString(new Date(endMs)),
		});
	}

	function mergeEvents(events: CalendarEvent[]): void {
		if (!timeline || !items) return;

		const settings = bundle.settingsStore.currentSettings;
		const toAdd: ReturnType<typeof toItem>[] = [];
		const toUpdate: ReturnType<typeof toItem>[] = [];

		for (const event of events) {
			const id = event.ref.filePath;
			const existing = eventMap.get(id);
			const item = toItem(event, settings);

			if (!existing) {
				toAdd.push(item);
			} else if (
				existing.start !== event.start ||
				existing.title !== event.title ||
				existing.skipped !== event.skipped
			) {
				toUpdate.push(item);
			}

			eventMap.set(id, event);
		}

		if (toAdd.length > 0) items.add(toAdd);
		if (toUpdate.length > 0) items.update(toUpdate);
	}

	async function fetchVisibleRange(): Promise<void> {
		if (!timeline || !items) return;

		const window = timeline.getWindow();
		const windowSpan = window.end.getTime() - window.start.getTime();
		const buffer = windowSpan * RANGE_BUFFER_FACTOR;
		const fetchStart = window.start.getTime() - buffer;
		const fetchEnd = window.end.getTime() + buffer;

		const uncovered = rangeTracker.getUncoveredRanges(fetchStart, fetchEnd);
		if (uncovered.length === 0) return;

		for (const range of uncovered) {
			const events = await fetchEventsForRange(range.start, range.end);
			mergeEvents(events);
			rangeTracker.addRange(range.start, range.end);
		}
	}

	function onRangeChanged(): void {
		if (rangeChangeTimer) clearTimeout(rangeChangeTimer);
		rangeChangeTimer = setTimeout(() => {
			rangeChangeTimer = null;
			void fetchVisibleRange();
		}, RANGE_CHANGE_DEBOUNCE_MS);
	}

	function invalidateAndRefetch(): void {
		rangeTracker.clear();
		eventMap.clear();
		if (items) {
			items.clear();
		}
		void fetchVisibleRange();
	}

	// ─── Timeline Init ───────────────────────────────────────

	function initTimeline(): void {
		items = new DataSet<DataItem>();

		const nowMs = Date.now();
		const halfWeek = 3.5 * 86400000;
		const fillContainer = config.fillContainer === true;

		const options: TimelineOptions = {
			editable: false,
			selectable: false,
			showCurrentTime: true,
			zoomable: true,
			moveable: true,
			height: "600px",
			margin: { item: 10 },
			orientation: "top",
			start: new Date(nowMs - halfWeek),
			end: new Date(nowMs + halfWeek),
			zoomMin: 86400000,
			zoomMax: 31536000000 * 10,
			stack: true,
			verticalScroll: true,
		};

		if (!fillContainer) options.maxHeight = "600px";

		timelineContainer.empty();
		timeline = new Timeline(timelineContainer, items, options);

		if (fillContainer) {
			requestAnimationFrame(() => {
				if (!timeline) return;
				const top = timelineContainer.getBoundingClientRect().top;
				const available = window.innerHeight - top - 16;
				if (available > 200) {
					timeline.setOptions({ height: `${available}px` });
				}
			});
		}

		type TimelineInteraction = { item?: string | null; event?: MouseEvent };
		timeline.on("click", (properties: TimelineInteraction) => {
			const itemId = properties.item;
			if (!itemId) return;
			const event = eventMap.get(itemId);
			if (event) openPreviewModal(event);
		});

		timeline.on("rangechanged", onRangeChanged);
	}

	// ─── Initialize ──────────────────────────────────────────

	initTimeline();
	void fetchVisibleRange();

	return {
		destroy: () => {
			if (rangeChangeTimer) {
				clearTimeout(rangeChangeTimer);
				rangeChangeTimer = null;
			}
			if (timeline) {
				timeline.destroy();
				timeline = null;
				items = null;
			}
			colorEvaluator.destroy();
			container.empty();
		},
		invalidateAndRefetch,
	};
}

export function showTimelineModal(app: App, bundle: CalendarBundle, config: EventSeriesTimelineConfig): void {
	let handle: TimelineHandle | null = null;
	showModal({
		app,
		cls: cls("timeline-modal"),
		render: (el) => {
			handle = renderTimelineInto(el, app, bundle, config);
		},
		cleanup: () => {
			handle?.destroy();
			handle = null;
		},
	});
}
