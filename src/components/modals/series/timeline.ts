import { cls, ColorEvaluator, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { DataSet } from "vis-data";
import { Timeline, type TimelineOptions } from "vis-timeline";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { resolveEventColor } from "../../../utils/event-color";
import { cleanupTitle } from "../../../utils/event-naming";
import { buildEventTooltip } from "../../../utils/format";
import { type PreviewEventData, showEventPreviewModal } from "../preview/event-preview";

export interface EventSeriesTimelineConfig {
	events: CalendarEvent[];
	title: string;
	fillContainer?: boolean;
}

export interface TimelineHandle {
	destroy: () => void;
	refresh: (events: CalendarEvent[]) => void;
}

/**
 * Renders a vis-timeline visualization into any container element.
 * Returns a handle for cleanup and refreshing with new events.
 */
export function renderTimelineInto(
	container: HTMLElement,
	app: App,
	bundle: CalendarBundle,
	config: EventSeriesTimelineConfig
): TimelineHandle {
	let timeline: Timeline | null = null;
	const eventMap = new Map<string, CalendarEvent>();
	const colorEvaluator = new ColorEvaluator<SingleCalendarConfig>(bundle.settingsStore.settings$);

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

	const shortcutHint = controls.createSpan(cls("timeline-nav-hint"));
	shortcutHint.textContent = "Enter to navigate";

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

	function toItem(event: CalendarEvent, settings: SingleCalendarConfig) {
		const startDate = new Date(event.start);
		const eventColor = resolveEventColor(event.meta, bundle, colorEvaluator);
		const content = cleanupTitle(event.title);
		const tooltip = buildEventTooltip(event, settings);

		const classes: string[] = [];
		if (event.skipped) classes.push(cls("timeline-item-skipped"));
		classes.push(event.type === "allDay" ? cls("timeline-item-allday") : cls("timeline-item-timed"));

		const style = eventColor ? `background-color: ${eventColor}; border-color: ${eventColor};` : "";

		return {
			id: event.ref.filePath,
			content,
			title: tooltip,
			start: startDate,
			type: "point" as const,
			className: classes.join(" "),
			style,
		};
	}

	function buildTimeline(events: CalendarEvent[]): void {
		if (timeline) {
			timeline.destroy();
			timeline = null;
		}

		if (events.length === 0) {
			timelineContainer.empty();
			timelineContainer.createEl("p", {
				text: "No events to display",
				cls: cls("timeline-modal-empty"),
			});
			return;
		}

		eventMap.clear();
		for (const event of events) {
			eventMap.set(event.ref.filePath, event);
		}

		const settings = bundle.settingsStore.currentSettings;

		const sortedEvents = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
		const firstEvent = new Date(sortedEvents[0].start);
		const lastEvent = new Date(sortedEvents[sortedEvents.length - 1].start);

		const timeSpan = lastEvent.getTime() - firstEvent.getTime();
		const rangePadding = Math.max(timeSpan * 0.1, 86400000);
		const rangeStart = new Date(firstEvent.getTime() - rangePadding);
		const rangeEnd = new Date(lastEvent.getTime() + rangePadding);

		const timelineItems = events.map((event) => toItem(event, settings));

		const items = new DataSet(timelineItems);

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
			min: rangeStart,
			max: rangeEnd,
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
	}

	buildTimeline(config.events);

	return {
		destroy: () => {
			if (timeline) {
				timeline.destroy();
				timeline = null;
			}
			colorEvaluator.destroy();
			container.empty();
		},
		refresh: (events: CalendarEvent[]) => {
			buildTimeline(events);
		},
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
