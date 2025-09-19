import { Calendar, type EventContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import { MountableView } from "@real1ty-obsidian-plugins/common-plugin";
import { formatDuration } from "@real1ty-obsidian-plugins/utils/date-utils";
import { sanitizeForFilename } from "@real1ty-obsidian-plugins/utils/file-utils";
import { generateZettelId } from "@real1ty-obsidian-plugins/utils/generate";
import { type App, ItemView, TFile, type WorkspaceLeaf } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import type { SingleCalendarConfig } from "../types/index";
import { ColorEvaluator } from "../utils/color-evaluator";
import { BatchSelectionManager } from "./batch-selection-manager";
import { EventContextMenu } from "./event-context-menu";
import { EventCreateModal } from "./event-edit-modal";
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
				"batchCounter batchSelectAll batchClear batchDuplicate batchCloneNext batchClonePrev batchMoveNext batchMovePrev batchOpenAll batchDelete batchExit";
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
		} else {
			headerToolbar.right = `batchSelect ${viewSwitchers}`;
			customButtons.batchSelect = {
				text: "Batch Select",
				click: () => this.toggleBatchSelection(),
			};
		}

		this.calendar.setOption("headerToolbar", headerToolbar);
		this.calendar.setOption("customButtons", customButtons);
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

	private async initializeCalendar(container: HTMLElement): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;

		this.calendar = new Calendar(container, {
			plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],

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
					info.el.style.opacity = "0.6";
					info.el.style.cursor = "default";
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

			height: "auto",
			aspectRatio: 1.35,
		});

		this.calendar.render();

		this.batchSelectionManager = new BatchSelectionManager(this.app, this.calendar);
		this.batchSelectionManager.setEventContextMenu(this.eventContextMenu);
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

	private updateCalendarSettings(settings: any): void {
		if (!this.calendar) return;

		this.calendar.setOption("slotMinTime", `${String(settings.hourStart).padStart(2, "0")}:00:00`);
		this.calendar.setOption("slotMaxTime", `${String(settings.hourEnd).padStart(2, "0")}:00:00`);

		this.calendar.setOption("slotDuration", formatDuration(settings.slotDurationMinutes));
		this.calendar.setOption("snapDuration", formatDuration(settings.snapDurationMinutes));

		this.zoomManager.updateZoomLevelButton();

		this.calendar.setOption("weekends", !settings.hideWeekends);
		this.calendar.setOption("firstDay", settings.firstDayOfWeek);
		this.calendar.setOption("nowIndicator", settings.nowIndicator);

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

			const events = await this.bundle.eventStore.getEvents({ start, end });

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

			// Force complete calendar refresh to ensure colors update
			this.calendar.removeAllEvents();

			// Add events with a timestamp to force refresh
			this.calendar.addEventSource({
				id: `events-${Date.now()}`,
				events: calendarEvents,
			});

			// Force complete re-render after a brief delay
			setTimeout(() => {
				if (this.calendar) {
					this.calendar.render();
				}
				this.batchSelectionManager?.refreshSelectionStyling();
			}, 50);
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

		if (
			settings.frontmatterDisplayProperties.length > 0 &&
			event.extendedProps.frontmatterDisplayData
		) {
			const propsContainer = document.createElement("div");
			propsContainer.className = "fc-event-props";

			for (const prop of settings.frontmatterDisplayProperties) {
				const value = event.extendedProps.frontmatterDisplayData[prop];
				if (
					value !== undefined &&
					value !== null &&
					value !== "" &&
					(!Array.isArray(value) || value.length > 0)
				) {
					const propEl = document.createElement("div");
					propEl.className = "fc-event-prop";

					// Format as "key: value"
					const keyEl = document.createElement("span");
					keyEl.className = "fc-event-prop-key";
					keyEl.textContent = `${prop}:`;
					propEl.appendChild(keyEl);

					const valueEl = document.createElement("span");
					valueEl.className = "fc-event-prop-value";
					valueEl.textContent = ` ${String(value)}`;
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
			info.el.style.opacity = "0.7";
			info.el.style.fontStyle = "italic";
		}
		// Add custom classes or tooltips here if needed
		const element = info.el;
		const event = info.event;

		// Ensure the event color is properly applied
		const eventColor = this.getEventColor({
			title: event.title,
			meta: event.extendedProps.frontmatterDisplayData,
		});
		element.style.backgroundColor = eventColor;
		element.style.borderColor = eventColor;

		// Add tooltip with file path and frontmatter display data
		const tooltipParts = [`File: ${event.extendedProps.filePath}`];

		// Add frontmatter display properties to tooltip
		const settings = this.bundle.settingsStore.currentSettings;
		if (
			settings.frontmatterDisplayProperties.length > 0 &&
			event.extendedProps.frontmatterDisplayData
		) {
			const displayData = event.extendedProps.frontmatterDisplayData;
			for (const prop of settings.frontmatterDisplayProperties) {
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
			// Generate a filename based on the title or date
			const title = eventData.title || `Event ${clickedDate.toISOString().split("T")[0]}`;
			const sanitizedTitle = sanitizeForFilename(title);

			const zettelId = generateZettelId();
			const filenameWithZettel = `${sanitizedTitle}-${zettelId}`;

			const file = await this.bundle.templateService.createFile({
				title,
				targetDirectory: settings.directory,
				filename: filenameWithZettel,
			});

			await this.setEventFrontmatter(file, eventData, settings, zettelId);
		} catch (error) {
			console.error("Error creating new event:", error);
		}
	}

	private async setEventFrontmatter(
		file: TFile,
		eventData: any,
		settings: SingleCalendarConfig,
		zettelId: number
	): Promise<void> {
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			if (eventData.title) {
				fm.title = eventData.title;
			}

			fm[settings.startProp] = eventData.start;

			if (eventData.end) {
				fm[settings.endProp] = eventData.end;
			}

			if (eventData.allDay && settings.allDayProp) {
				fm[settings.allDayProp] = eventData.allDay;
			}

			if (settings.zettelIdProp && zettelId) {
				fm[settings.zettelIdProp] = zettelId;
			}
		});
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
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				console.error("File not found:", filePath);
				info.revert();
				return;
			}

			const settings = this.bundle.settingsStore.currentSettings;

			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				// Update start time
				frontmatter[settings.startProp] = info.event.start.toISOString();

				// Update end time if it exists
				if (info.event.end && settings.endProp) {
					frontmatter[settings.endProp] = info.event.end.toISOString();
				}
			});
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
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				console.error("File not found:", filePath);
				info.revert();
				return;
			}

			const settings = this.bundle.settingsStore.currentSettings;

			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				// Update start time (in case it changed during resize)
				frontmatter[settings.startProp] = info.event.start.toISOString();

				// Update end time
				if (info.event.end && settings.endProp) {
					frontmatter[settings.endProp] = info.event.end.toISOString();
				}
			});
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
		const settingsSubscription = this.bundle.settingsStore.settings$.subscribe(
			(settings: SingleCalendarConfig) => {
				this.updateCalendarSettings(settings);
			}
		);
		this.addSub(settingsSubscription);

		// Event store updates
		const eventStoreSubscription = this.bundle.eventStore.subscribe(() => this.refreshEvents());
		this.addSub(eventStoreSubscription);

		this.hideLoading();
	}

	toggleBatchSelection(): void {
		this.batchSelectionManager?.toggleSelectionMode();
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
