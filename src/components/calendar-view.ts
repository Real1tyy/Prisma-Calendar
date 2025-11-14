import { Calendar, type EventContentArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import { MountableView } from "@real1ty-obsidian-plugins/common-plugin";
import { formatDuration } from "@real1ty-obsidian-plugins/utils/date-utils";
import { ItemView, type Modal, TFile, type WorkspaceLeaf } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { CreateEventCommand, type EventData, UpdateEventCommand } from "../core/commands";
import type { SingleCalendarConfig } from "../types/index";
import { removeZettelId } from "../utils/calendar-events";
import { ColorEvaluator } from "../utils/colors";
import { roundToNearestHour, toLocalISOString } from "../utils/format";
import { emitHover } from "../utils/obsidian";
import type { PropertyRendererConfig } from "../utils/property-renderer";
import { createDefaultSeparator, renderPropertyValue } from "../utils/property-renderer";
import { isNotEmpty } from "../utils/value-checks";
import { BatchSelectionManager } from "./batch-selection-manager";
import { EventContextMenu } from "./event-context-menu";
import { EventCreateModal } from "./event-edit-modal";
import { EventPreviewModal } from "./event-preview-modal";
import { ExpressionFilterManager } from "./expression-filter-manager";
import { FilterPresetSelector } from "./filter-preset-selector";
import {
	DisabledRecurringEventsModal,
	FilteredEventsModal,
	GlobalSearchModal,
	SkippedEventsModal,
} from "./list-modals";
import { SearchFilterManager } from "./search-filter-manager";
import { AllTimeStatsModal, MonthlyStatsModal, WeeklyStatsModal } from "./weekly-stats";
import { ZoomManager } from "./zoom-manager";

const CALENDAR_VIEW_TYPE = "custom-calendar-view";

export function getCalendarViewType(calendarId: string): string {
	return `${CALENDAR_VIEW_TYPE}-${calendarId}`;
}

export class CalendarView extends MountableView(ItemView) {
	calendar: Calendar | null = null;
	private eventContextMenu: EventContextMenu;
	private colorEvaluator: ColorEvaluator;
	private batchSelectionManager: BatchSelectionManager | null = null;
	private zoomManager: ZoomManager;
	private searchFilter: SearchFilterManager;
	private expressionFilter: ExpressionFilterManager;
	private filterPresetSelector: FilterPresetSelector;
	private container!: HTMLElement;
	private viewType: string;
	private skippedEventsModal: SkippedEventsModal | null = null;
	private disabledRecurringEventsModal: DisabledRecurringEventsModal | null = null;
	private filteredEventsModal: FilteredEventsModal | null = null;
	private globalSearchModal: GlobalSearchModal | null = null;
	private weeklyStatsModal: WeeklyStatsModal | null = null;
	private monthlyStatsModal: MonthlyStatsModal | null = null;
	private alltimeStatsModal: AllTimeStatsModal | null = null;
	private filteredEvents: Array<{ filePath: string; title: string; start: string; end?: string; allDay: boolean }> = [];
	private isIndexingComplete = false;
	private currentUpcomingEventIds: Set<string> = new Set();
	private upcomingEventCheckInterval: number | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private bundle: CalendarBundle
	) {
		super(leaf);
		this.viewType = getCalendarViewType(bundle.calendarId);
		this.eventContextMenu = new EventContextMenu(this.app, bundle);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
		this.zoomManager = new ZoomManager(bundle.settingsStore);
		this.searchFilter = new SearchFilterManager(() => this.refreshEvents());
		this.expressionFilter = new ExpressionFilterManager(() => this.refreshEvents());
		this.filterPresetSelector = new FilterPresetSelector(
			bundle.settingsStore.currentSettings.filterPresets,
			(expression: string) => {
				this.expressionFilter.setFilterValue(expression);
			}
		);
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

		const leftButtons = inSelectionMode ? "prev,next today" : "prev,next today createEvent zoomLevel";

		const headerToolbar: any = {
			left: leftButtons,
			center: "title",
			right: "", // Will be constructed dynamically
		};

		const customButtons: Record<string, any> = {};

		if (!inSelectionMode) {
			customButtons.createEvent = {
				text: "Create Event",
				click: () => this.createEventAtCurrentTime(),
			};
			customButtons.zoomLevel = this.zoomManager.createZoomLevelButton();
		}

		const viewSwitchers = "dayGridMonth,timeGridWeek,timeGridDay,listWeek";

		if (inSelectionMode) {
			const batchButtons =
				"batchCounter batchSelectAll batchClear batchDuplicate batchMoveBy batchCloneNext batchClonePrev batchMoveNext batchMovePrev batchOpenAll batchSkip batchDelete batchExit";
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
			customButtons.batchMoveBy = {
				text: "Move By",
				click: () => bsm.executeMoveBy(),
				className: "batch-action-btn move-by-btn",
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
			headerToolbar.right = `filteredEvents disabledRecurringEvents skippedEvents batchSelect ${viewSwitchers}`;
			customButtons.batchSelect = {
				text: "Batch Select",
				click: () => this.toggleBatchSelection(),
			};
			// Preserve button text from previous update (important for batch mode toggle)
			const currentFilteredButton = this.calendar.getOption("customButtons")?.filteredEvents;
			const currentFilteredText = currentFilteredButton?.text || "0 filtered";
			customButtons.filteredEvents = {
				text: currentFilteredText,
				click: () => this.showFilteredEventsModal(),
			};

			const currentSkippedButton = this.calendar.getOption("customButtons")?.skippedEvents;
			const currentSkippedText = currentSkippedButton?.text || "0 skipped";
			customButtons.skippedEvents = {
				text: currentSkippedText,
				click: () => this.showSkippedEventsModal(),
			};

			const currentDisabledButton = this.calendar.getOption("customButtons")?.disabledRecurringEvents;
			const currentDisabledText = currentDisabledButton?.text || "0 disabled";
			customButtons.disabledRecurringEvents = {
				text: currentDisabledText,
				click: () => this.showDisabledRecurringEventsModal(),
			};
		}

		this.calendar.setOption("headerToolbar", headerToolbar);
		this.calendar.setOption("customButtons", customButtons);

		// Preserve button visibility based on current text
		setTimeout(() => {
			const filteredBtn = this.container.querySelector(".fc-filteredEvents-button");
			if (filteredBtn instanceof HTMLElement) {
				const currentText = filteredBtn.textContent || "";
				const hasFiltered = !currentText.startsWith("0 ");
				filteredBtn.style.display = hasFiltered ? "inline-block" : "none";
			}

			const skippedBtn = this.container.querySelector(".fc-skippedEvents-button");
			if (skippedBtn instanceof HTMLElement) {
				const currentText = skippedBtn.textContent || "";
				const hasSkipped = !currentText.startsWith("0 ");
				skippedBtn.style.display = hasSkipped ? "inline-block" : "none";
			}

			const disabledBtn = this.container.querySelector(".fc-disabledRecurringEvents-button");
			if (disabledBtn instanceof HTMLElement) {
				const currentText = disabledBtn.textContent || "";
				const hasDisabled = !currentText.startsWith("0 ");
				disabledBtn.style.display = hasDisabled ? "inline-block" : "none";
			}

			// Update zoom button text after toolbar is rendered
			if (!inSelectionMode) {
				this.zoomManager.updateZoomLevelButton();
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

	private updateDisabledRecurringEventsButton(): void {
		if (!this.calendar) return;

		const disabledEvents = this.bundle.recurringEventManager.getDisabledRecurringEvents();
		const count = disabledEvents.length;

		// Create NEW customButtons object so FullCalendar detects the change
		const oldButtons = this.calendar.getOption("customButtons") || {};
		const customButtons = {
			...oldButtons,
			disabledRecurringEvents: {
				text: `${count} disabled`,
				click: () => this.showDisabledRecurringEventsModal(),
			},
		};
		this.calendar.setOption("customButtons", customButtons);

		// Update button visibility and tooltip (re-query after customButtons update since DOM may be recreated)
		setTimeout(() => {
			const btn = this.container.querySelector(".fc-disabledRecurringEvents-button");
			if (btn instanceof HTMLElement) {
				btn.style.display = count > 0 ? "inline-block" : "none";
				btn.title = `${count} recurring event${count === 1 ? "" : "s"} disabled`;
			}
		}, 0);
	}

	private updateFilteredEventsButton(count: number): void {
		if (!this.calendar) return;

		// Create NEW customButtons object so FullCalendar detects the change
		const oldButtons = this.calendar.getOption("customButtons") || {};
		const customButtons = {
			...oldButtons,
			filteredEvents: {
				text: `${count} filtered`,
				click: () => this.showFilteredEventsModal(),
			},
		};
		this.calendar.setOption("customButtons", customButtons);

		// Update button visibility and tooltip (re-query after customButtons update since DOM may be recreated)
		setTimeout(() => {
			const btn = this.container.querySelector(".fc-filteredEvents-button");
			if (btn instanceof HTMLElement) {
				btn.style.display = count > 0 ? "inline-block" : "none";
				btn.title = `${count} event${count === 1 ? "" : "s"} filtered out by search or expression filters`;
			}
		}, 0);
	}

	private async toggleModal<T extends Modal>(
		getCurrentModal: () => T | null,
		setModal: (modal: T | null) => void,
		modalFactory: () => Promise<T> | T
	): Promise<void> {
		const currentModal = getCurrentModal();

		if (currentModal) {
			setModal(null);
			currentModal.close();
			return;
		}

		const modal = await modalFactory();
		setModal(modal);

		const originalOnClose = modal.onClose.bind(modal);
		modal.onClose = () => {
			originalOnClose();
			setModal(null);
		};

		modal.open();
	}

	async showSkippedEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.skippedEventsModal,
			(modal) => {
				this.skippedEventsModal = modal;
			},
			async () => {
				if (!this.calendar) throw new Error("Calendar not initialized");

				const view = this.calendar.view;
				if (!view) throw new Error("Calendar view not available");

				const start = view.activeStart.toISOString();
				const end = view.activeEnd.toISOString();
				const skippedEvents = await this.bundle.eventStore.getSkippedEvents({ start, end });

				return new SkippedEventsModal(this.app, this.bundle, skippedEvents);
			}
		);
	}

	async showDisabledRecurringEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.disabledRecurringEventsModal,
			(modal) => {
				this.disabledRecurringEventsModal = modal;
				// Refresh the button count when modal closes
				if (!modal) {
					this.updateDisabledRecurringEventsButton();
				}
			},
			() => {
				const disabledEvents = this.bundle.recurringEventManager.getDisabledRecurringEvents();
				return new DisabledRecurringEventsModal(this.app, this.bundle, disabledEvents);
			}
		);
	}

	async showFilteredEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.filteredEventsModal,
			(modal) => {
				this.filteredEventsModal = modal;
			},
			() => new FilteredEventsModal(this.app, this.filteredEvents)
		);
	}

	async showGlobalSearchModal(): Promise<void> {
		await this.toggleModal(
			() => this.globalSearchModal,
			(modal) => {
				this.globalSearchModal = modal;
			},
			() => new GlobalSearchModal(this.app, this.bundle, this)
		);
	}

	async showWeeklyStatsModal(): Promise<void> {
		await this.toggleModal(
			() => this.weeklyStatsModal,
			(modal) => {
				this.weeklyStatsModal = modal;
			},
			() => {
				const currentDate = this.calendar?.getDate() || new Date();
				return new WeeklyStatsModal(this.app, this.bundle, currentDate);
			}
		);
	}

	async showMonthlyStatsModal(): Promise<void> {
		await this.toggleModal(
			() => this.monthlyStatsModal,
			(modal) => {
				this.monthlyStatsModal = modal;
			},
			() => {
				const currentDate = this.calendar?.getDate() || new Date();
				return new MonthlyStatsModal(this.app, this.bundle, currentDate);
			}
		);
	}

	async showAllTimeStatsModal(): Promise<void> {
		await this.toggleModal(
			() => this.alltimeStatsModal,
			(modal) => {
				this.alltimeStatsModal = modal;
			},
			() => {
				return new AllTimeStatsModal(this.app, this.bundle);
			}
		);
	}

	navigateToDate(date: Date, viewType?: string): void {
		if (!this.calendar) return;

		if (viewType) {
			this.calendar.changeView(viewType);
		}

		this.calendar.gotoDate(date);
	}

	highlightEventByPath(filePath: string, durationMs = 5000): void {
		if (!this.calendar) return;

		// Find all events with matching file path
		const events = this.calendar.getEvents();
		const matchingEvents = events.filter((event) => event.extendedProps?.filePath === filePath);

		for (const event of matchingEvents) {
			const eventElements = Array.from(document.querySelectorAll(`[data-event-id="${event.id}"]`));
			for (const element of eventElements) {
				if (element instanceof HTMLElement) {
					element.classList.add("event-highlighted");
					setTimeout(() => {
						element.classList.remove("event-highlighted");
					}, durationMs);
				}
			}
		}
	}

	private findUpcomingEventIds(): Set<string> {
		const result = new Set<string>();

		if (!this.calendar) return result;

		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.highlightUpcomingEvent) return result;

		const view = this.calendar.view;
		if (!view) return result;

		const now = new Date();
		const viewStart = view.activeStart;
		const viewEnd = view.activeEnd;

		// Only highlight if "now" is within the current view's date range
		if (now < viewStart || now > viewEnd) {
			return result;
		}

		// Get all events from the calendar
		const events = this.calendar.getEvents();

		// First, find all events that are currently active (now is between start and end)
		const activeEvents = events.filter((event) => {
			const eventStart = event.start;
			if (!eventStart) return false;
			// Exclude virtual events from being highlighted
			if (event.extendedProps?.isVirtual) return false;

			const eventEnd = event.end || eventStart;
			// Check if now is between start and end
			return eventStart <= now && now <= eventEnd;
		});

		// If there are active events, highlight all of them
		if (activeEvents.length > 0) {
			for (const event of activeEvents) {
				result.add(event.id);
			}
			return result;
		}

		// If no active events, find the next upcoming event (closest future start time)
		const upcomingEvents = events
			.filter((event) => {
				const eventStart = event.start;
				if (!eventStart) return false;
				// Exclude virtual events from being highlighted
				if (event.extendedProps?.isVirtual) return false;
				return eventStart > now;
			})
			.sort((a, b) => {
				const aStart = a.start?.getTime() || 0;
				const bStart = b.start?.getTime() || 0;
				return aStart - bStart;
			});

		// Return the ID of the first upcoming event
		if (upcomingEvents.length > 0) {
			result.add(upcomingEvents[0].id);
		}

		return result;
	}

	private updateUpcomingEventHighlight(): void {
		if (!this.calendar) return;

		const newUpcomingEventIds = this.findUpcomingEventIds();

		// Check if the set of highlighted events has changed
		const hasChanged =
			newUpcomingEventIds.size !== this.currentUpcomingEventIds.size ||
			Array.from(newUpcomingEventIds).some((id) => !this.currentUpcomingEventIds.has(id));

		if (!hasChanged) {
			return;
		}

		// Remove highlight from previous upcoming events that are no longer active
		for (const oldId of this.currentUpcomingEventIds) {
			if (!newUpcomingEventIds.has(oldId)) {
				const oldEventElements = Array.from(document.querySelectorAll(`[data-event-id="${oldId}"]`));
				for (const element of oldEventElements) {
					if (element instanceof HTMLElement) {
						element.classList.remove("event-upcoming");
					}
				}
			}
		}

		// Add highlight to new upcoming events
		for (const newId of newUpcomingEventIds) {
			if (!this.currentUpcomingEventIds.has(newId)) {
				const newEventElements = Array.from(document.querySelectorAll(`[data-event-id="${newId}"]`));
				for (const element of newEventElements) {
					if (element instanceof HTMLElement) {
						element.classList.add("event-upcoming");
					}
				}
			}
		}

		// Update tracked IDs
		this.currentUpcomingEventIds = newUpcomingEventIds;
	}

	private startUpcomingEventCheck(): void {
		// Clear any existing interval
		this.stopUpcomingEventCheck();

		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.highlightUpcomingEvent) return;

		// Initial check
		this.updateUpcomingEventHighlight();

		// Set up interval to check once per minute (60000ms)
		this.upcomingEventCheckInterval = window.setInterval(() => {
			this.updateUpcomingEventHighlight();
		}, 60000);
	}

	private stopUpcomingEventCheck(): void {
		if (this.upcomingEventCheckInterval !== null) {
			window.clearInterval(this.upcomingEventCheckInterval);
			this.upcomingEventCheckInterval = null;
		}

		// Clear all highlighted upcoming events
		for (const eventId of this.currentUpcomingEventIds) {
			const eventElements = Array.from(document.querySelectorAll(`[data-event-id="${eventId}"]`));
			for (const element of eventElements) {
				if (element instanceof HTMLElement) {
					element.classList.remove("event-upcoming");
				}
			}
		}
		this.currentUpcomingEventIds.clear();
	}

	private async initializeCalendar(container: HTMLElement): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;

		this.calendar = new Calendar(container, {
			plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],

			timeZone: "local",

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

			eventClassNames: (arg) => {
				const now = new Date();
				const eventEnd = arg.event.end || arg.event.start;
				if (!eventEnd) return [];

				const isPast = eventEnd < now;

				const classes = [];
				if (isPast) {
					const contrast = this.bundle.settingsStore.currentSettings.pastEventContrast;
					if (contrast === 0) {
						classes.push("past-event-hidden");
					} else if (contrast < 100) {
						classes.push("past-event-faded");
					}
				}
				return classes;
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
				if (this.batchSelectionManager?.isInSelectionMode()) {
					if (!info.event.extendedProps.isVirtual) {
						this.batchSelectionManager.handleEventClick(info.event.id);
					}
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
				// Always add context menu for all events (including virtual)
				info.el.addEventListener("contextmenu", (e) => {
					e.preventDefault();
					this.eventContextMenu.show(e, info);
				});

				// Only add hover preview for non-virtual events
				if (!info.event.extendedProps.isVirtual) {
					const settings = this.bundle.settingsStore.currentSettings;
					const filePath = info.event.extendedProps.filePath as string | undefined;
					if (settings.enableEventPreview && filePath) {
						info.el.addEventListener("mouseenter", (e) => {
							emitHover(this.app, this.container, info.el, e, filePath, this.bundle.calendarId);
						});
					}
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
				// Update upcoming event highlight when view changes
				setTimeout(() => this.updateUpcomingEventHighlight(), 300);
			},

			eventsSet: () => {
				this.batchSelectionManager?.refreshSelectionStyling();
				// Update upcoming event highlight when events change
				this.updateUpcomingEventHighlight();
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

		// Initialize filters in reverse order since they all insert after zoom button
		// Order will be: Zoom → FilterPresetSelector → ExpressionFilter → SearchFilter
		this.searchFilter.initialize(this.calendar, this.container);
		this.expressionFilter.initialize(this.calendar, this.container);
		this.filterPresetSelector.initialize(this.calendar, this.container);

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

		// Start the upcoming event check interval
		this.startUpcomingEventCheck();
	}

	private updateCalendarSettings(settings: SingleCalendarConfig): void {
		if (!this.calendar) return;

		this.calendar.setOption("timeZone", "local");
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

		this.filterPresetSelector.updatePresets(settings.filterPresets);

		// Restart or stop upcoming event check based on setting
		if (settings.highlightUpcomingEvent) {
			this.startUpcomingEventCheck();
		} else {
			this.stopUpcomingEventCheck();
		}

		this.refreshEvents();
	}

	private async refreshEvents(): Promise<void> {
		if (!this.calendar) {
			return;
		}

		// Don't refresh events until indexing is complete
		if (!this.isIndexingComplete) {
			return;
		}

		const view = this.calendar.view;
		if (!view) {
			return;
		}

		try {
			const start = view.activeStart.toISOString();
			const end = view.activeEnd.toISOString();

			let events = await this.bundle.eventStore.getNonSkippedEvents({ start, end });

			// Track events before filtering
			const totalEventsBeforeFilter = events.length;

			events = events.filter((event) => this.searchFilter.shouldInclude(event));
			events = events.filter((event) => this.expressionFilter.shouldInclude(event));

			// Calculate filtered events
			const filteredOutCount = totalEventsBeforeFilter - events.length;

			// Store filtered events for modal display
			if (filteredOutCount > 0) {
				const allEvents = await this.bundle.eventStore.getNonSkippedEvents({ start, end });
				this.filteredEvents = allEvents
					.filter((event) => !this.searchFilter.shouldInclude(event) || !this.expressionFilter.shouldInclude(event))
					.map((event) => ({
						filePath: event.ref.filePath,
						title: event.title,
						start: event.start,
						end: event.end,
						allDay: event.allDay,
					}));
			} else {
				this.filteredEvents = [];
			}

			const skippedEvents = await this.bundle.eventStore.getSkippedEvents({ start, end });
			this.updateSkippedEventsButton(skippedEvents.length);

			// Update disabled recurring events button
			this.updateDisabledRecurringEventsButton();

			// Update filtered events button
			this.updateFilteredEventsButton(filteredOutCount);

			// Convert to FullCalendar event format
			const calendarEvents = events.map((event) => {
				const classNames = ["regular-event"];
				if (event.isVirtual) {
					classNames.push("virtual-event");
				}
				const eventColor = this.getEventColor(event);

				// Strip Z suffix to treat times as naive local times (no timezone conversion)
				const start = event.start.replace(/Z$/, "");
				const end = event.end ? event.end.replace(/Z$/, "") : event.end;

				return {
					id: event.id,
					title: event.title, // Keep original title for search/filtering
					start: start,
					end: end,
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
		if (title) {
			title = removeZettelId(title);
		}
		titleEl.textContent = title;
		headerEl.appendChild(titleEl);

		container.appendChild(headerEl);

		const displayProperties = this.getDisplayProperties(event);
		if (displayProperties.length > 0) {
			const propsContainer = document.createElement("div");
			propsContainer.className = "fc-event-props";

			for (const [prop, value] of displayProperties) {
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
			container.appendChild(propsContainer);
		}

		return { domNodes: [mainEl] };
	}

	private getDisplayProperties(event: { extendedProps: { frontmatterDisplayData?: any } }): [string, any][] {
		const settings = this.bundle.settingsStore.currentSettings;
		const properties: [string, any][] = [];

		if (settings.frontmatterDisplayProperties.length > 0 && event.extendedProps.frontmatterDisplayData) {
			for (const prop of settings.frontmatterDisplayProperties) {
				const value = event.extendedProps.frontmatterDisplayData[prop];
				if (isNotEmpty(value)) {
					properties.push([prop, value]);
				}
			}
		}
		return properties;
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

		renderPropertyValue(container, value, config);
	}

	private getEventColor(event: any): string {
		const frontmatter = event.meta || {};
		return this.colorEvaluator.evaluateColor(frontmatter);
	}

	private async handleEventClick(info: any): Promise<void> {
		const event = info.event;
		const filePath = event.extendedProps.filePath;
		const isVirtual = event.extendedProps.isVirtual;

		// For virtual events, show preview of the source event
		if (isVirtual && filePath) {
			const sourceFile = this.app.vault.getAbstractFileByPath(filePath);
			if (sourceFile instanceof TFile) {
				const cache = this.app.metadataCache.getFileCache(sourceFile);
				if (cache?.frontmatter) {
					// Create a pseudo-event object with source file data for the preview
					const sourceEvent = {
						title: event.title,
						extendedProps: {
							filePath: filePath,
							frontmatterDisplayData: cache.frontmatter,
						},
					};
					new EventPreviewModal(this.app, this.bundle, sourceEvent).open();
					return;
				}
			}
		}

		// For regular and physical events, open the file
		if (filePath) {
			this.app.workspace.openLinkText(filePath, "", false);
		}
	}

	private handleEventMount(info: any): void {
		if (info.event.extendedProps.isVirtual) {
			info.el.classList.add("virtual-event-italic");
		}

		const element = info.el;
		const event = info.event;

		// Apply event color
		const eventColor = this.getEventColor({
			title: event.title,
			meta: event.extendedProps.frontmatterDisplayData,
		});

		element.style.setProperty("--event-color", eventColor);
		element.classList.add("prisma-calendar-event");

		// Set opacity CSS variable for past events
		const now = new Date();
		const eventEnd = event.end || event.start;
		const isPast = eventEnd < now;

		if (isPast) {
			const contrast = this.bundle.settingsStore.currentSettings.pastEventContrast;
			const opacity = contrast / 100;
			element.style.setProperty("--past-event-opacity", opacity.toString());
		}

		// Add tooltip with file path and frontmatter display data
		const tooltipParts = [`File: ${event.extendedProps.filePath}`];

		const displayProperties = this.getDisplayProperties(event);
		for (const [prop, value] of displayProperties) {
			// Note: The value might be an array or object, so we need to stringify it for the tooltip.
			// Simple string interpolation `${value}` works for arrays but shows `[object Object]` for objects.
			// The existing behavior is maintained here.
			tooltipParts.push(`${prop}: ${value}`);
		}

		element.setAttribute("title", tooltipParts.join("\n"));
		element.addClass("prisma-calendar-event");
	}

	private handleDateClick(info: any): void {
		// Create a new event with pre-filled date/time
		const clickedDate = info.date;
		const isAllDay = info.allDay;

		// Create a mock event object for the modal
		const newEvent: any = {
			title: "",
			start: toLocalISOString(clickedDate),
			allDay: isAllDay,
			extendedProps: {
				filePath: null, // Will be created
			},
		};

		// Only add end time for timed events (not all-day events)
		if (!isAllDay) {
			const endDate = new Date(clickedDate);
			endDate.setHours(endDate.getHours() + 1);
			newEvent.end = toLocalISOString(endDate);
		}

		new EventCreateModal(this.app, this.bundle, newEvent, (eventData) => {
			this.createNewEvent(eventData, clickedDate);
		}).open();
	}

	private createEventAtCurrentTime(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const now = new Date();
		const roundedStart = roundToNearestHour(now);

		// Calculate end time using default duration from settings
		const endDate = new Date(roundedStart);
		endDate.setMinutes(endDate.getMinutes() + settings.defaultDurationMinutes);

		// Create event object for the modal
		const newEvent: any = {
			title: "",
			start: toLocalISOString(roundedStart),
			end: toLocalISOString(endDate),
			allDay: false,
			extendedProps: {
				filePath: null,
			},
		};

		new EventCreateModal(this.app, this.bundle, newEvent, (eventData) => {
			this.createNewEvent(eventData, roundedStart);
		}).open();
	}

	private async createNewEvent(eventData: any, clickedDate: Date): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		try {
			const commandEventData: EventData = {
				filePath: null,
				title: eventData.title || `Event ${toLocalISOString(clickedDate).split("T")[0]}`,
				start: eventData.start,
				end: eventData.end,
				allDay: eventData.allDay,
				preservedFrontmatter: eventData.preservedFrontmatter,
			};

			const command = new CreateEventCommand(this.app, this.bundle, commandEventData, settings.directory, clickedDate);

			await this.bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error("Error creating new event:", error);
		}
	}

	private async handleEventUpdate(info: any, errorMessage: string): Promise<void> {
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
				toLocalISOString(info.event.start),
				info.event.end ? toLocalISOString(info.event.end) : undefined,
				info.event.allDay || false,
				toLocalISOString(info.oldEvent.start),
				info.oldEvent.end ? toLocalISOString(info.oldEvent.end) : undefined,
				info.oldEvent.allDay || false
			);

			await this.bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error(errorMessage, error);
			info.revert();
		}
	}

	private async handleEventDrop(info: any): Promise<void> {
		await this.handleEventUpdate(info, "Error updating event dates:");
	}

	private async handleEventResize(info: any): Promise<void> {
		await this.handleEventUpdate(info, "Error updating event duration:");
	}

	private setupKeyboardShortcuts(): void {
		this.containerEl.setAttribute("tabindex", "-1");

		const keydownHandler = (e: KeyboardEvent) => {
			if (!this.calendar) return;

			// Only handle arrow keys without any modifiers
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

			if (e.key === "ArrowLeft") {
				e.preventDefault();
				this.calendar.prev();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				this.calendar.next();
			}
		};

		this.containerEl.addEventListener("keydown", keydownHandler);

		this.containerEl.addEventListener("click", () => {
			this.containerEl.focus();
		});

		// Register cleanup
		this.register(() => {
			this.containerEl.removeEventListener("keydown", keydownHandler);
		});
	}

	async mount(): Promise<void> {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass(getCalendarViewType(this.bundle.calendarId));

		this.showLoading(root, "Indexing calendar events…");

		// Create calendar host
		this.container = root.createDiv("prisma-calendar-container");

		// Wait for layout before rendering FullCalendar
		await this.waitForLayout(this.container);
		await this.initializeCalendar(this.container);

		this.setupKeyboardShortcuts();

		setTimeout(() => this.containerEl.focus(), 100);

		// Resize updates
		this.observeResize(this.container, () => this.calendar?.updateSize());

		// Settings subscription
		const settingsSubscription = this.bundle.settingsStore.settings$.subscribe((settings: SingleCalendarConfig) => {
			this.updateCalendarSettings(settings);
		});
		this.addSub(settingsSubscription);

		// Subscribe to indexing complete state
		const indexingCompleteSubscription = this.bundle.indexer.indexingComplete$.subscribe((isComplete) => {
			this.isIndexingComplete = isComplete;
			if (isComplete) {
				this.hideLoading();
				this.refreshEvents();
			} else {
				// Indexing started (e.g., filter expressions changed)
				const root = this.containerEl.children[1] as HTMLElement;
				this.showLoading(root, "Re-indexing calendar events…");
			}
		});
		this.addSub(indexingCompleteSubscription);

		// Event store updates (only refreshes if indexing is complete)
		const eventStoreSubscription = this.bundle.eventStore.subscribe(() => this.refreshEvents());
		this.addSub(eventStoreSubscription);

		const recurringEventManagerSubscription = this.bundle.recurringEventManager.subscribe(() => this.refreshEvents());
		this.addSub(recurringEventManagerSubscription);
	}

	toggleBatchSelection(): void {
		const wasInSelectionMode = this.batchSelectionManager?.isInSelectionMode() ?? false;
		this.batchSelectionManager?.toggleSelectionMode();

		// Refresh events when exiting batch mode to restore skipped events button
		if (wasInSelectionMode) {
			this.refreshEvents();
		}
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

	moveBySelection(): void {
		this.batchSelectionManager?.executeMoveBy();
	}

	openFilterPresetSelector(): void {
		this.filterPresetSelector.open();
	}

	focusSearch(): void {
		this.searchFilter.focus();
	}

	focusExpressionFilter(): void {
		this.expressionFilter.focus();
	}

	private isRestoring = false;

	private saveCurrentState(): void {
		if (!this.calendar || this.isRestoring) return;

		const currentZoomLevel = this.zoomManager.getCurrentZoomLevel();
		this.bundle.viewStateManager.saveState(this.calendar, currentZoomLevel);
	}

	async unmount(): Promise<void> {
		this.saveCurrentState();

		// Stop upcoming event check interval
		this.stopUpcomingEventCheck();

		this.zoomManager.destroy();
		this.searchFilter.destroy();
		this.expressionFilter.destroy();

		this.calendar?.destroy();
		this.calendar = null;

		this.colorEvaluator.destroy();
		this.batchSelectionManager = null;
	}
}
