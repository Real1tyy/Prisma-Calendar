import { cls } from "@real1ty-obsidian-plugins";
import { type App, Modal } from "obsidian";
import { DataSet } from "vis-data";
import { Timeline, type TimelineOptions } from "vis-timeline";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import { removeZettelId } from "../../utils/calendar-events";
import { EventPreviewModal, type PreviewEventData } from "../event-preview-modal";

export interface EventSeriesTimelineConfig {
	events: CalendarEvent[];
	title: string;
}

export class EventSeriesTimelineModal extends Modal {
	private timeline: Timeline | null = null;
	private timelineContainer: HTMLElement | null = null;
	private items: DataSet<any> | null = null;
	private eventMap: Map<string, CalendarEvent> = new Map();

	constructor(
		app: App,
		private bundle: CalendarBundle,
		private config: EventSeriesTimelineConfig
	) {
		super(app);
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
		this.contentEl.empty();
	}

	private renderTimeline(): void {
		if (!this.timelineContainer) return;

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
		const sortedEvents = [...events].sort((a, b) => {
			return new Date(a.start).getTime() - new Date(b.start).getTime();
		});

		const firstEvent = new Date(sortedEvents[0].start);
		const lastEvent = new Date(sortedEvents[sortedEvents.length - 1].start);

		// Add padding to the date range (10% on each side)
		const timeSpan = lastEvent.getTime() - firstEvent.getTime();
		const padding = Math.max(timeSpan * 0.1, 86400000); // At least 1 day padding
		const rangeStart = new Date(firstEvent.getTime() - padding);
		const rangeEnd = new Date(lastEvent.getTime() + padding);

		// Convert events to timeline items - initially show all as points for better visibility
		const timelineItems = events.map((event) => {
			const startDate = new Date(event.start);

			return {
				id: event.ref.filePath,
				content: removeZettelId(event.title),
				start: startDate,
				type: "point" as const,
				// Store original event data for zoom handling
				_eventType: event.type,
				_eventEnd: event.type === "timed" && event.end ? new Date(event.end) : undefined,
			};
		});

		this.items = new DataSet(timelineItems);

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
		this.timeline = new Timeline(this.timelineContainer, this.items, options);

		// Handle zoom changes to switch between points and ranges
		this.timeline.on("rangechanged", () => {
			this.updateItemTypes();
		});

		this.setupInteractions();
	}

	private openPreviewModal(event: CalendarEvent): void {
		const previewEvent: PreviewEventData = {
			title: event.title,
			start: new Date(event.start),
			end: event.type === "timed" && event.end ? new Date(event.end) : null,
			allDay: event.type === "allDay",
			extendedProps: {
				filePath: event.ref.filePath,
			},
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

	private updateItemTypes(): void {
		if (!this.timeline || !this.items) return;

		const window = this.timeline.getWindow();
		const visibleTimeSpan = window.end.getTime() - window.start.getTime();

		// If viewing more than 30 days, show as points for better visibility
		// If viewing less than 30 days, show timed events as ranges for accuracy
		const showAsPoints = visibleTimeSpan > 30 * 86400000;

		const allItems = this.items.get();
		const updates = allItems
			.map((item: any) => {
				if (item._eventType === "timed" && item._eventEnd) {
					return {
						id: item.id,
						type: showAsPoints ? "point" : "range",
						end: showAsPoints ? undefined : item._eventEnd,
					};
				}
				return null;
			})
			.filter((update): update is any => update !== null);

		if (updates.length > 0) {
			this.items.update(updates);
		}
	}
}
