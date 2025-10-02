import { Calendar, type EventContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import { MountableView } from "@real1ty-obsidian-plugins/common-plugin";
import { formatDuration } from "@real1ty-obsidian-plugins/utils/date-utils";
import { colord } from "colord";
import { type App, ItemView, type WorkspaceLeaf } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { CreateEventCommand, type EventData, UpdateEventCommand } from "../core/commands";
import type { SingleCalendarConfig } from "../types/index";
import { ColorEvaluator } from "../utils/color-evaluator";
import { parseColor } from "../utils/color-parser";
import type { PropertyRendererConfig } from "../utils/property-renderer";
import { createDefaultSeparator, renderPropertyValue as renderProperty } from "../utils/property-renderer";
import { BatchSelectionManager } from "./batch-selection-manager";
import { EventContextMenu } from "./event-context-menu";
import { EventCreateModal } from "./event-edit-modal";
import { SkippedEventsModal } from "./skipped-events-modal";
import { ZoomManager } from "./zoom-manager";

const CALENDAR_VIEW_TYPE = "custom-calendar-view";

export function getCalendarViewType(calendarId: string): string {
	return `${CALENDAR_VIEW_TYPE}-${calendarId}`;
}

function emitHover(
	app: App,
	containerEl: HTMLElement,
	targetEl: HTMLElement,
	jsEvent: MouseEvent,
	linktext: string,
	calendarId: string,
	sourcePath?: string
) {
	app.workspace.trigger("hover-link", {
		event: jsEvent,
		source: getCalendarViewType(calendarId),
		hoverParent: containerEl,
		targetEl,
		linktext,
		sourcePath: sourcePath ?? app.workspace.getActiveFile()?.path ?? "",
	});
}

export class CalendarView extends MountableView(ItemView) {
	calendar: Calendar | null = null;
	private eventContextMenu: EventContextMenu;
	private colorEvaluator: ColorEvaluator;
	private batchSelectionManager: BatchSelectionManager | null = null;
	private zoomManager: ZoomManager;
	private container!: HTMLElement;
	private viewType: string;

	constructor(
		leaf: WorkspaceLeaf,
		private bundle: CalendarBundle
	) {
		super(leaf);
		this.viewType = getCalendarViewType(bundle.calendarId);
		this.eventContextMenu = new EventContextMenu(this.app, bundle);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
		this.zoomManager = new ZoomManager(bundle.settingsStore);
	}

	async undo(): Promise<boolean> {
		return await this.bundle.undo();
	}

	async redo(): Promise<boolean> {
		return await this.bundle.redo();
	}

	private updateToolbar(): void {
		if (!this.calendar || !this.batchSelectionManager) return;

		const bsm = this.batchSelectionManager;
		const inSelectionMode = bsm.isInSelectionMode();

		const headerToolbar: any = {
			left: "prev,next today zoomLevel",
			center: "title",
			right: "", // Will be constructed dynamically
		};

		const customButtons: Record<string, any> = {
			zoomLevel: this.zoomManager.createZoomLevelButton(),
		};

		const viewSwitchers = "dayGridMonth,timeGridWeek,timeGridDay,listWeek";

		if (inSelectionMode) {
			const batchButtons =
				"batchCounter batchSelectAll batchClear batchDuplicate batchCloneNext batchClonePrev batchMoveNext batchMovePrev batchOpenAll batchSkip batchDelete batchExit";
			headerToolbar.right = `${batchButtons} ${viewSwitchers}`;

			// Define all batch buttons
			customButtons.batchCounter = {
				text: bsm.getSelectionCountText(),
				className: "batch-action-btn batch-counter",
			};
			customButtons.batchSelectAll = {
				text: "Select All",
				click: () => bsm.selectAllVisibleEvents(),
				className: "batch-action-btn select-all-btn",
			};
			customButtons.batchClear = {
				text: "Clear",
				click: () => bsm.clearSelection(),
				className: "batch-action-btn clear-btn",
			};
			customButtons.batchDuplicate = {
				text: "Duplicate",
				click: () => bsm.executeDuplicate(),
				className: "batch-action-btn duplicate-btn",
			};
			customButtons.batchExit = {
				text: "Exit",
				click: () => this.toggleBatchSelection(),
				className: "batch-action-btn exit-btn",
			};
			customButtons.batchDelete = {
				text: "Delete",
				click: () => bsm.executeDelete(),
				className: "batch-action-btn delete-btn",
			};
			customButtons.batchCloneNext = {
				text: "Clone Next",
				click: () => bsm.executeClone(1),
				className: "batch-action-btn clone-next-btn",
			};
			customButtons.batchClonePrev = {
				text: "Clone Prev",
				click: () => bsm.executeClone(-1),
				className: "batch-action-btn clone-prev-btn",
			};
			customButtons.batchMoveNext = {
				text: "Move Next",
				click: () => bsm.executeMove(1),
				className: "batch-action-btn move-next-btn",
			};
			customButtons.batchMovePrev = {
				text: "Move Prev",
				click: () => bsm.executeMove(-1),
				className: "batch-action-btn move-prev-btn",
			};
			customButtons.batchOpenAll = {
				text: "Open All",
				click: () => bsm.executeOpenAll(),
				className: "batch-action-btn open-all-btn",
			};
			customButtons.batchSkip = {
				text: "Skip",
				click: () => bsm.executeSkip(),
				className: "batch-action-btn skip-btn",
			};
		} else {
			headerToolbar.right = `skippedEvents batchSelect ${viewSwitchers}`;
			customButtons.batchSelect = {
				text: "Batch Select",
				click: () => this.toggleBatchSelection(),
			};
			// Preserve button text from previous update (important for batch mode toggle)
			const currentButton = this.calendar.getOption("customButtons")?.skippedEvents;
			const currentText = currentButton?.text || "0 skipped";
			customButtons.skippedEvents = {
				text: currentText,
				click: () => this.showSkippedEventsModal(),
			};
		}

		this.calendar.setOption("headerToolbar", headerToolbar);
		this.calendar.setOption("customButtons", customButtons);

		// Preserve button visibility based on current text
		setTimeout(() => {
			const btn = this.container.querySelector(".fc-skippedEvents-button");
			if (btn instanceof HTMLElement) {
				const currentText = btn.textContent || "";
				const hasSkipped = !currentText.startsWith("0 ");
				btn.style.display = hasSkipped ? "inline-block" : "none";
			}
		}, 0);
	}

	getViewType(): string {
		return this.viewType;
	}

	getDisplayText(): string {
		return this.bundle.settingsStore.currentSettings.name;
	}

	getIcon(): string {
		return "calendar";
	}

	private updateSkippedEventsButton(count: number): void {
		if (!this.calendar) return;

		// Create NEW customButtons object so FullCalendar detects the change
		const oldButtons = this.calendar.getOption("customButtons") || {};
		const customButtons = {
			...oldButtons,
			skippedEvents: {
				text: `${count} skipped`,
				click: () => this.showSkippedEventsModal(),
			},
		};
		this.calendar.setOption("customButtons", customButtons);

		// Update button visibility and tooltip (re-query after customButtons update since DOM may be recreated)
		setTimeout(() => {
			const btn = this.container.querySelector(".fc-skippedEvents-button");
			if (btn instanceof HTMLElement) {
				btn.style.display = count > 0 ? "inline-block" : "none";
				btn.title = `${count} event${count === 1 ? "" : "s"} hidden from calendar`;
			}
		}, 0);
	}

	async showSkippedEventsModal(): Promise<void> {
		if (!this.calendar) return;

		const view = this.calendar.view;
		if (!view) return;

		const start = view.activeStart.toISOString();
		const end = view.activeEnd.toISOString();
		const skippedEvents = await this.bundle.eventStore.getSkippedEvents({ start, end });

		new SkippedEventsModal(this.app, this.bundle, skippedEvents).open();
	}

	private async initializeCalendar(container: HTMLElement): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;

		this.calendar = new Calendar(container, {
			plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],

			timeZone: settings.timezone === "system" ? "local" : settings.timezone,

			initialView: settings.defaultView,

			nowIndicator: settings.nowIndicator,

			eventTimeFormat: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			},

			slotLabelFormat: {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false,
			},

			headerToolbar: false, // Initially false, will be set by updateToolbar

			eventContent: (arg) => {
				return this.renderEventContent(arg);
			},

			customButtons: {}, // Initially empty, will be set by updateToolbar

			slotMinTime: `${String(settings.hourStart).padStart(2, "0")}:00:00`,
			slotMaxTime: `${String(settings.hourEnd).padStart(2, "0")}:00:00`,
			slotDuration: formatDuration(settings.slotDurationMinutes),
			snapDuration: formatDuration(settings.snapDurationMinutes),

			weekends: !settings.hideWeekends,
			firstDay: settings.firstDayOfWeek,

			// Event overlap settings
			eventOverlap: settings.eventOverlap,
			slotEventOverlap: settings.slotEventOverlap,
			eventMaxStack: settings.eventMaxStack,

			editable: true,
			eventStartEditable: true,
			eventDurationEditable: true,
			eventResizableFromStart: true,

			eventAllow: (_dropInfo, draggedEvent) => {
				return !draggedEvent?.extendedProps.isVirtual;
			},

			eventClick: (info) => {
				if (info.event.extendedProps.isVirtual) {
					return;
				}
				if (this.batchSelectionManager?.isInSelectionMode()) {
					this.batchSelectionManager.handleEventClick(info.event.id);
				} else {
					this.handleEventClick(info);
				}
			},

			eventDidMount: (info) => {
				if (info.event.extendedProps.isVirtual) {
					info.el.classList.add("virtual-event-opacity", "virtual-event-cursor");
					info.el.title = "Virtual recurring event (read-only)";
				} else {
					// Only register non-virtual events for batch selection
					this.batchSelectionManager?.handleEventMount(info.event.id, info.el);
				}
				this.handleEventMount(info);
			},

			eventMouseEnter: (info) => {
				if (info.event.extendedProps.isVirtual) {
					return;
				}

				info.el.addEventListener("contextmenu", (e) => {
					e.preventDefault();
					this.eventContextMenu.show(e, info);
				});

				const settings = this.bundle.settingsStore.currentSettings;
				const filePath = info.event.extendedProps.filePath as string | undefined;
				if (settings.enableEventPreview && filePath) {
					info.el.addEventListener("mouseenter", (e) => {
						emitHover(this.app, this.container, info.el, e, filePath, this.bundle.calendarId);
					});
				}
			},

			eventDrop: (info) => {
				this.handleEventDrop(info);
			},

			eventResize: (info) => {
				this.handleEventResize(info);
			},

			dateClick: (info) => {
				this.handleDateClick(info);
			},

			datesSet: () => {
				this.refreshEvents();
				// Update zoom button visibility when view changes
				setTimeout(() => this.zoomManager.updateZoomLevelButton(), 100);
				// Save current state when view or date changes
				setTimeout(() => this.saveCurrentState(), 200);
			},

			eventsSet: () => {
				this.batchSelectionManager?.refreshSelectionStyling();
			},

			height: "auto",
			aspectRatio: 1.35,
		});

		this.calendar.render();

		this.batchSelectionManager = new BatchSelectionManager(this.app, this.calendar, this.bundle);
		this.batchSelectionManager.setOnSelectionChangeCallback(() => this.updateToolbar());
		this.updateToolbar();

		this.zoomManager.initialize(this.calendar, this.container);
		this.zoomManager.setOnZoomChangeCallback(() => this.saveCurrentState());

		if (this.bundle.viewStateManager.hasState()) {
			this.isRestoring = true;

			const savedZoomLevel = this.bundle.viewStateManager.getSavedZoomLevel();
			if (savedZoomLevel) {
				this.zoomManager.setCurrentZoomLevel(savedZoomLevel);
			}

			this.bundle.viewStateManager.restoreState(this.calendar);

			// Allow state saving again after restoration is complete
			setTimeout(() => {
				this.isRestoring = false;
			}, 500);
		}

		setTimeout(() => {
			if (this.calendar) {
				this.calendar.updateSize();
			}
		}, 100);

		// Ensure initial events are loaded after calendar is fully rendered
		await this.refreshEvents();
	}

	private updateCalendarSettings(settings: SingleCalendarConfig): void {
		if (!this.calendar) return;

		this.calendar.setOption("timeZone", settings.timezone === "system" ? "local" : settings.timezone);
		this.calendar.setOption("slotMinTime", `${String(settings.hourStart).padStart(2, "0")}:00:00`);
		this.calendar.setOption("slotMaxTime", `${String(settings.hourEnd).padStart(2, "0")}:00:00`);

		this.calendar.setOption("slotDuration", formatDuration(settings.slotDurationMinutes));
		this.calendar.setOption("snapDuration", formatDuration(settings.snapDurationMinutes));

		this.zoomManager.updateZoomLevelButton();

		this.calendar.setOption("weekends", !settings.hideWeekends);
		this.calendar.setOption("firstDay", settings.firstDayOfWeek);
		this.calendar.setOption("nowIndicator", settings.nowIndicator);

		// Update event overlap settings
		this.calendar.setOption("eventOverlap", settings.eventOverlap);
		this.calendar.setOption("slotEventOverlap", settings.slotEventOverlap);
		this.calendar.setOption("eventMaxStack", settings.eventMaxStack);

		this.refreshEvents();
	}

	private async refreshEvents(): Promise<void> {
		if (!this.calendar) {
			return;
		}

		try {
			const view = this.calendar.view;
			if (!view) {
				return;
			}

			const start = view.activeStart.toISOString();
			const end = view.activeEnd.toISOString();

			const events = await this.bundle.eventStore.getNonSkippedEvents({ start, end });

			const skippedEvents = await this.bundle.eventStore.getSkippedEvents({ start, end });
			this.updateSkippedEventsButton(skippedEvents.length);

			// Convert to FullCalendar event format
			const calendarEvents = events.map((event) => {
				const classNames = ["regular-event"];
				if (event.isVirtual) {
					classNames.push("virtual-event");
				}
				const eventColor = this.getEventColor(event);

				return {
					id: event.id,
					title: event.title, // Keep original title for search/filtering
					start: event.start,
					end: event.end,
					allDay: event.allDay,
					extendedProps: {
						filePath: event.ref.filePath,
						folder: event.meta?.folder || "",
						originalTitle: event.title,
						frontmatterDisplayData: event.meta || {},
						isVirtual: event.isVirtual,
					},
					backgroundColor: eventColor,
					borderColor: eventColor,
					className: classNames.join(" "),
				};
			});

			// CRITICAL: Remove ALL events and event sources to prevent accumulation
			this.calendar.removeAllEvents();
			this.calendar.removeAllEventSources();

			// Add fresh event source with new events
			this.calendar.addEventSource({
				id: "main-events",
				events: calendarEvents,
			});
		} catch (error) {
			console.error("Error refreshing calendar events:", error);
		}
	}

	private renderEventContent(arg: EventContentArg): any {
		const settings = this.bundle.settingsStore.currentSettings;
		const event = arg.event;

		const mainEl = document.createElement("div");
		mainEl.className = "fc-event-main";

		const container = document.createElement("div");
		container.className = "fc-event-content-wrapper";
		mainEl.appendChild(container);

		const headerEl = document.createElement("div");
		headerEl.className = "fc-event-header";

		if (!event.allDay && event.start) {
			const timeEl = document.createElement("div");
			timeEl.className = "fc-event-time";
			timeEl.textContent = arg.timeText;
			headerEl.appendChild(timeEl);
		}

		// Add title
		const titleEl = document.createElement("div");
		titleEl.className = "fc-event-title-custom";
		let title = event.title;
		// Remove ZettelID from title if it exists
		if (title) {
			title = title.replace(/-\d{14}$/, "");
		}
		titleEl.textContent = title;
		headerEl.appendChild(titleEl);

		container.appendChild(headerEl);

		if (settings.frontmatterDisplayProperties.length > 0 && event.extendedProps.frontmatterDisplayData) {
			const propsContainer = document.createElement("div");
			propsContainer.className = "fc-event-props";

			for (const prop of settings.frontmatterDisplayProperties) {
				const value = event.extendedProps.frontmatterDisplayData[prop];
				if (value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0)) {
					const propEl = document.createElement("div");
					propEl.className = "fc-event-prop";

					const keyEl = document.createElement("span");
					keyEl.className = "fc-event-prop-key";
					keyEl.textContent = `${prop}:`;
					propEl.appendChild(keyEl);

					const valueEl = document.createElement("span");
					valueEl.className = "fc-event-prop-value";
					this.renderPropertyValue(valueEl, value);
					propEl.appendChild(valueEl);

					propsContainer.appendChild(propEl);
				}
			}

			if (propsContainer.children.length > 0) {
				container.appendChild(propsContainer);
			}
		}

		return { domNodes: [mainEl] };
	}

	private renderPropertyValue(container: HTMLElement, value: any): void {
		const config: PropertyRendererConfig = {
			createLink: (text: string, path: string) => {
				const link = document.createElement("a");
				link.className = "fc-event-prop-link";
				link.textContent = text;
				link.onclick = (e) => {
					e.preventDefault();
					e.stopPropagation(); // Prevent event card click
					this.app.workspace.openLinkText(path, "", false);
				};
				return link;
			},
			createText: (text: string) => {
				// For calendar events, add space prefix for non-empty values
				const isFirstChild = container.childNodes.length === 0;
				const prefixedText = isFirstChild && text.trim() ? ` ${text}` : text;
				return document.createTextNode(prefixedText);
			},
			createSeparator: createDefaultSeparator,
		};

		renderProperty(container, value, config);
	}

	private getEventColor(event: any): string {
		const frontmatter = event.meta || {};
		return this.colorEvaluator.evaluateColor(frontmatter);
	}

	private handleEventClick(info: any): void {
		const filePath = info.event.extendedProps.filePath;

		if (filePath) {
			// Open the file in Obsidian
			this.app.workspace.openLinkText(filePath, "", false);
		}
	}

	private handleEventMount(info: any): void {
		if (info.event.extendedProps.isVirtual) {
			info.el.classList.add("virtual-event-italic");
		}
		// Add custom classes or tooltips here if needed
		const element = info.el;
		const event = info.event;

		// Ensure the event color is properly applied
		let eventColor = this.getEventColor({
			title: event.title,
			meta: event.extendedProps.frontmatterDisplayData,
		});

		const settings = this.bundle.settingsStore.currentSettings;
		if (info.isPast) {
			const contrast = settings.pastEventContrast;
			if (contrast === 0) {
				element.classList.add("element-hidden");
				return;
			}

			if (contrast < 100) {
				const hsl = parseColor(eventColor);
				if (hsl) {
					hsl.s = Math.round(hsl.s * (contrast / 100));
					hsl.l = Math.round(hsl.l * (contrast / 100) + (100 - contrast));
					eventColor = colord(hsl).toHslString();
				}
			}
		}

		element.style.setProperty("--event-color", eventColor);
		element.classList.add("custom-calendar-event");

		// Add tooltip with file path and frontmatter display data
		const tooltipParts = [`File: ${event.extendedProps.filePath}`];

		// Add frontmatter display properties to tooltip
		const tooltipSettings = this.bundle.settingsStore.currentSettings;
		if (tooltipSettings.frontmatterDisplayProperties.length > 0 && event.extendedProps.frontmatterDisplayData) {
			const displayData = event.extendedProps.frontmatterDisplayData;
			for (const prop of tooltipSettings.frontmatterDisplayProperties) {
				const value = displayData[prop];
				if (value !== undefined && value !== null && value !== "") {
					tooltipParts.push(`${prop}: ${value}`);
				}
			}
		}

		element.setAttribute("title", tooltipParts.join("\n"));

		// Add custom CSS classes
		element.addClass("custom-calendar-event");
	}

	private handleDateClick(info: any): void {
		// Create a new event with pre-filled date/time
		const clickedDate = info.date;
		const isAllDay = info.allDay;

		// Create a mock event object for the modal
		const newEvent: any = {
			title: "",
			start: clickedDate.toISOString(),
			allDay: isAllDay,
			extendedProps: {
				filePath: null, // Will be created
			},
		};

		// Only add end time for timed events (not all-day events)
		if (!isAllDay) {
			const endDate = new Date(clickedDate);
			endDate.setHours(endDate.getHours() + 1);
			newEvent.end = endDate.toISOString();
		}

		new EventCreateModal(this.app, this.bundle, newEvent, (eventData) => {
			this.createNewEvent(eventData, clickedDate);
		}).open();
	}

	private async createNewEvent(eventData: any, clickedDate: Date): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		try {
			const commandEventData: EventData = {
				filePath: null,
				title: eventData.title || `Event ${clickedDate.toISOString().split("T")[0]}`,
				start: eventData.start,
				end: eventData.end,
				allDay: eventData.allDay,
			};

			const command = new CreateEventCommand(this.app, this.bundle, commandEventData, settings.directory, clickedDate);

			await this.bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error("Error creating new event:", error);
		}
	}

	private async handleEventDrop(info: any): Promise<void> {
		if (info.event.extendedProps.isVirtual) {
			info.revert();
			return;
		}
		const filePath = info.event.extendedProps.filePath;

		if (!filePath) {
			console.error("No file path found for event");
			info.revert();
			return;
		}

		try {
			const command = new UpdateEventCommand(
				this.app,
				this.bundle,
				filePath,
				info.event.start.toISOString(),
				info.event.end?.toISOString(),
				info.event.allDay || false,
				info.oldEvent.start.toISOString(),
				info.oldEvent.end?.toISOString(),
				info.oldEvent.allDay || false
			);

			await this.bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error("Error updating event dates:", error);
			info.revert();
		}
	}

	private async handleEventResize(info: any): Promise<void> {
		if (info.event.extendedProps.isVirtual) {
			info.revert();
			return;
		}
		const filePath = info.event.extendedProps.filePath;

		if (!filePath) {
			console.error("No file path found for event");
			info.revert();
			return;
		}

		try {
			const command = new UpdateEventCommand(
				this.app,
				this.bundle,
				filePath,
				info.event.start.toISOString(),
				info.event.end?.toISOString(),
				info.event.allDay || false,
				info.oldEvent.start.toISOString(),
				info.oldEvent.end?.toISOString(),
				info.oldEvent.allDay || false
			);

			await this.bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error("Error updating event duration:", error);
			info.revert();
		}
	}

	async mount(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass(getCalendarViewType(this.bundle.calendarId));

		this.showLoading(root, "Loading calendar events…");

		// Create calendar host
		this.container = root.createDiv("custom-calendar-container");

		// Wait for layout before rendering FullCalendar
		await this.waitForLayout(this.container);
		await this.initializeCalendar(this.container);

		// Resize updates
		this.observeResize(this.container, () => this.calendar?.updateSize());

		// Settings subscription
		const settingsSubscription = this.bundle.settingsStore.settings$.subscribe((settings: SingleCalendarConfig) => {
			this.updateCalendarSettings(settings);
		});
		this.addSub(settingsSubscription);

		// Event store updates
		const eventStoreSubscription = this.bundle.eventStore.subscribe(() => this.refreshEvents());
		this.addSub(eventStoreSubscription);

		const recurringEventManagerSubscription = this.bundle.recurringEventManager.subscribe(() => this.refreshEvents());
		this.addSub(recurringEventManagerSubscription);

		this.hideLoading();
	}

	toggleBatchSelection(): void {
		this.batchSelectionManager?.toggleSelectionMode();
	}

	isInBatchSelectionMode(): boolean {
		return this.batchSelectionManager?.isInSelectionMode() ?? false;
	}

	selectAll(): void {
		this.batchSelectionManager?.selectAllVisibleEvents();
	}

	clearSelection(): void {
		this.batchSelectionManager?.clearSelection();
	}

	skipSelection(): void {
		this.batchSelectionManager?.executeSkip();
	}

	duplicateSelection(): void {
		this.batchSelectionManager?.executeDuplicate();
	}

	cloneSelection(weeks: number): void {
		this.batchSelectionManager?.executeClone(weeks);
	}

	moveSelection(weeks: number): void {
		this.batchSelectionManager?.executeMove(weeks);
	}

	deleteSelection(): void {
		this.batchSelectionManager?.executeDelete();
	}

	openSelection(): void {
		this.batchSelectionManager?.executeOpenAll();
	}

	private isRestoring = false;

	private saveCurrentState(): void {
		if (!this.calendar || this.isRestoring) return;

		const currentZoomLevel = this.zoomManager.getCurrentZoomLevel();
		this.bundle.viewStateManager.saveState(this.calendar, currentZoomLevel);
	}

	async unmount(): Promise<void> {
		this.saveCurrentState();

		this.zoomManager.destroy();

		this.calendar?.destroy();
		this.calendar = null;

		this.colorEvaluator.destroy();
		this.batchSelectionManager = null;
	}
}
