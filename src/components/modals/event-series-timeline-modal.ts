import { ColorEvaluator, cls } from "@real1ty-obsidian-plugins";
import { type App, Modal } from "obsidian";
import { DataSet } from "vis-data";
import { Timeline, type TimelineOptions } from "vis-timeline";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { cleanupTitle } from "../../utils/event-naming";
import { resolveEventColor } from "../../utils/event-color";
import { buildEventTooltip } from "../../utils/format";
import { EventPreviewModal, type PreviewEventData } from "../event-preview-modal";

export interface EventSeriesTimelineConfig {
	events: CalendarEvent[];
	title: string;
}

export class EventSeriesTimelineModal extends Modal {
	private timeline: Timeline | null = null;
	private timelineContainer!: HTMLElement;
	private eventMap: Map<string, CalendarEvent> = new Map();
	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private config: EventSeriesTimelineConfig
	) {
		super(app);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();

		// Add class to modal element (not content)
		modalEl.addClass(cls("timeline-modal"));

		// Header
		const header = contentEl.createDiv(cls("timeline-modal-header"));
		header.createEl("h2", { text: this.config.title });

		// Timeline container
		this.timelineContainer = contentEl.createDiv(cls("timeline-modal-container"));

		this.renderTimeline();
	}

	onClose(): void {
		if (this.timeline) {
			this.timeline.destroy();
			this.timeline = null;
		}
		this.colorEvaluator.destroy();
		this.contentEl.empty();
	}

	private renderTimeline(): void {
		// Destroy existing timeline
		if (this.timeline) {
			this.timeline.destroy();
			this.timeline = null;
		}

		const events = this.config.events;

		if (events.length === 0) {
			this.timelineContainer.empty();
			this.timelineContainer.createEl("p", {
				text: "No events to display",
				cls: cls("timeline-modal-empty"),
			});
			return;
		}

		this.eventMap.clear();
		for (const event of events) {
			this.eventMap.set(event.ref.filePath, event);
		}

		// Sort events to find date range
		const sortedEvents = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
		const firstEvent = new Date(sortedEvents[0].start);
		const lastEvent = new Date(sortedEvents[sortedEvents.length - 1].start);

		// Add padding to the date range (10% on each side)
		const timeSpan = lastEvent.getTime() - firstEvent.getTime();
		const padding = Math.max(timeSpan * 0.1, 86400000); // At least 1 day padding
		const rangeStart = new Date(firstEvent.getTime() - padding);
		const rangeEnd = new Date(lastEvent.getTime() + padding);

		const settings = this.bundle.settingsStore.currentSettings;

		const timelineItems = events.map((event) => {
			const startDate = new Date(event.start);
			const eventColor = resolveEventColor(event.meta, this.bundle, this.colorEvaluator);

			const content = cleanupTitle(event.title);
			const tooltip = buildEventTooltip(event, settings);

			// Build className list
			const classes: string[] = [];
			if (event.skipped) classes.push(cls("timeline-item-skipped"));
			classes.push(event.type === "allDay" ? cls("timeline-item-allday") : cls("timeline-item-timed"));

			// Per-item color via vis-timeline's style API
			const style = eventColor ? `background-color: ${eventColor}; border-color: ${eventColor};` : undefined;

			return {
				id: event.ref.filePath,
				content,
				title: tooltip,
				start: startDate,
				type: "point" as const,
				className: classes.join(" "),
				style,
			};
		});

		const items = new DataSet(timelineItems);

		// Timeline options with proper date range
		const options: TimelineOptions = {
			editable: false,
			selectable: false, // Disable selection highlighting
			showCurrentTime: true,
			zoomable: true,
			moveable: true,
			height: "600px",
			margin: {
				item: 10,
			},
			orientation: "top",
			start: rangeStart,
			end: rangeEnd,
			zoomMin: 86400000, // 1 day minimum zoom
			zoomMax: 31536000000 * 10, // 10 years maximum zoom
			stack: true,
			verticalScroll: true,
			maxHeight: "600px",
		};

		// Clear container first
		this.timelineContainer.empty();

		// Create timeline
		this.timeline = new Timeline(this.timelineContainer, items, options);

		this.setupInteractions();
	}

	private openPreviewModal(event: CalendarEvent): void {
		const previewEvent: PreviewEventData = {
			title: event.title,
			start: new Date(event.start),
			end: event.type === "timed" && event.end ? new Date(event.end) : null,
			allDay: event.type === "allDay",
			extendedProps: { filePath: event.ref.filePath },
		};
		new EventPreviewModal(this.app, this.bundle, previewEvent).open();
	}

	private setupInteractions(): void {
		const timeline = this.timeline;
		if (!timeline) return;

		type TimelineInteraction = {
			item?: string | null;
			event?: MouseEvent;
		};

		// Use vis-timeline's own events. It can stop native DOM bubbling,
		// so container.addEventListener('click') is unreliable.
		timeline.on("click", (properties: TimelineInteraction) => {
			const itemId = properties.item;
			if (!itemId) return;

			const event = this.eventMap.get(itemId);
			if (event) {
				this.openPreviewModal(event);
			}
		});
	}
}
