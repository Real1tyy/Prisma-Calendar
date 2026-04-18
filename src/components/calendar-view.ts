import { Calendar, type CustomButtonInput, type EventMountArg } from "@fullcalendar/core";
import allLocales from "@fullcalendar/core/locales-all";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DropArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
	afterRender,
	calculateEndTime,
	cls,
	ColorEvaluator,
	formatDuration,
	MountableComponent,
	type RgbColor,
	roundToNearestHour,
	toggleCls,
	toLocalISOString,
} from "@real1ty-obsidian-plugins";
import { type App, Component, type Modal, TFile, type WorkspaceLeaf } from "obsidian";

import {
	CATEGORY_HIGHLIGHT_DURATION_MS,
	CLICK_THRESHOLD_MS,
	DOUBLE_TAP_DELAY_MS,
	DRAG_EDGE_THRESHOLD_PX,
	EVENT_HIGHLIGHT_DURATION_MS,
	INITIAL_SIZE_UPDATE_DELAY_MS,
	POINTER_UP_IGNORE_CLICKS_DELAY_MS,
	RESTORATION_DELAY_MS,
	UPCOMING_EVENT_CHECK_INTERVAL_MS,
} from "../constants";
import type { CalendarBundle } from "../core/calendar-bundle";
import { fillTime, UpdateEventCommand, updateFrontmatter } from "../core/commands";
import { buildDependencyGraph } from "../core/dependency-graph";
import { PRO_FEATURES } from "../core/license";
import { MinimizedModalManager } from "../core/minimized-modal-manager";
import { getProGateUrls } from "../core/pro-feature-previews";
import type {
	CalendarEvent,
	CalendarEventData,
	EventDateTime,
	EventMountInfo,
	EventUpdateInfo,
	ExtendedButtonInput,
	FCPrismaEventInput,
} from "../types/calendar";
import { isAnyVirtual, isTimedEvent } from "../types/calendar";
import { isBatchSelectable, isFileBackedEvent } from "../types/event-classification";
import type { SingleCalendarConfig } from "../types/index";
import { getEventRenderingKey } from "../utils/calendar-settings";
import { isPointInsideElement, toggleEventHighlight } from "../utils/dom-utils";
import { resolveAllEventColors, resolveEventColor } from "../utils/event-color";
import { diffEvents, eventFingerprint, hashFrontmatter } from "../utils/event-diff";
import { getCommonCategories, stripISOSuffix } from "../utils/event-frontmatter";
import { findAdjacentEvent, getSourceEventInfoFromVirtual } from "../utils/event-matching";
import { invalidatePropertyExtractionCache } from "../utils/expression-utils";
import { getFilePath, getVirtualKind } from "../utils/extended-props";
import { stripZ } from "../utils/iso";
import { emitHover, getFileByPathOrThrow } from "../utils/obsidian";
import { BatchSelectionManager } from "./batch-selection-manager";
import {
	applyEventMountStyling,
	attachLazyNotePreview,
	buildColorDotsContainer,
	type EventRenderContext,
	renderEventContent,
} from "./calendar-event-renderer";
import type { CalendarHost } from "./calendar-host";
import { ConnectionRenderer } from "./connection-renderer";
import { EventContextMenu } from "./event-context-menu";
import { FilterPresetSelector } from "./filter-preset-selector";
import { ExpressionFilterInputManager } from "./input-managers/expression-filter";
import { SearchFilterInputManager } from "./input-managers/search-filter";
import {
	EventsModal,
	FilteredEventsModal,
	GlobalSearchModal,
	SelectedEventsModal,
	SkippedEventsModal,
} from "./list-modals";
import type { PreviewEventData } from "./modals";
import {
	EventCreateModal,
	openCategoryAssignModal,
	showBatchFrontmatterModal,
	showCategorySelectModal,
	showEventPreviewModal,
	showIntervalEventsModal,
} from "./modals";
import { PrerequisiteSelectionManager } from "./prerequisite-selection-manager";
import { createStickyBanner, type StickyBannerHandle } from "./sticky-banner";
import { UntrackedEventsDropdown } from "./untracked-events-dropdown";
import { AllTimeStatsModal, DailyStatsModal, MonthlyStatsModal, WeeklyStatsModal } from "./weekly-stats";
import { ZoomManager } from "./zoom-manager";

export class CalendarComponent extends MountableComponent(Component, "prisma") implements CalendarHost {
	calendar: Calendar | null = null;
	private eventContextMenu: EventContextMenu;
	private colorEvaluator: ColorEvaluator<SingleCalendarConfig>;
	private batchSelectionManager: BatchSelectionManager | null = null;
	private prerequisiteSelectionManager: PrerequisiteSelectionManager | null = null;
	private zoomManager: ZoomManager;
	private searchFilter: SearchFilterInputManager;
	private expressionFilter: ExpressionFilterInputManager;
	private filterPresetSelector: FilterPresetSelector;
	private container: HTMLElement;
	private skippedEventsModal: SkippedEventsModal | null = null;
	private eventsModal: EventsModal | null = null;
	private filteredEventsModal: FilteredEventsModal | null = null;
	private untrackedEventsDropdown: UntrackedEventsDropdown | null = null;
	private selectedEventsModal: SelectedEventsModal | null = null;
	private globalSearchModal: GlobalSearchModal | null = null;
	private dailyStatsModal: DailyStatsModal | null = null;
	private weeklyStatsModal: WeeklyStatsModal | null = null;
	private monthlyStatsModal: MonthlyStatsModal | null = null;
	private alltimeStatsModal: AllTimeStatsModal | null = null;
	private filteredEvents: CalendarEvent[] = [];
	private isIndexingComplete = false;
	private currentUpcomingEventIds: Set<string> = new Set();
	private upcomingEventCheckInterval: number | null = null;
	private categoryHighlightTimeout: number | null = null;
	private highlightedCategoryEvents: Set<string> = new Set();
	private currentCategoryHighlightClass: string | null = null;
	private filteredEventsCount = 0;
	private skippedEventsCount = 0;
	private selectedEventsCount = 0;
	private dragEdgeScrollListener: ((e: MouseEvent) => void) | null = null;
	private dragEdgeScrollTimeout: number | null = null;
	private lastEdgeScrollTime = 0;
	private refreshRafId: number | null = null;
	private lastMobileTapTime = 0;
	private get navigationHistory() {
		return this.bundle.navigationHistory;
	}
	private lastFocusedEventInfo: CalendarEventData | null = null;
	private mouseDownTime = 0;
	private isHandlingSelection = false;
	private isDraggingCalendarEvent = false;
	private draggingCalendarEventFilePath: string | null = null;
	private dragNavigatedInterval = false;
	private isMobileLayout = false;
	private mobileControlsCollapsed = false;
	private renderedEvents = new Map<string, string>();
	private hasPerformedInitialLoad = false;
	private previousEventRenderingKey: string | null = null;
	private previousIntegrationColorKey: string | null = null;
	private isRefreshingEvents = false;
	private calendarIconCache: Map<string, string | undefined> = new Map();
	private pendingRefreshRequest = false;
	private stickyOffsetsRafId: number | null = null;
	private cachedTextColorRgb: RgbColor | null = null;
	private cachedTextColorSource: string | null = null;
	/** Pre-indexed map of date string → unique event colors, built during buildCalendarEvents(). */
	private colorDotIndex = new Map<string, Set<string>>();
	/** Serialized snapshot of colorDotIndex used to skip redundant DOM rebuilds. */
	private colorDotSnapshot = "";
	/** Cached "now" timestamp, refreshed once per datesSet cycle (not per event). */
	private cachedNow = new Date();
	private cachedTodayStart = new Date();
	private isRestoring = false;
	private connectionRenderer: ConnectionRenderer | null = null;
	private showConnections = false;
	private connectionBanner: StickyBannerHandle | null = null;
	private currentViewStart = new Date();
	private currentViewEnd = new Date();
	readonly app: App;
	private rootEl: HTMLElement;
	private hostEl: HTMLElement;
	private leaf: WorkspaceLeaf;

	// ─── Lifecycle ───────────────────────────────────────────────

	constructor(
		app: App,
		private bundle: CalendarBundle,
		rootEl: HTMLElement,
		hostEl: HTMLElement,
		leaf: WorkspaceLeaf
	) {
		super();
		this.app = app;
		this.rootEl = rootEl;
		this.hostEl = hostEl;
		this.leaf = leaf;
		this.container = rootEl;
		this.eventContextMenu = new EventContextMenu(this.app, bundle, this);
		this.colorEvaluator = new ColorEvaluator(bundle.settingsStore.settings$);
		this.zoomManager = new ZoomManager(bundle.settingsStore);
		this.searchFilter = new SearchFilterInputManager(() => this.scheduleRefreshEvents());
		this.expressionFilter = new ExpressionFilterInputManager(() => this.scheduleRefreshEvents());
		this.filterPresetSelector = new FilterPresetSelector(
			bundle.settingsStore.currentSettings.filterPresets,
			(expression: string) => {
				this.expressionFilter.setFilterValue(expression);
			}
		);
	}

	override async mount(): Promise<void> {
		this.showLoading(this.rootEl, "Indexing calendar events…");

		this.container = this.rootEl.createDiv(cls("calendar-container"));

		await this.waitForLayout(this.container);
		this.initializeCalendar(this.container);

		const isProSub = this.bundle.plugin.licenseManager.isPro$.subscribe((isPro) => {
			if (!isPro && this.showConnections) {
				this.hideConnections();
			}
		});
		this.register(() => isProSub.unsubscribe());

		this.setupKeyboardShortcuts();

		// Detect calendar-event drag release point reliably (FullCalendar's jsEvent in eventDragStop can be stale
		// when releasing outside the calendar grid, e.g. over toolbar/dropdowns).
		document.addEventListener("pointerup", this.handleGlobalPointerUpForUntrackedDrop, true);
		this.register(() => {
			document.removeEventListener("pointerup", this.handleGlobalPointerUpForUntrackedDrop, true);
		});

		requestAnimationFrame(() => this.hostEl.focus());

		// Re-focus container when this leaf becomes active (e.g. switching back from another tab)
		// so keyboard navigation (arrow keys for intervals) works immediately without clicking
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf === this.leaf) {
					this.hostEl.focus();
				}
			})
		);

		// Resize updates
		this.observeResize(this.container, () => {
			this.calendar?.updateSize();
			this.scheduleStickyOffsetsUpdate();
		});

		// Settings subscription
		const settingsSubscription = this.bundle.settingsStore.settings$.subscribe((settings: SingleCalendarConfig) => {
			this.updateCalendarSettings(settings);
		});
		this.register(() => settingsSubscription.unsubscribe());

		const caldavSettingsSubscription = this.bundle.settingsStore.mainSettingsStore.settings$.subscribe(
			(fullSettings) => {
				const caldavColorKey = fullSettings.caldav.integrationEventColor;
				const icsColorKey = fullSettings.icsSubscriptions.integrationEventColor;
				const combinedKey = `${caldavColorKey}|${icsColorKey}`;
				if (combinedKey !== this.previousIntegrationColorKey) {
					this.previousIntegrationColorKey = combinedKey;
					this.scheduleRefreshEvents();
				}
				this.rebuildCalendarIconCache();
			}
		);
		this.register(() => caldavSettingsSubscription.unsubscribe());

		// Subscribe to indexing complete state
		const indexingCompleteSubscription = this.bundle.fileRepository.indexingComplete$.subscribe((isComplete) => {
			this.isIndexingComplete = isComplete;
			if (isComplete) {
				this.hideLoading();
				this.scheduleRefreshEvents();
			} else {
				this.showLoading(this.rootEl, "Re-indexing calendar events…");
			}
		});
		this.register(() => indexingCompleteSubscription.unsubscribe());

		// Event store updates (only refreshes if indexing is complete)
		const eventStoreSubscription = this.bundle.eventStore.subscribe(() => this.scheduleRefreshEvents());
		this.register(() => eventStoreSubscription.unsubscribe());

		const recurringEventManagerSubscription = this.bundle.recurringEventManager.subscribe(() =>
			this.scheduleRefreshEvents()
		);
		this.register(() => recurringEventManagerSubscription.unsubscribe());
	}

	override async unmount(): Promise<void> {
		this.saveCurrentState();
		this.stopUpcomingEventCheck();
		this.cleanupDragEdgeScrolling();
		this.zoomManager.destroy();
		this.searchFilter.destroy();
		this.expressionFilter.destroy();
		this.untrackedEventsDropdown?.destroy();

		if (this.refreshRafId !== null) {
			cancelAnimationFrame(this.refreshRafId);
			this.refreshRafId = null;
		}
		if (this.stickyOffsetsRafId !== null) {
			cancelAnimationFrame(this.stickyOffsetsRafId);
			this.stickyOffsetsRafId = null;
		}

		this.clearRenderedEventsCache();
		this.calendar?.destroy();
		this.calendar = null;
		this.colorEvaluator.destroy();
		this.batchSelectionManager = null;
		this.removeConnectionBanner();
		this.connectionRenderer?.destroy();
		this.connectionRenderer = null;
	}

	// ─── Calendar Setup ──────────────────────────────────────────

	private initializeCalendar(container: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const initialView = this.isMobileView() ? settings.defaultMobileView : settings.defaultView;

		this.isMobileLayout = this.isMobileView();
		this.mobileControlsCollapsed = this.isMobileLayout;
		this.applyMobileControlsCollapsedState();

		this.rebuildCalendarIconCache();

		this.calendar = new Calendar(container, {
			plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],

			locales: allLocales,
			locale: settings.locale,

			timeZone: "local",

			initialView,

			nowIndicator: settings.nowIndicator,

			defaultTimedEventDuration: "00:01:00",

			stickyHeaderDates: settings.stickyDayHeaders,

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

			buttonText: { today: "Today" },

			headerToolbar: false, // Initially false, will be set by updateToolbar

			eventContent: (arg) => {
				return renderEventContent(arg, this.getEventRenderContext());
			},

			eventClassNames: (arg) => this.computeEventClassNames(arg),

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

			dayMaxEvents: this.isMobileView() ? settings.mobileMaxEventsPerDay : settings.desktopMaxEventsPerDay || false,

			windowResize: () => this.handleWindowResize(),

			editable: true,
			eventStartEditable: true,
			eventDurationEditable: true,
			eventResizableFromStart: true,

			selectable: true,
			selectMirror: true,
			unselectAuto: true,
			unselectCancel: ".modal",

			droppable: true,

			// Fix drag mirror positioning for all-day events
			// Positions the drag mirror relative to document.body instead of calendar container
			// This ensures the event box follows the cursor correctly for both all-day and timed events
			fixedMirrorParent: document.body,

			eventReceive: (info) => {
				// External draggable dropped - we handle this in the drop handler instead
				info.revert();
			},

			eventAllow: (_dropInfo, draggedEvent) => {
				return draggedEvent ? isFileBackedEvent(draggedEvent) : false;
			},

			eventClick: (info) => {
				if (this.prerequisiteSelectionManager?.isInSelectionMode()) {
					if (isFileBackedEvent(info.event)) {
						this.prerequisiteSelectionManager.handleEventClick(info.event.id);
					}
				} else if (this.batchSelectionManager?.isInSelectionMode()) {
					if (isBatchSelectable(info.event)) {
						this.batchSelectionManager.handleEventClick(info.event.id);
					}
				} else {
					this.handleEventClick(info, info.el);
				}
			},

			eventDidMount: (info) => this.handleEventDidMount(info),

			eventMouseEnter: (info) => {
				this.lastFocusedEventInfo = info.event;
			},

			eventDragStart: (info) => {
				this.dragNavigatedInterval = false;
				this.setupDragEdgeScrolling();
				const filePath = info.event.extendedProps?.["filePath"];
				this.isDraggingCalendarEvent =
					isFileBackedEvent(info.event) && typeof filePath === "string" && filePath.length > 0;
				this.draggingCalendarEventFilePath = this.isDraggingCalendarEvent ? filePath : null;
			},

			eventDragStop: (_info) => {
				this.cleanupDragEdgeScrolling();
				this.isDraggingCalendarEvent = false;
				this.draggingCalendarEventFilePath = null;
			},

			eventDrop: (info) => {
				this.cleanupDragEdgeScrolling();

				// When a drag navigated to a new interval via edge scrolling,
				// clear the rendered events cache so the file-change-triggered
				// refresh does a full reload and avoids duplicate rendering.
				if (this.dragNavigatedInterval) {
					this.dragNavigatedInterval = false;
					this.clearRenderedEventsCache();
				}

				void this.handleEventDrop(info);
			},

			eventResize: (info) => {
				void this.handleEventResize(info);
			},

			drop: (info) => {
				void this.handleExternalDrop(info);
			},

			dateClick: (info) => {
				// Only handle if not already handling a selection
				if (!this.isHandlingSelection) {
					this.handleDateClick(info);
				}
				// Reset flag after a short delay
				setTimeout(() => {
					this.isHandlingSelection = false;
				}, 50);
			},

			select: (info) => {
				// Check if this was a quick click or an actual drag
				const now = Date.now();
				const timeSinceMouseDown = now - this.mouseDownTime;
				// 150ms or less = click, more = drag

				const isQuickClick = timeSinceMouseDown < CLICK_THRESHOLD_MS;

				if (isQuickClick) {
					// Quick click - ignore select, let dateClick handle it
					this.calendar?.unselect();
				} else {
					// Actual drag - handle the selection and prevent dateClick
					this.isHandlingSelection = true;
					this.handleDateSelection(info);
				}
			},

			dayCellDidMount: (info) => {
				const month = info.date.getMonth();
				info.el.classList.add(cls(month % 2 === 0 ? "month-even" : "month-odd"));
			},

			datesSet: () => {
				this.cachedNow = new Date();
				const n = this.cachedNow;
				this.cachedTodayStart = new Date(n.getFullYear(), n.getMonth(), n.getDate());

				if (this.dragEdgeScrollListener) {
					this.dragNavigatedInterval = true;
				}

				const view = this.calendar?.view;
				if (view) {
					this.bundle.viewRef.capacityIndicatorHandle?.setRange(view.activeStart, view.activeEnd);
					this.currentViewStart = view.activeStart;
					this.currentViewEnd = view.activeEnd;
				}

				this.recordNavigationState();

				this.scheduleRefreshEvents();
				// Update zoom button, save state, and highlight after FC re-renders
				void afterRender().then(() => {
					this.zoomManager.updateZoomLevelButton();
					this.saveCurrentState();
					this.updateUpcomingEventHighlight();
					this.scheduleStickyOffsetsUpdate();

					// Apply month boundary classes to timeGrid columns
					this.container.querySelectorAll<HTMLElement>(".fc-timegrid-col[data-date]").forEach((col) => {
						const dateStr = col.getAttribute("data-date");
						if (dateStr) {
							const month = new Date(dateStr).getMonth();
							col.classList.toggle(cls("month-even"), month % 2 === 0);
							col.classList.toggle(cls("month-odd"), month % 2 !== 0);
						}
					});

					if (this.showConnections) this.renderConnections();
				});
			},

			eventsSet: () => {
				this.batchSelectionManager?.refreshSelectionStyling();
				if (this.showConnections) this.renderConnections();
				this.updateUpcomingEventHighlight();
			},

			height: "auto",
			aspectRatio: 1.35,
		});

		this.calendar.render();

		this.batchSelectionManager = new BatchSelectionManager(this.app, this.calendar, this.bundle);
		this.batchSelectionManager.setOnSelectionChangeCallback(() => {
			if (this.batchSelectionManager) {
				this.selectedEventsCount = this.batchSelectionManager.getSelectionCount();
			}
			this.updateToolbar();
		});
		this.prerequisiteSelectionManager = new PrerequisiteSelectionManager(this.calendar, this.bundle, this.container);
		this.updateToolbar();

		this.zoomManager.initialize(this.calendar, this.container, this.hostEl);
		this.zoomManager.setOnZoomChangeCallback(() => {
			this.saveCurrentState();
			if (this.showConnections) this.renderConnections();
		});

		this.initializeToolbarComponents(this.isMobileLayout ? settings.mobileToolbarButtons : settings.toolbarButtons);
		this.scheduleStickyOffsetsUpdate();

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
			}, RESTORATION_DELAY_MS);
		}

		setTimeout(() => {
			if (this.calendar) {
				this.calendar.updateSize();
			}
			this.scheduleStickyOffsetsUpdate();
		}, INITIAL_SIZE_UPDATE_DELAY_MS);

		// Ensure initial events are loaded after calendar is fully rendered
		this.scheduleRefreshEvents();

		this.applyContainerStyles(container, settings);

		this.setupMouseTracking(container);
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

		this.calendar.setOption("locale", settings.locale);
		this.calendar.setOption("weekends", !settings.hideWeekends);
		this.calendar.setOption("firstDay", settings.firstDayOfWeek);
		this.calendar.setOption("nowIndicator", settings.nowIndicator);
		this.calendar.setOption("stickyHeaderDates", settings.stickyDayHeaders);

		// Update event overlap settings
		this.calendar.setOption("eventOverlap", settings.eventOverlap);
		this.calendar.setOption("slotEventOverlap", settings.slotEventOverlap);
		this.calendar.setOption("eventMaxStack", settings.eventMaxStack);
		this.calendar.setOption(
			"dayMaxEvents",
			this.isMobileView() ? settings.mobileMaxEventsPerDay : settings.desktopMaxEventsPerDay || false
		);

		this.filterPresetSelector.updatePresets(settings.filterPresets);

		this.applyContainerStyles(this.container, settings);
		this.scheduleStickyOffsetsUpdate();

		// Restart or stop upcoming event check based on setting
		if (settings.highlightUpcomingEvent) {
			this.startUpcomingEventCheck();
		} else {
			this.stopUpcomingEventCheck();
		}

		// Only schedule a full event refresh if event-rendering settings changed.
		// Non-rendering settings (hour range, weekends, etc.) are handled by setOption() above.
		const eventRenderingKey = getEventRenderingKey(settings);

		if (eventRenderingKey !== this.previousEventRenderingKey) {
			this.previousEventRenderingKey = eventRenderingKey;
			// Invalidate cached color rule property extraction since rules may have changed
			invalidatePropertyExtractionCache();
			// Force remount so event-level CSS variables (like text color) are re-applied.
			this.clearRenderedEventsCache();
			this.scheduleRefreshEvents();
		}
	}

	private applyContainerStyles(container: HTMLElement, settings: SingleCalendarConfig): void {
		toggleCls(container, "thicker-hour-lines", settings.thickerHourLines);
		toggleCls(container, "sticky-all-day-events", settings.stickyAllDayEvents);
		// sticky-day-headers class is still applied for CSS that depends on both settings
		toggleCls(container, "sticky-day-headers", settings.stickyDayHeaders);
		toggleCls(container, "month-boundary-colors", settings.dayCellColoring === "boundary");
		toggleCls(container, "uniform-day-color", settings.dayCellColoring === "uniform");
		container.style.setProperty("--month-even-color", settings.monthEvenColor);
		container.style.setProperty("--month-odd-color", settings.monthOddColor);
		container.style.setProperty("--all-day-event-height", `${settings.allDayEventHeight}px`);
	}

	private initializeToolbarComponents(toolbarButtons: string[]): void {
		if (!this.calendar) return;

		const buttons = new Set(toolbarButtons);
		const components = this.getToolbarComponentDefinitions();

		// Initialize components in reverse order since they insert after zoom button
		// Order will be: Zoom → FilterPresetSelector → ExpressionFilter → SearchInput → Untracked
		for (const component of components) {
			if (buttons.has(component.id)) {
				component.init();
			}
		}
	}

	private rebuildCalendarIconCache(): void {
		this.calendarIconCache.clear();

		const caldavSettings = this.bundle.getCalDAVSettings();
		for (const account of caldavSettings.accounts) {
			if (account.icon) {
				this.calendarIconCache.set(`caldav:${account.id}`, account.icon);
			}
		}

		const icsSubscriptionSettings = this.bundle.getICSSubscriptionSettings();
		for (const subscription of icsSubscriptionSettings.subscriptions) {
			if (subscription.icon) {
				this.calendarIconCache.set(`ics:${subscription.id}`, subscription.icon);
			}
		}
	}

	// ─── Calendar Event Handlers ────────────────────────────────

	private computeEventClassNames(arg: { event: { end: Date | null; start: Date | null; allDay: boolean } }): string[] {
		const eventEnd = arg.event.end || arg.event.start;
		if (!eventEnd) return [];

		const isAllDay = arg.event.allDay;
		let isPast: boolean;

		if (isAllDay) {
			// For all-day events, compare dates only (not times)
			const eventDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
			isPast = eventDate < this.cachedTodayStart;
		} else {
			isPast = eventEnd < this.cachedNow;
		}

		const classes: string[] = [];
		if (isPast) {
			const contrast = this.bundle.settingsStore.currentSettings.pastEventContrast;
			if (contrast === 0) {
				classes.push(cls("past-event-hidden"));
			} else if (contrast < 100) {
				classes.push(cls("past-event-faded"));
			}
		}
		return classes;
	}

	private handleWindowResize(): void {
		const currentSettings = this.bundle.settingsStore.currentSettings;
		const isMobile = this.isMobileView();
		const didMobileBreakpointChange = isMobile !== this.isMobileLayout;
		if (isMobile !== this.isMobileLayout) {
			this.isMobileLayout = isMobile;
			if (isMobile) {
				this.mobileControlsCollapsed = true;
			}
		}
		this.applyMobileControlsCollapsedState();
		if (didMobileBreakpointChange) {
			this.updateToolbar();
		}
		this.calendar?.setOption(
			"dayMaxEvents",
			this.isMobileView() ? currentSettings.mobileMaxEventsPerDay : currentSettings.desktopMaxEventsPerDay || false
		);
		this.scheduleStickyOffsetsUpdate();
	}

	private handleEventDidMount(info: EventMountArg): void {
		info.el.setAttribute("data-testid", "prisma-cal-event");
		info.el.setAttribute("data-event-title", info.event.title);
		const filePathForTestId = getFilePath(info.event);
		if (filePathForTestId) info.el.setAttribute("data-event-file-path", filePathForTestId);
		const vk = getVirtualKind(info.event);
		if (isAnyVirtual(vk)) {
			info.el.classList.add(cls("virtual-event-opacity"), cls("virtual-event-cursor"));
			if (vk === "holiday") {
				info.el.classList.add(cls("holiday-event"));
				info.el.title = "Holiday (read-only)";
			} else if (vk === "manual") {
				info.el.title = "Virtual event (no backing file)";
			} else if (vk === "recurring") {
				info.el.title = "Virtual recurring event (read-only)";
			}
		}
		if (isBatchSelectable(info.event)) {
			this.batchSelectionManager?.handleEventMount(info.event.id, info.el);
		}
		this.handleEventMount(info);

		info.el.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			this.eventContextMenu.show(e, info, info.el, this.container);
		});

		if (isFileBackedEvent(info.event)) {
			const filePath = getFilePath(info.event);
			if (filePath) {
				info.el.addEventListener("mouseenter", (e) => {
					const settings = this.bundle.settingsStore.currentSettings;
					if (settings.enableEventPreview) {
						emitHover(this.app, this.container, info.el, e, filePath, this.bundle.calendarId);
					}
				});
			}
		}
	}

	// ─── Toolbar ─────────────────────────────────────────────────

	private updateToolbar(): void {
		if (!this.calendar || !this.batchSelectionManager) return;

		const inSelectionMode = this.batchSelectionManager.isInSelectionMode();

		if (inSelectionMode) {
			this.cleanupEventCountButtons();
		}

		const { headerToolbar, customButtons } = this.buildToolbarConfig(inSelectionMode);

		this.calendar.setOption("headerToolbar", headerToolbar);
		// Cast to CustomButtonInput - className is accepted at runtime but not in FullCalendar's types
		this.calendar.setOption("customButtons", customButtons as Record<string, CustomButtonInput>);
		this.applyMobileControlsCollapsedState();
		this.scheduleStickyOffsetsUpdate();

		// Best-effort sync stamp so E2E selectors don't race the rAF-deferred
		// authoritative pass below. Additive only (no clear) — if FC hasn't
		// re-rendered yet, leaving stale testids in place is better than blanking
		// the toolbar. The deferred pass below clears + restamps once FC settles.
		this.stampToolbarTestIds({ clearStale: false });

		void afterRender().then(() => {
			if (!inSelectionMode) {
				this.applyFilteredEventsButtonState();
				this.applySkippedEventsButtonState();
				this.zoomManager.updateZoomLevelButton();
			}
			this.scheduleStickyOffsetsUpdate();
			this.stampToolbarTestIds();
		});
	}

	private stampToolbarTestIds(opts: { clearStale?: boolean } = {}): void {
		const root = this.container;
		if (!root) return;
		// FullCalendar v6 recycles button DOM elements across `setOption("headerToolbar")`
		// calls and rewrites their `fc-<name>-button` class. A button that used to be
		// `.fc-filteredEvents-button` can become `.fc-batchCounter-button` on the next
		// render, so any `data-testid` we stamped earlier would now be wrong. The
		// authoritative pass clears stale testids before re-stamping so the map below
		// is unambiguous; the synchronous best-effort pass skips the clear so the DOM
		// never goes momentarily un-stamped between the two passes.
		//
		// Also note: the `className` field on CustomButtonInput is IGNORED by FC v6 —
		// only `fc-<buttonName>-button` is applied. Stamping must key off those, never
		// off the prisma-prefixed class names passed to `customButtons`.
		if (opts.clearStale !== false) {
			const toolbar = root.querySelector(".fc-header-toolbar");
			if (toolbar) {
				toolbar
					.querySelectorAll<HTMLElement>('[data-testid^="prisma-cal-toolbar-"], [data-testid^="prisma-cal-batch-"]')
					.forEach((el) => el.removeAttribute("data-testid"));
			}
		}
		const map: Array<[string, string]> = [
			[".fc-prev-button", "prisma-cal-toolbar-prev"],
			[".fc-next-button", "prisma-cal-toolbar-next"],
			[".fc-today-button", "prisma-cal-toolbar-today"],
			[".fc-now-button", "prisma-cal-toolbar-goto-now"],
			[".fc-dayGridMonth-button", "prisma-cal-toolbar-view-month"],
			[".fc-timeGridWeek-button", "prisma-cal-toolbar-view-week"],
			[".fc-timeGridDay-button", "prisma-cal-toolbar-view-day"],
			[".fc-listWeek-button", "prisma-cal-toolbar-view-list"],
			[".fc-createEvent-button", "prisma-cal-toolbar-create"],
			[".fc-zoomLevel-button", "prisma-cal-toolbar-zoom-level"],
			[".fc-batchSelect-button", "prisma-cal-toolbar-batch-select"],
			[".fc-batchExit-button", "prisma-cal-toolbar-batch-exit"],
			[".fc-eventsButton-button", "prisma-cal-toolbar-events"],
			[".fc-filteredEvents-button", "prisma-cal-toolbar-filtered-events"],
			[".fc-skippedEvents-button", "prisma-cal-toolbar-skipped-events"],
			[".fc-mobileControls-button", "prisma-cal-toolbar-mobile-controls"],
			// Batch-mode toolbar buttons — only rendered while selection mode is on.
			// Key off FC's own `fc-<customButtonKey>-button` class (e.g. `batchCounter`
			// → `.fc-batchCounter-button`). The `className` on these CustomButtonInput
			// objects is NOT applied by FC, so the prisma-prefixed classes never land
			// on the DOM.
			[".fc-batchCounter-button", "prisma-cal-batch-counter"],
			[".fc-batchSelectAll-button", "prisma-cal-batch-select-all"],
			[".fc-batchClear-button", "prisma-cal-batch-clear"],
			[".fc-batchDuplicate-button", "prisma-cal-batch-duplicate"],
			[".fc-batchDelete-button", "prisma-cal-batch-delete"],
			[".fc-batchSkip-button", "prisma-cal-batch-skip"],
			[".fc-batchMarkAsDone-button", "prisma-cal-batch-mark-done"],
			[".fc-batchMarkAsNotDone-button", "prisma-cal-batch-mark-not-done"],
			[".fc-batchCategories-button", "prisma-cal-batch-categories"],
			[".fc-batchFrontmatter-button", "prisma-cal-batch-frontmatter"],
			[".fc-batchCloneNext-button", "prisma-cal-batch-clone-next"],
			[".fc-batchClonePrev-button", "prisma-cal-batch-clone-prev"],
			[".fc-batchMoveNext-button", "prisma-cal-batch-move-next"],
			[".fc-batchMovePrev-button", "prisma-cal-batch-move-prev"],
			[".fc-batchMoveBy-button", "prisma-cal-batch-move-by"],
			[".fc-batchOpenAll-button", "prisma-cal-batch-open-all"],
			[".fc-batchMakeVirtual-button", "prisma-cal-batch-make-virtual"],
			[".fc-batchMakeReal-button", "prisma-cal-batch-make-real"],
		];
		for (const [selector, testId] of map) {
			const el = root.querySelector(selector);
			if (el instanceof HTMLElement) {
				el.setAttribute("data-testid", testId);
			}
		}
	}

	private buildToolbarConfig(inSelectionMode: boolean): {
		headerToolbar: { left: string; center: string; right: string };
		customButtons: Record<string, ExtendedButtonInput>;
	} {
		const viewSwitchers = "dayGridMonth,timeGridWeek,timeGridDay,listWeek";

		if (inSelectionMode) {
			const left = "prev,next today";
			const settings = this.bundle.settingsStore.currentSettings;

			const rightButtons = ["batchCounter", ...settings.batchActionButtons, "batchExit"];
			const right = rightButtons.join(" ");

			return {
				headerToolbar: { left, center: "title", right },
				customButtons: this.buildBatchButtons(),
			};
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const isMobile = this.isMobileView();
		const toolbarButtons = new Set(isMobile ? settings.mobileToolbarButtons : settings.toolbarButtons);

		const leftItems: string[] = [];
		if (toolbarButtons.has("prevNext")) {
			leftItems.push("prev", "next");
		}
		if (toolbarButtons.has("today")) {
			leftItems.push("today");
		}
		if (toolbarButtons.has("now")) {
			leftItems.push("now");
		}
		if (toolbarButtons.has("createEvent")) {
			leftItems.push("createEvent");
		}
		if (toolbarButtons.has("zoomLevel")) {
			leftItems.push("zoomLevel");
		}
		if (isMobile && this.shouldShowMobileControlsToggle(toolbarButtons)) {
			leftItems.push("mobileControls");
		}

		const left = leftItems.length > 0 ? leftItems.join(" ") : "";
		const rightItems = ["filteredEvents", "eventsButton"];
		rightItems.push("skippedEvents", "batchSelect");
		const right = `${rightItems.join(" ")} ${viewSwitchers}`;

		return {
			headerToolbar: { left, center: "title", right },
			customButtons: this.buildRegularButtons(),
		};
	}

	private buildRegularButtons(): Record<string, ExtendedButtonInput> {
		return {
			createEvent: {
				text: "Create",
				click: () => this.openCreateEventModal(),
			},
			now: {
				text: "Now",
				click: () => this.scrollToNow(),
			},
			zoomLevel: this.zoomManager.createZoomLevelButton(),
			mobileControls: {
				text: "Filters",
				click: () => {
					this.setMobileControlsCollapsed(!this.mobileControlsCollapsed);
				},
				className: cls("mobile-controls-toggle"),
			},
			batchSelect: {
				text: "Batch Select",
				click: () => this.toggleBatchSelection(),
			},
			filteredEvents: {
				text: "", // Don't set text here - it will be set by applyFilteredEventsButtonState
				click: () => {
					void this.showFilteredEventsModal();
				},
				className: this.filteredEventsCount > 0 ? cls("fc-button-visible") : cls("fc-button-hidden"),
			},
			skippedEvents: {
				text: "", // Don't set text here - it will be set by applySkippedEventsButtonState
				click: () => {
					void this.showSkippedEventsModal();
				},
				className: this.skippedEventsCount > 0 ? cls("fc-button-visible") : cls("fc-button-hidden"),
			},
			eventsButton: {
				text: "Events",
				click: () => {
					void this.showEventsModal();
				},
			},
		};
	}

	private buildBatchButtons(): Record<string, ExtendedButtonInput> {
		const bsm = this.batchSelectionManager!;
		const clsBase = cls("batch-action-btn");

		return {
			batchCounter: {
				text: this.getSelectedEventsButtonText(),
				click: () => {
					void this.showSelectedEventsModal();
				},
				className: `${clsBase} ${cls("batch-counter")}`,
			},
			batchSelectAll: {
				text: "All",
				click: () => bsm.selectAllVisibleEvents(),
				className: `${clsBase} ${cls("select-all-btn")}`,
			},
			batchClear: {
				text: "Clear",
				click: () => bsm.clearSelection(),
				className: `${clsBase} ${cls("clear-btn")}`,
			},
			batchDuplicate: {
				text: "Duplicate",
				click: () => {
					void bsm.executeDuplicate();
				},
				className: `${clsBase} ${cls("duplicate-btn")}`,
			},
			batchMoveBy: {
				text: "Move By",
				click: () => bsm.executeMoveBy(),
				className: `${clsBase} ${cls("move-by-btn")}`,
			},
			batchCloneNext: {
				text: "Clone Next",
				click: () => {
					void bsm.executeClone(1);
				},
				className: `${clsBase} ${cls("clone-next-btn")}`,
			},
			batchClonePrev: {
				text: "Clone Prev",
				click: () => {
					void bsm.executeClone(-1);
				},
				className: `${clsBase} ${cls("clone-prev-btn")}`,
			},
			batchMoveNext: {
				text: "Move Next",
				click: () => {
					void bsm.executeMove(1);
				},
				className: `${clsBase} ${cls("move-next-btn")}`,
			},
			batchMovePrev: {
				text: "Move Prev",
				click: () => {
					void bsm.executeMove(-1);
				},
				className: `${clsBase} ${cls("move-prev-btn")}`,
			},
			batchOpenAll: {
				text: "Open",
				click: () => {
					void bsm.executeOpenAll();
				},
				className: `${clsBase} ${cls("open-all-btn")}`,
			},
			batchSkip: {
				text: "Skip",
				click: () => {
					void bsm.executeSkip();
				},
				className: `${clsBase} ${cls("skip-btn")}`,
			},
			batchMarkAsDone: {
				text: "Done",
				click: () => {
					void bsm.executeMarkAsDone();
				},
				className: `${clsBase} ${cls("mark-done-btn")}`,
			},
			batchMarkAsNotDone: {
				text: "Not Done",
				click: () => {
					void bsm.executeMarkAsNotDone();
				},
				className: `${clsBase} ${cls("mark-not-done-btn")}`,
			},
			batchCategories: {
				text: "Categories",
				click: () => {
					void this.openCategoryAssignModal();
				},
				className: `${clsBase} ${cls("categories-btn")}`,
			},
			batchFrontmatter: {
				text: "Frontmatter",
				click: () => {
					void this.openBatchFrontmatterModal();
				},
				className: `${clsBase} ${cls("frontmatter-btn")}`,
			},
			batchMakeVirtual: {
				text: "Make Virtual",
				click: () => {
					void bsm.executeMakeVirtual();
				},
				className: `${clsBase} ${cls("make-virtual-btn")}`,
			},
			batchMakeReal: {
				text: "Make Real",
				click: () => {
					void bsm.executeMakeReal();
				},
				className: `${clsBase} ${cls("make-real-btn")}`,
			},
			batchDelete: {
				text: "Delete",
				click: () => {
					void bsm.executeDelete();
				},
				className: `${clsBase} ${cls("delete-btn")}`,
			},
			batchExit: {
				text: "Exit",
				click: () => this.toggleBatchSelection(),
				className: `${clsBase} ${cls("exit-btn")}`,
			},
		};
	}

	private getToolbarComponentDefinitions() {
		return [
			{
				id: "searchInput",
				init: () => this.searchFilter.initialize(this.calendar!, this.container),
			},
			{
				id: "expressionFilter",
				init: () => this.expressionFilter.initialize(this.calendar!, this.container),
			},
			{
				id: "filterPresets",
				init: () => this.filterPresetSelector.initialize(this.calendar!, this.container),
			},
			{
				id: "untrackedEvents",
				init: () => {
					this.untrackedEventsDropdown = new UntrackedEventsDropdown(this.app, this.bundle);
					this.untrackedEventsDropdown.initialize(this.calendar!, this.container);
				},
			},
		];
	}

	private setMobileControlsCollapsed(collapsed: boolean): void {
		this.mobileControlsCollapsed = collapsed;
		this.applyMobileControlsCollapsedState();
	}

	private applyMobileControlsCollapsedState(): void {
		if (!this.container) return;

		const shouldCollapse = this.isMobileView() && this.mobileControlsCollapsed;
		this.container.classList.toggle(cls("mobile-controls-collapsed"), shouldCollapse);
		this.updateMobileControlsToggleButtonElement();
		this.scheduleStickyOffsetsUpdate();
	}

	private updateMobileControlsToggleButtonElement(): void {
		if (!this.container) return;
		const btn = this.container.querySelector(".fc-mobileControls-button");
		if (!(btn instanceof HTMLElement)) return;

		btn.classList.add(cls("mobile-controls-toggle"));
		btn.classList.toggle(cls("mobile-controls-toggle-expanded"), !this.mobileControlsCollapsed);
		btn.classList.toggle(cls("mobile-controls-toggle-collapsed"), this.mobileControlsCollapsed);
	}

	private shouldShowMobileControlsToggle(toolbarButtons: Set<string>): boolean {
		return (
			toolbarButtons.has("zoomLevel") ||
			toolbarButtons.has("filterPresets") ||
			toolbarButtons.has("searchInput") ||
			toolbarButtons.has("expressionFilter")
		);
	}

	private ensureMobileControlsExpanded(): void {
		if (!this.isMobileView()) return;
		if (!this.mobileControlsCollapsed) return;
		this.mobileControlsCollapsed = false;
		this.applyMobileControlsCollapsedState();
	}

	private scheduleStickyOffsetsUpdate(): void {
		if (this.stickyOffsetsRafId !== null) return;
		this.stickyOffsetsRafId = requestAnimationFrame(() => {
			this.stickyOffsetsRafId = null;
			this.updateStickyOffsets();
		});
	}

	private updateStickyOffsets(): void {
		if (!this.container) return;

		const toolbar = this.container.querySelector(".fc-header-toolbar.fc-toolbar");
		const toolbarEl = toolbar instanceof HTMLElement ? toolbar : null;
		const toolbarRect = toolbarEl?.getBoundingClientRect();
		const toolbarHeight = toolbarRect ? Math.round(toolbarRect.height) : 0;
		const stickyToolbarOffset = Math.round(toolbarHeight);

		const dayHeaderCell = this.container.querySelector(".fc-col-header-cell");
		const dayHeaderEl = dayHeaderCell instanceof HTMLElement ? dayHeaderCell : null;
		const dayHeaderHeight = dayHeaderEl ? Math.round(dayHeaderEl.getBoundingClientRect().height) : 0;

		this.container.style.setProperty("--prisma-sticky-toolbar-offset", `${stickyToolbarOffset}px`);
		this.container.style.setProperty("--prisma-sticky-day-header-height", `${dayHeaderHeight}px`);
	}

	// ─── Event Count Buttons ─────────────────────────────────────

	private updateSkippedEventsButton(count: number): void {
		this.skippedEventsCount = count;
		this.applySkippedEventsButtonState();
	}

	private updateFilteredEventsButton(count: number): void {
		this.filteredEventsCount = count;
		this.applyFilteredEventsButtonState();
	}

	private applyFilteredEventsButtonState(): void {
		if (!this.calendar) return;
		const text = this.getFilteredEventsButtonText();
		const tooltip = `${this.filteredEventsCount} event${this.filteredEventsCount === 1 ? "" : "s"} filtered out by search or expression filters`;
		this.updateButtonElement(".fc-filteredEvents-button", text, this.filteredEventsCount > 0, tooltip);
	}

	private applySkippedEventsButtonState(): void {
		if (!this.calendar) return;
		const text = this.getSkippedEventsButtonText();
		const tooltip = `${this.skippedEventsCount} event${this.skippedEventsCount === 1 ? "" : "s"} hidden from calendar`;
		this.updateButtonElement(".fc-skippedEvents-button", text, this.skippedEventsCount > 0, tooltip);
	}

	private updateButtonElement(selector: string, text: string, isVisible: boolean, tooltip?: string): void {
		if (!this.container) return;
		const btn = this.container.querySelector(selector);
		if (!(btn instanceof HTMLElement)) {
			return;
		}

		// Only update if text has changed to prevent unnecessary DOM manipulation and duplication
		if (btn.textContent !== text) {
			btn.textContent = text;
		}

		if (tooltip !== undefined && btn.title !== tooltip) {
			btn.title = tooltip;
		}

		if (isVisible) {
			btn.classList.remove(cls("fc-button-hidden"));
			btn.classList.add(cls("fc-button-visible"));
		} else {
			btn.classList.remove(cls("fc-button-visible"));
			btn.classList.add(cls("fc-button-hidden"));
		}
	}

	private cleanupEventCountButtons(): void {
		if (!this.container) return;

		const cleanupButton = (selector: string) => {
			const btn = this.container?.querySelector(selector);
			if (btn instanceof HTMLElement) {
				btn.textContent = "";
				btn.title = "";
				btn.classList.remove(cls("fc-button-visible"));
				btn.classList.add(cls("fc-button-hidden"));
			}
		};

		cleanupButton(".fc-filteredEvents-button");
		cleanupButton(".fc-skippedEvents-button");
	}

	private getFilteredEventsButtonText(): string {
		return `${this.filteredEventsCount} filtered`;
	}

	private getSkippedEventsButtonText(): string {
		return `${this.skippedEventsCount} skipped`;
	}

	private getSelectedEventsButtonText(): string {
		return `${this.selectedEventsCount} selected`;
	}

	// ─── Event Refresh ───────────────────────────────────────────

	/**
	 * Debounced entry point for all event refreshes.
	 * Coalesces rapid calls into a single RAF and prevents re-entrance
	 * while a refresh is in progress (queues one pending refresh instead).
	 */
	private scheduleRefreshEvents(): void {
		if (this.isRefreshingEvents) {
			this.pendingRefreshRequest = true;
			return;
		}
		if (this.refreshRafId !== null) return;

		this.refreshRafId = requestAnimationFrame(() => {
			this.refreshRafId = null;
			this.isRefreshingEvents = true;
			this.pendingRefreshRequest = false;
			void this.refreshEvents();
		});
	}

	private releaseRefreshLock(): void {
		this.isRefreshingEvents = false;
		if (this.pendingRefreshRequest) {
			this.pendingRefreshRequest = false;
			this.scheduleRefreshEvents();
		}
	}

	private async refreshEvents(): Promise<void> {
		if (!this.calendar || !this.isIndexingComplete || !this.calendar.view) {
			this.releaseRefreshLock();
			return;
		}

		const { view } = this.calendar;

		// Capture scroll position before touching events (needed for structural changes)
		const viewContent = this.hostEl.querySelector(".prisma-tab-content") ?? this.hostEl.querySelector(".view-content");
		const innerScroller = this.container.querySelector(".fc-scroller");
		const viewContentScrollTop = viewContent?.scrollTop ?? 0;
		const innerScrollTop = innerScroller?.scrollTop ?? 0;

		let hasStructuralChanges = false;

		try {
			const calendarEvents = await this.buildCalendarEvents(view);

			if (!this.hasPerformedInitialLoad) {
				this.performInitialLoad(calendarEvents);
				hasStructuralChanges = true;
			} else {
				hasStructuralChanges = this.performIncrementalUpdate(calendarEvents);
			}
		} catch (error) {
			console.error("[CalendarView] Error refreshing calendar events:", error);
		}

		if (hasStructuralChanges) {
			requestAnimationFrame(() => {
				const viewContentRestored =
					this.hostEl.querySelector(".prisma-tab-content") ?? this.hostEl.querySelector(".view-content");
				const inner = this.container.querySelector(".fc-scroller");

				if (viewContentRestored) {
					viewContentRestored.scrollTop = viewContentScrollTop;
				}

				if (inner) {
					inner.scrollTop = innerScrollTop;
				}

				this.releaseRefreshLock();
			});
		} else {
			this.releaseRefreshLock();
		}
	}

	private async buildCalendarEvents(view: { activeStart: Date; activeEnd: Date }): Promise<FCPrismaEventInput[]> {
		const start = toLocalISOString(view.activeStart);
		const end = toLocalISOString(view.activeEnd);

		const nonSkipped = await this.bundle.eventStore.getEvents({ start, end });
		const skippedCount = this.bundle.eventStore.countSkippedEvents({ start, end });
		this.updateSkippedEventsButton(skippedCount);

		const visibleEvents: CalendarEvent[] = [];
		const filteredEvents: CalendarEvent[] = [];

		for (const event of nonSkipped) {
			const passesFilters =
				this.searchFilter.shouldInclude({ meta: event.meta, title: event.title }) &&
				this.expressionFilter.shouldInclude(event);

			(passesFilters ? visibleEvents : filteredEvents).push(event);
		}

		this.filteredEvents = filteredEvents;
		this.updateFilteredEventsButton(filteredEvents.length);

		// Build color-dot index while mapping events (avoids a second O(n) pass)
		this.colorDotIndex.clear();

		const settings = this.bundle.settingsStore.currentSettings;

		return visibleEvents.map((event) => {
			const classNames = ["regular-event"];
			if (isAnyVirtual(event.virtualKind)) {
				classNames.push(cls("virtual-event"));
			}
			const allColors = this.getAllEventColors(event);
			const primaryColor = allColors[0] ?? settings.defaultNodeColor;
			const displayColor = settings.colorMode === "off" ? settings.defaultNodeColor : primaryColor;

			const start = stripZ(event.start);
			const end = isTimedEvent(event) ? stripZ(event.end) : undefined;

			// Index color by date for O(1) color-dot lookup
			const dateKey = start.slice(0, 10);
			let colorSet = this.colorDotIndex.get(dateKey);
			if (!colorSet) {
				colorSet = new Set();
				this.colorDotIndex.set(dateKey, colorSet);
			}
			colorSet.add(primaryColor);

			const folder = event.meta?.["folder"];
			const folderStr = typeof folder === "string" ? folder : "";
			const meta = event.meta ?? {};

			return {
				id: event.id,
				title: event.title,
				start,
				end,
				allDay: event.allDay,
				extendedProps: {
					filePath: event.ref.filePath,
					folder: folderStr,
					originalTitle: event.title,
					frontmatterDisplayData: meta,
					virtualKind: event.virtualKind,
					...(event.virtualKind === "manual" ? { virtualEventId: event.id } : {}),
					computedColors: allColors,
					frontmatterHash: hashFrontmatter(meta),
					skipped: event.skipped,
				},
				backgroundColor: displayColor,
				borderColor: displayColor,
				className: classNames.join(" "),
			} as FCPrismaEventInput;
		});
	}

	private performInitialLoad(calendarEvents: FCPrismaEventInput[]): void {
		this.calendar!.removeAllEvents();

		this.calendar!.batchRendering(() => {
			for (const ev of calendarEvents) {
				this.calendar!.addEvent(ev);
			}
		});
		this.populateRenderedEventsCache(calendarEvents);
		this.hasPerformedInitialLoad = true;
		this.updateColorDots();
	}

	/**
	 * Diff against currently rendered events and apply only the changes.
	 * Returns true if structural changes (adds/removes) occurred.
	 */
	private performIncrementalUpdate(calendarEvents: FCPrismaEventInput[]): boolean {
		const diff = diffEvents(this.renderedEvents, calendarEvents);

		if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
			return false;
		}

		// When a large fraction of events changed (e.g., month→week switch),
		// a single removeAllEvents + batch add is faster than N individual removes.
		const totalChurn = diff.added.length + diff.removed.length + diff.changed.length;
		const renderedCount = this.renderedEvents.size;
		if (renderedCount > 0 && totalChurn / renderedCount > 0.5) {
			this.performInitialLoad(calendarEvents);
			return true;
		}

		for (const id of diff.removed) {
			this.removeAllFCEventsById(id);
		}
		for (const ev of diff.changed) {
			this.removeAllFCEventsById(ev.id as string);
		}

		// Add events inside batchRendering to consolidate into one render pass
		this.calendar!.batchRendering(() => {
			for (const ev of diff.changed) {
				this.calendar!.addEvent(ev);
			}

			for (const ev of diff.added) {
				this.calendar!.addEvent(ev);
			}
		});

		for (const id of diff.removed) {
			this.renderedEvents.delete(id);
		}
		for (const ev of [...diff.added, ...diff.changed]) {
			this.renderedEvents.set(ev.id as string, eventFingerprint(ev));
		}

		this.updateColorDots();
		return diff.added.length > 0 || diff.removed.length > 0;
	}

	/**
	 * Remove ALL FullCalendar events with the given ID.
	 * FC allows duplicates — getEventById only returns the first,
	 * so we loop until none remain.
	 */
	private removeAllFCEventsById(id: string): void {
		let fcEvent = this.calendar!.getEventById(id);
		while (fcEvent) {
			fcEvent.remove();
			fcEvent = this.calendar!.getEventById(id);
		}
	}

	private populateRenderedEventsCache(events: FCPrismaEventInput[]): void {
		this.renderedEvents.clear();
		for (const ev of events) {
			this.renderedEvents.set(ev.id as string, eventFingerprint(ev));
		}
	}

	private clearRenderedEventsCache(): void {
		this.renderedEvents.clear();
		this.hasPerformedInitialLoad = false;
		this.colorDotSnapshot = "";
	}

	// ─── Event Rendering ─────────────────────────────────────────

	private getEventRenderContext(): EventRenderContext {
		return {
			app: this.app,
			settings: this.bundle.settingsStore.currentSettings,
			isMobile: this.isMobileView(),
			calendarIconCache: this.calendarIconCache,
		};
	}

	private getEventColor(event: Pick<CalendarEvent, "meta">): string {
		return resolveEventColor(event.meta ?? {}, this.bundle, this.colorEvaluator);
	}

	private getAllEventColors(event: Pick<CalendarEvent, "meta">): string[] {
		return resolveAllEventColors(event.meta ?? {}, this.bundle, this.colorEvaluator);
	}

	private handleEventMount(info: EventMountInfo): void {
		if (isAnyVirtual(getVirtualKind(info.event))) {
			info.el.classList.add(cls("virtual-event-italic"));
		}

		const element = info.el;
		const event = info.event;
		const settings = this.bundle.settingsStore.currentSettings;

		const allColors = event.extendedProps.computedColors ?? [];
		const eventColor = allColors[0] || this.getEventColor({ meta: event.extendedProps.frontmatterDisplayData ?? {} });

		const textColorCache = applyEventMountStyling(element, event, settings, eventColor, allColors, {
			rgb: this.cachedTextColorRgb,
			source: this.cachedTextColorSource,
		});
		this.cachedTextColorRgb = textColorCache.rgb;
		this.cachedTextColorSource = textColorCache.source;

		const filePath = event.extendedProps?.["filePath"];
		if (filePath && isFileBackedEvent(event)) {
			attachLazyNotePreview(element, filePath as string, this.app);
		}
	}

	private updateColorDots(): void {
		if (!this.calendar) return;

		const settings = this.bundle.settingsStore.currentSettings;
		const viewType = this.calendar.view?.type;
		const shouldRender = settings.showColorDots && viewType === "dayGridMonth";

		// Build a snapshot string from the index to detect changes cheaply
		const snapshot = shouldRender ? this.buildColorDotSnapshot() : "";
		if (snapshot === this.colorDotSnapshot) return;
		this.colorDotSnapshot = snapshot;

		// Batch remove existing dots
		for (const dot of Array.from(this.container.querySelectorAll(`.${cls("day-color-dots")}`))) {
			dot.remove();
		}

		if (!shouldRender) return;

		const dayCells = Array.from(this.container.querySelectorAll(".fc-daygrid-day"));
		const maxDots = this.isMobileView() ? 6 : 8;

		for (const dayCell of dayCells) {
			const dateAttr = dayCell.getAttribute("data-date");
			if (!dateAttr) continue;

			// O(1) lookup from pre-built index instead of filtering all events
			const colors = this.colorDotIndex.get(dateAttr);
			if (!colors || colors.size === 0) continue;

			const frag = document.createDocumentFragment();
			frag.appendChild(buildColorDotsContainer([...colors], maxDots));
			dayCell.querySelector(".fc-daygrid-day-top")?.appendChild(frag);
		}
	}

	private buildColorDotSnapshot(): string {
		const parts: string[] = [];
		for (const [date, colors] of this.colorDotIndex) {
			parts.push(`${date}:${[...colors].join(",")}`);
		}
		return parts.join("|");
	}

	// ─── Event Interaction ───────────────────────────────────────

	private handleEventClick(
		info: {
			event: Pick<CalendarEventData, "title" | "extendedProps" | "start" | "end" | "allDay">;
		},
		eventEl: HTMLElement
	): void {
		const event = info.event;
		const filePath = event.extendedProps.filePath;
		const virtualKind = event.extendedProps.virtualKind;

		if (virtualKind === "holiday") {
			return;
		}

		if (virtualKind === "recurring" && this.handleRecurringEventClick(event)) {
			return;
		}

		if (this.isMobileView()) {
			this.handleMobileEventClick(event, eventEl);
			return;
		}

		if (filePath && typeof filePath === "string") {
			void this.app.workspace.openLinkText(filePath, "", false);
		}
	}

	private handleRecurringEventClick(event: Pick<CalendarEventData, "title" | "extendedProps">): boolean {
		const filePath = event.extendedProps.filePath;
		if (!filePath || typeof filePath !== "string") return false;

		const sourceFile = this.app.vault.getAbstractFileByPath(filePath);
		if (!(sourceFile instanceof TFile)) return false;

		const cache = this.app.metadataCache.getFileCache(sourceFile);
		if (!cache?.frontmatter) return false;

		const previewEvent: PreviewEventData = {
			title: event.title,
			start: null,
			end: null,
			allDay: false,
			extendedProps: {
				filePath,
				frontmatterDisplayData: cache.frontmatter,
			},
		};
		showEventPreviewModal(this.app, this.bundle, previewEvent);
		return true;
	}

	private handleMobileEventClick(
		event: Pick<CalendarEventData, "title" | "extendedProps" | "start" | "end" | "allDay">,
		eventEl: HTMLElement
	): void {
		const currentTime = Date.now();
		const timeSinceLastTap = currentTime - this.lastMobileTapTime;

		// Double tap — open the note
		if (timeSinceLastTap < DOUBLE_TAP_DELAY_MS && timeSinceLastTap > 0) {
			this.lastMobileTapTime = 0;
			const filePath = event.extendedProps.filePath;
			if (filePath && typeof filePath === "string") {
				void this.app.workspace.openLinkText(filePath, "", false);
			}
			return;
		}

		// Single tap — show context menu
		this.lastMobileTapTime = currentTime;
		const rect = eventEl.getBoundingClientRect();
		this.eventContextMenu.show({ x: rect.left + rect.width / 2, y: rect.top }, { event }, eventEl, this.container);
	}

	private handleDateClick(info: { date: Date; allDay: boolean }): void {
		const clickedDate = info.date;
		const isAllDay = info.allDay;
		const settings = this.bundle.settingsStore.currentSettings;

		const endDate = new Date(clickedDate);
		endDate.setMinutes(endDate.getMinutes() + settings.defaultDurationMinutes);

		const newEvent = {
			title: "",
			start: toLocalISOString(clickedDate),
			end: isAllDay ? null : toLocalISOString(endDate),
			allDay: isAllDay,
			extendedProps: {
				filePath: null as string | null,
			},
		};

		new EventCreateModal(this.app, this.bundle, newEvent).open();
		this.calendar?.unselect();
	}

	private handleDateSelection(info: { start: Date; end: Date; allDay: boolean }): void {
		const newEvent = {
			title: "",
			start: toLocalISOString(info.start),
			end: toLocalISOString(info.end),
			allDay: info.allDay,
			extendedProps: {
				filePath: null as string | null,
			},
		};

		new EventCreateModal(this.app, this.bundle, newEvent).open();
		this.calendar?.unselect();
	}

	openCreateEventModal(autoStartStopwatch = false): void {
		// If starting a new stopwatch, first stop and save any currently running stopwatch event
		if (autoStartStopwatch && MinimizedModalManager.hasMinimizedModal()) {
			MinimizedModalManager.stopAndSaveCurrentEvent(this.app, this.bundle.plugin.calendarBundles);
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const now = new Date();
		const roundedStart = roundToNearestHour(now);

		const endDate = new Date(roundedStart);
		endDate.setMinutes(endDate.getMinutes() + settings.defaultDurationMinutes);

		const newEvent = {
			title: "",
			start: toLocalISOString(roundedStart),
			end: toLocalISOString(endDate),
			allDay: false,
			extendedProps: {
				filePath: null as string | null,
			},
		};

		const modal = new EventCreateModal(this.app, this.bundle, newEvent);

		if (autoStartStopwatch) {
			modal.setAutoStartStopwatch(true);
		}

		modal.open();
	}

	openEditModalForFocusedEvent(): void {
		if (!this.lastFocusedEventInfo) {
			return;
		}

		const event = this.lastFocusedEventInfo;

		const eventInfo =
			event.extendedProps?.virtualKind === "recurring"
				? getSourceEventInfoFromVirtual(event, this.bundle.eventStore)
				: {
						title: event.title,
						start: event.start,
						end: event.end,
						allDay: event.allDay,
						extendedProps: {
							...event.extendedProps,
							frontmatterDisplayData: event.extendedProps.frontmatterDisplayData ?? {},
						},
					};

		if (!eventInfo) {
			return;
		}

		this.eventContextMenu.openEditModal(eventInfo);
	}

	// ─── Focused Event Actions ───────────────────────────────────

	setFocusedEventStartToNow(): void {
		this.fillFocusedEventTime(
			(settings) => settings.startProp,
			() => toLocalISOString(new Date())
		);
	}

	setFocusedEventEndToNow(): void {
		this.fillFocusedEventTime(
			(settings) => settings.endProp,
			() => toLocalISOString(new Date())
		);
	}

	fillFocusedEventStartFromPrevious(): void {
		this.fillFocusedEventTime(
			(settings) => settings.startProp,
			(event, filePath) => {
				const previousEvent = findAdjacentEvent(this.bundle.eventStore, event.start, filePath, "previous");
				return previousEvent && isTimedEvent(previousEvent) ? previousEvent.end : undefined;
			}
		);
	}

	fillFocusedEventEndFromNext(): void {
		this.fillFocusedEventTime(
			(settings) => settings.endProp,
			(event, filePath) => {
				const nextEvent = findAdjacentEvent(this.bundle.eventStore, event.start, filePath, "next");
				return nextEvent?.start;
			}
		);
	}

	private fillFocusedEventTime(
		propertyGetter: (settings: SingleCalendarConfig) => string,
		timeValueGetter: (event: CalendarEventData, filePath: string) => string | undefined
	): void {
		if (!this.lastFocusedEventInfo) {
			return;
		}

		const event = this.lastFocusedEventInfo;

		if (isAnyVirtual(getVirtualKind(event))) {
			return;
		}

		const filePath = event.extendedProps?.filePath;
		if (!filePath || typeof filePath !== "string") {
			return;
		}

		const timeValue = timeValueGetter(event, filePath);
		if (!timeValue) {
			return;
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const propertyName = propertyGetter(settings);

		void this.bundle.commandManager.executeCommand(fillTime(this.bundle, filePath, propertyName, timeValue));
	}

	// ─── Drag & Drop ─────────────────────────────────────────────

	private async handleEventDrop(info: {
		event: CalendarEventData;
		oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay">;
		revert: () => void;
	}): Promise<void> {
		const updateInfo = this.extractEventUpdateInfo(info);
		if (updateInfo) {
			await this.handleEventUpdate(updateInfo, "Error updating event dates:");
		}
	}

	private async handleEventResize(info: {
		event: CalendarEventData;
		oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay">;
		revert: () => void;
	}): Promise<void> {
		const updateInfo = this.extractEventUpdateInfo(info);
		if (updateInfo) {
			await this.handleEventUpdate(updateInfo, "Error updating event duration:");
		}
	}

	private async handleEventUpdate(info: EventUpdateInfo, errorMessage: string): Promise<void> {
		if (isAnyVirtual(getVirtualKind(info.event))) {
			info.revert();
			return;
		}

		const filePath = info.event.extendedProps.filePath;
		if (!filePath || typeof filePath !== "string") {
			console.error("[CalendarView] No file path found for event");
			info.revert();
			return;
		}

		try {
			const newDateTime: EventDateTime = {
				start: toLocalISOString(info.event.start),
				end: info.event.end ? toLocalISOString(info.event.end) : undefined,
				allDay: info.event.allDay || false,
			};
			const oldDateTime: EventDateTime = {
				start: toLocalISOString(info.oldEvent.start),
				end: info.oldEvent.end ? toLocalISOString(info.oldEvent.end) : undefined,
				allDay: info.oldEvent.allDay || false,
			};
			const command = new UpdateEventCommand(this.app, this.bundle, filePath, newDateTime, oldDateTime);

			await this.bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error(`[CalendarView] ${errorMessage}`, error);
			info.revert();
		}
	}

	/**
	 * Extracts plain object data from FullCalendar EventApi objects.
	 * EventApi uses getters on the prototype, so spread operator doesn't work.
	 */
	private extractEventUpdateInfo(info: {
		event: CalendarEventData;
		oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay">;
		revert: () => void;
	}): EventUpdateInfo | null {
		if (!info.event.start) {
			info.revert();
			return null;
		}

		return {
			event: {
				title: info.event.title,
				start: info.event.start,
				end: info.event.end,
				allDay: info.event.allDay,
				extendedProps: info.event.extendedProps,
			},
			oldEvent: {
				start: info.oldEvent.start || new Date(),
				end: info.oldEvent.end,
				allDay: info.oldEvent.allDay,
			},
			revert: info.revert,
		};
	}

	private handleGlobalPointerUpForUntrackedDrop = (e: PointerEvent): void => {
		if (!this.isDraggingCalendarEvent || !this.draggingCalendarEventFilePath) return;

		// If dropdown was temporarily hidden during drag, restore it before hit-testing.
		this.untrackedEventsDropdown?.restoreIfTemporarilyHidden();

		const x = e.clientX;
		const y = e.clientY;

		const buttonEl = this.container?.querySelector(`.${cls("untracked-dropdown-button")}`);
		const dropdownEl = this.container?.querySelector(`.${cls("untracked-dropdown")}`);

		const hitByRect = isPointInsideElement(x, y, buttonEl) || isPointInsideElement(x, y, dropdownEl);

		if (!hitByRect) return;

		// Prevent the trailing click after pointerup from being treated as an outside click and closing the dropdown.
		this.untrackedEventsDropdown?.ignoreOutsideClicksFor(POINTER_UP_IGNORE_CLICKS_DELAY_MS);

		void this.moveCalendarEventToUntracked(this.draggingCalendarEventFilePath);
	};

	private async moveCalendarEventToUntracked(filePath: string): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;

		const propertyUpdates = new Map<string, string | null>();
		propertyUpdates.set(settings.startProp, null);
		propertyUpdates.set(settings.endProp, null);
		propertyUpdates.set(settings.dateProp, null);
		propertyUpdates.set(settings.allDayProp, null);

		const command = updateFrontmatter(this.bundle, filePath, propertyUpdates);
		await this.bundle.commandManager.executeCommand(command);
	}

	private async handleExternalDrop(info: DropArg): Promise<void> {
		const filePath = info.draggedEl.getAttribute("data-file-path");

		if (filePath) {
			try {
				const file = this.app.vault.getAbstractFileByPath(filePath);

				if (file instanceof TFile) {
					const settings = this.bundle.settingsStore.currentSettings;
					const localISO = toLocalISOString(info.date);
					const dateStr = localISO.split("T")[0];
					const timeStr = localISO.split("T")[1];

					const propertyUpdates = new Map<string, string | null>();

					if (info.allDay) {
						propertyUpdates.set(settings.dateProp, dateStr);
						propertyUpdates.set(settings.allDayProp, "true");
						propertyUpdates.set(settings.startProp, null);
						propertyUpdates.set(settings.endProp, null);
					} else {
						const startDateTime = `${dateStr}T${timeStr}`;
						const endTime = calculateEndTime(timeStr, settings.defaultDurationMinutes);
						const endDateTime = `${dateStr}T${endTime}`;

						propertyUpdates.set(settings.startProp, startDateTime);
						propertyUpdates.set(settings.endProp, endDateTime);
						propertyUpdates.set(settings.allDayProp, "false");
						propertyUpdates.set(settings.dateProp, null);
					}

					const command = updateFrontmatter(this.bundle, filePath, propertyUpdates);
					await this.bundle.commandManager.executeCommand(command);
				}
			} catch (error) {
				console.error("[CalendarView] Error handling drop:", error);
			}
		}
	}

	private setupDragEdgeScrolling(): void {
		if (!this.calendar || !this.container) return;

		const viewType = this.calendar.view.type;
		if (viewType === "dayGridMonth" || viewType === "listWeek") {
			return;
		}

		const EDGE_THRESHOLD = DRAG_EDGE_THRESHOLD_PX;
		const scrollDelay = this.bundle.settingsStore.currentSettings.dragEdgeScrollDelayMs;

		this.dragEdgeScrollListener = (e: MouseEvent) => {
			if (!this.calendar || !this.container) return;

			const rect = this.container.getBoundingClientRect();
			const mouseX = e.clientX;
			const leftEdge = rect.left;
			const rightEdge = rect.right;

			const now = Date.now();
			if (now - this.lastEdgeScrollTime < scrollDelay) {
				return;
			}

			if (mouseX < leftEdge + EDGE_THRESHOLD) {
				this.lastEdgeScrollTime = now;
				this.calendar.prev();
			} else if (mouseX > rightEdge - EDGE_THRESHOLD) {
				this.lastEdgeScrollTime = now;
				this.calendar.next();
			}
		};

		document.addEventListener("mousemove", this.dragEdgeScrollListener);
	}

	private cleanupDragEdgeScrolling(): void {
		if (this.dragEdgeScrollListener) {
			document.removeEventListener("mousemove", this.dragEdgeScrollListener);
			this.dragEdgeScrollListener = null;
		}
		if (this.dragEdgeScrollTimeout) {
			clearTimeout(this.dragEdgeScrollTimeout);
			this.dragEdgeScrollTimeout = null;
		}
		this.lastEdgeScrollTime = 0;
	}

	private setupMouseTracking(container: HTMLElement): void {
		container.addEventListener("mousedown", () => {
			this.mouseDownTime = Date.now();
		});
	}

	// ─── Navigation ──────────────────────────────────────────────

	navigateToDate(date: Date, viewType?: string): void {
		if (!this.calendar) return;

		if (viewType) {
			this.calendar.changeView(viewType, date);
		} else {
			this.calendar.gotoDate(date);
		}
	}

	goToToday(): void {
		if (!this.calendar) return;
		this.calendar.today();
	}

	navigateBack(): boolean {
		if (!this.calendar) return false;
		return this.navigationHistory.navigate("back", (e) => this.calendar!.changeView(e.viewType, e.date));
	}

	navigateForward(): boolean {
		if (!this.calendar) return false;
		return this.navigationHistory.navigate("forward", (e) => this.calendar!.changeView(e.viewType, e.date));
	}

	scrollToNow(): void {
		if (!this.calendar) return;

		const currentView = this.calendar.view.type;
		let targetElement: Element | null = null;

		if (currentView === "timeGridWeek" || currentView === "timeGridDay") {
			// For time grid views, find the now indicator line
			targetElement = this.container.querySelector(".fc-timegrid-now-indicator-line");
		} else if (currentView === "dayGridMonth") {
			// For month view, find today's cell
			targetElement = this.container.querySelector(".fc-day-today");
		}

		// Center the target element if found
		if (targetElement) {
			this.scrollElementToCenter(targetElement);
		}
	}

	private scrollElementToCenter(element: Element): void {
		const viewContent = this.hostEl.querySelector(".prisma-tab-content") ?? this.hostEl.querySelector(".view-content");
		if (!viewContent) return;

		const elementRect = element.getBoundingClientRect();
		const viewContentRect = viewContent.getBoundingClientRect();

		// Calculate scroll position to center the element
		const scrollTop =
			viewContent.scrollTop +
			elementRect.top -
			viewContentRect.top -
			viewContent.clientHeight / 2 +
			elementRect.height / 2;

		viewContent.scrollTop = scrollTop;
	}

	private recordNavigationState(): void {
		if (!this.calendar) return;
		this.navigationHistory.push({ date: new Date(this.calendar.getDate()), viewType: this.calendar.view.type });
	}

	// ─── Prerequisite Selection ──────────────────────────────────

	enterPrerequisiteSelectionMode(targetFilePath: string): void {
		if (this.batchSelectionManager?.isInSelectionMode()) {
			this.toggleBatchSelection();
		}
		getFileByPathOrThrow(this.app, targetFilePath);
		this.prerequisiteSelectionManager?.enter(targetFilePath);
	}

	// ─── Batch Selection ─────────────────────────────────────────

	toggleBatchSelection(): void {
		if (this.prerequisiteSelectionManager?.isInSelectionMode()) {
			this.prerequisiteSelectionManager.exit();
		}
		const wasInSelectionMode = this.batchSelectionManager?.isInSelectionMode() ?? false;
		this.batchSelectionManager?.toggleSelectionMode();

		// Refresh events when exiting batch mode to restore skipped events button
		if (wasInSelectionMode) {
			this.scheduleRefreshEvents();
		}
	}

	selectAll(): void {
		this.batchSelectionManager?.selectAllVisibleEvents();
	}

	clearSelection(): void {
		this.batchSelectionManager?.clearSelection();
	}

	skipSelection(): void {
		void this.batchSelectionManager?.executeSkip();
	}

	markAsDoneSelection(): void {
		void this.batchSelectionManager?.executeMarkAsDone();
	}

	markAsNotDoneSelection(): void {
		void this.batchSelectionManager?.executeMarkAsNotDone();
	}

	duplicateSelection(): void {
		void this.batchSelectionManager?.executeDuplicate();
	}

	cloneSelection(weeks: number): void {
		void this.batchSelectionManager?.executeClone(weeks);
	}

	moveSelection(weeks: number): void {
		void this.batchSelectionManager?.executeMove(weeks);
	}

	deleteSelection(): void {
		void this.batchSelectionManager?.executeDelete();
	}

	openSelection(): void {
		void this.batchSelectionManager?.executeOpenAll();
	}

	moveBySelection(): void {
		this.batchSelectionManager?.executeMoveBy();
	}

	async openCategoryAssignModal(): Promise<void> {
		if (!this.batchSelectionManager) return;

		const categories = this.bundle.categoryTracker.getCategoriesWithColors();
		const settings = this.bundle.settingsStore.currentSettings;
		const selectedEvents = this.batchSelectionManager.getSelectedEvents();
		const commonCategories = getCommonCategories(this.app, selectedEvents, settings.categoryProp);

		openCategoryAssignModal(this.app, categories, settings.defaultNodeColor, commonCategories, (selectedCategories) => {
			if (this.batchSelectionManager) {
				this.batchSelectionManager.executeAssignCategories(selectedCategories);
			}
		});
	}

	async openBatchFrontmatterModal(): Promise<void> {
		if (!this.batchSelectionManager) return;

		const settings = this.bundle.settingsStore.currentSettings;
		const selectedEvents = this.batchSelectionManager.getSelectedEvents();

		showBatchFrontmatterModal(this.app, settings, selectedEvents, (propertyUpdates: Map<string, string | null>) => {
			if (this.batchSelectionManager) {
				this.batchSelectionManager.executeUpdateFrontmatter(propertyUpdates);
			}
		});
	}

	// ─── Modals ──────────────────────────────────────────────────

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

				const start = toLocalISOString(view.activeStart);
				const end = toLocalISOString(view.activeEnd);
				const skippedEvents = this.bundle.eventStore.getSkippedEvents({
					start,
					end,
				});

				return new SkippedEventsModal(this.app, this.bundle, skippedEvents);
			}
		);
	}

	async showEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.eventsModal,
			(modal) => {
				this.eventsModal = modal;
			},
			() => {
				return new EventsModal(this.app, this.bundle, this);
			}
		);
	}

	async showFilteredEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.filteredEventsModal,
			(modal) => {
				this.filteredEventsModal = modal;
			},
			() => new FilteredEventsModal(this.app, this.bundle, this.filteredEvents)
		);
	}

	async showSelectedEventsModal(): Promise<void> {
		await this.toggleModal(
			() => this.selectedEventsModal,
			(modal) => {
				this.selectedEventsModal = modal;
			},
			() => {
				if (!this.batchSelectionManager) throw new Error("Batch selection manager not initialized");

				const selected = this.batchSelectionManager.getSelectedEvents();
				return new SelectedEventsModal(this.app, this.bundle, selected, (eventId: string) => {
					this.batchSelectionManager?.unselectEvent(eventId);
				});
			}
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

	async showDailyStatsModal(date?: Date): Promise<void> {
		await this.toggleModal(
			() => this.dailyStatsModal,
			(modal) => {
				this.dailyStatsModal = modal;
			},
			() => {
				const currentDate = date || this.calendar?.getDate() || new Date();
				const viewType = this.calendar?.view?.type;
				return new DailyStatsModal(this.app, this.bundle, currentDate, viewType);
			}
		);
	}

	async showWeeklyStatsModal(date?: Date): Promise<void> {
		await this.toggleModal(
			() => this.weeklyStatsModal,
			(modal) => {
				this.weeklyStatsModal = modal;
			},
			() => {
				const currentDate = date || this.calendar?.getDate() || new Date();
				return new WeeklyStatsModal(this.app, this.bundle, currentDate);
			}
		);
	}

	async showMonthlyStatsModal(date?: Date): Promise<void> {
		await this.toggleModal(
			() => this.monthlyStatsModal,
			(modal) => {
				this.monthlyStatsModal = modal;
			},
			() => {
				const currentDate = date || this.calendar?.getDate() || new Date();
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

	async showIntervalEventsModal(): Promise<void> {
		if (!this.calendar?.view) return;

		const view = this.calendar.view;
		const viewType = view.type;

		const adjustedStart = new Date(view.currentStart);
		adjustedStart.setMinutes(adjustedStart.getMinutes() - 1);
		const startDate = stripISOSuffix(toLocalISOString(adjustedStart));

		const adjustedEnd = new Date(view.currentEnd);
		adjustedEnd.setMinutes(adjustedEnd.getMinutes() - 1);
		const endDate = stripISOSuffix(toLocalISOString(adjustedEnd));

		const settings = this.bundle.settingsStore.currentSettings;
		const intervalLabel = this.formatIntervalLabel(viewType, view.currentStart, view.currentEnd, settings.locale);
		showIntervalEventsModal(this.app, intervalLabel, startDate, endDate, settings);
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

		const originalOnClose = modal.onClose.bind(modal) as () => void;
		modal.onClose = () => {
			originalOnClose();
			setModal(null);
		};

		modal.open();
	}

	// ─── Highlighting ─────────────────────────────────────────────

	highlightEventById(eventId: string, durationMs = EVENT_HIGHLIGHT_DURATION_MS): void {
		this.highlightElements(this.container.querySelectorAll<HTMLElement>(`[data-event-id="${eventId}"]`), durationMs);
	}

	highlightEventByPath(filePath: string, durationMs = EVENT_HIGHLIGHT_DURATION_MS): void {
		if (!this.calendar) return;
		const matchingIds = this.calendar
			.getEvents()
			.filter((event) => event.extendedProps?.["filePath"] === filePath)
			.map((event) => event.id);

		for (const id of matchingIds) {
			this.highlightEventById(id, durationMs);
		}
	}

	private highlightElements(elements: NodeListOf<HTMLElement>, durationMs: number): void {
		for (let i = 0; i < elements.length; i++) {
			const element = elements[i];
			element.classList.add(cls("event-highlighted"));
			setTimeout(() => {
				element.classList.remove(cls("event-highlighted"));
			}, durationMs);
		}
	}

	public toggleConnections(): void {
		if (
			!this.bundle.plugin.licenseManager.requirePro(
				PRO_FEATURES.PREREQUISITE_CONNECTIONS,
				getProGateUrls("PREREQUISITE_CONNECTIONS")
			)
		)
			return;
		this.showConnections = !this.showConnections;
		if (this.showConnections) {
			this.renderConnections();
			this.showConnectionBanner();
		} else {
			this.hideConnections();
		}
	}

	private hideConnections(): void {
		this.showConnections = false;
		this.connectionRenderer?.clear();
		this.removeConnectionBanner();
	}

	private showConnectionBanner(): void {
		this.removeConnectionBanner();
		this.connectionBanner = createStickyBanner(this.container, "Prerequisite connections enabled", () =>
			this.hideConnections()
		);
	}

	private removeConnectionBanner(): void {
		this.connectionBanner?.destroy();
		this.connectionBanner = null;
	}

	private renderConnections(): void {
		if (!this.connectionRenderer) {
			this.connectionRenderer = new ConnectionRenderer(this.container, this.bundle.settingsStore);
		}
		const { graph, eventIdMap } = buildDependencyGraph(
			this.bundle.eventStore.getAllEvents(),
			this.bundle.settingsStore.currentSettings,
			this.app
		);
		this.connectionRenderer.render(
			graph,
			eventIdMap,
			this.bundle.eventStore.getAllEvents(),
			this.currentViewStart,
			this.currentViewEnd
		);
	}

	public highlightEventsWithoutCategories(): void {
		this.highlightCategoryEvents(() => {
			const filesWithCategories = this.bundle.categoryTracker.getAllFilesWithCategories();
			return this.findEventIdsByPredicate((filePath) => !filesWithCategories.has(filePath));
		});
	}

	public showCategorySelectModal(): void {
		showCategorySelectModal(this.app, this.bundle.categoryTracker, (category: string) => {
			this.highlightEventsWithCategory(category);
		});
	}

	public highlightEventsWithCategory(category: string): void {
		this.highlightCategoryEvents(() => {
			const events = this.bundle.categoryTracker.getEventsWithCategory(category);
			const filePaths = new Set(events.map((e) => e.ref.filePath));
			return this.findEventIdsByPredicate((filePath) => filePaths.has(filePath));
		});
	}

	private highlightCategoryEvents(getEventIds: () => Set<string>): void {
		if (!this.calendar) return;

		const highlightClass = cls("event-category-highlight");
		this.clearCategoryHighlight();

		const eventIds = getEventIds();

		for (const eventId of eventIds) {
			toggleEventHighlight(eventId, highlightClass, true, this.container);
		}

		this.highlightedCategoryEvents = eventIds;
		this.currentCategoryHighlightClass = highlightClass;

		this.categoryHighlightTimeout = window.setTimeout(() => {
			this.clearCategoryHighlight();
		}, CATEGORY_HIGHLIGHT_DURATION_MS);
	}

	private clearCategoryHighlight(): void {
		if (this.categoryHighlightTimeout !== null) {
			window.clearTimeout(this.categoryHighlightTimeout);
			this.categoryHighlightTimeout = null;
		}

		if (this.currentCategoryHighlightClass !== null) {
			for (const eventId of this.highlightedCategoryEvents) {
				toggleEventHighlight(eventId, this.currentCategoryHighlightClass, false, this.container);
			}
			this.highlightedCategoryEvents.clear();
			this.currentCategoryHighlightClass = null;
		}
	}

	private findEventIdsByPredicate(predicate: (filePath: string) => boolean): Set<string> {
		if (!this.calendar) return new Set();

		return new Set(
			this.calendar
				.getEvents()
				.filter((event) => !isAnyVirtual(getVirtualKind(event)))
				.filter((event) => {
					const filePath = getFilePath(event);
					return filePath && predicate(filePath);
				})
				.map((event) => event.id)
		);
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
		}, UPCOMING_EVENT_CHECK_INTERVAL_MS);
	}

	private stopUpcomingEventCheck(): void {
		if (this.upcomingEventCheckInterval !== null) {
			window.clearInterval(this.upcomingEventCheckInterval);
			this.upcomingEventCheckInterval = null;
		}

		// Clear all highlighted upcoming events
		for (const eventId of this.currentUpcomingEventIds) {
			toggleEventHighlight(eventId, cls("event-upcoming"), false, this.container);
		}
		this.currentUpcomingEventIds.clear();
	}

	private updateUpcomingEventHighlight(): void {
		if (!this.calendar) return;

		const newUpcomingEventIds = this.findUpcomingEventIds();

		// Remove highlight from events that are no longer upcoming
		for (const oldId of this.currentUpcomingEventIds) {
			if (!newUpcomingEventIds.has(oldId)) {
				toggleEventHighlight(oldId, cls("event-upcoming"), false, this.container);
			}
		}

		// Always reapply highlight — DOM elements are recreated on FC re-renders
		for (const newId of newUpcomingEventIds) {
			toggleEventHighlight(newId, cls("event-upcoming"), true, this.container);
		}

		this.currentUpcomingEventIds = newUpcomingEventIds;
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

		// Single pass through rendered events: find active events AND track nearest upcoming.
		// Replaces the original triple-filter-then-sort with one loop.
		let nearestUpcomingId: string | null = null;
		let nearestUpcomingStart = Infinity;

		const events = this.calendar.getEvents();
		for (const event of events) {
			if (!event.start || event.allDay || isAnyVirtual(getVirtualKind(event))) continue;

			const eventEnd = event.end || event.start;

			if (event.start <= now && now <= eventEnd) {
				// Active event — currently happening
				result.add(event.id);
			} else if (result.size === 0 && event.start > now) {
				// Track nearest future event (only matters if no active events found)
				const startTime = event.start.getTime();
				if (startTime < nearestUpcomingStart) {
					nearestUpcomingStart = startTime;
					nearestUpcomingId = event.id;
				}
			}
		}

		// If no active events, highlight the nearest upcoming one
		if (result.size === 0 && nearestUpcomingId) {
			result.add(nearestUpcomingId);
		}

		return result;
	}

	// ─── Keyboard & Focus ────────────────────────────────────────

	private setupKeyboardShortcuts(): void {
		this.hostEl.setAttribute("tabindex", "-1");

		const keydownHandler = (e: KeyboardEvent) => {
			if (!this.calendar) return;

			// Skip when the calendar tab is not visible (hidden by tab container)
			if (!this.container.offsetParent) return;

			// Only handle arrow keys without any modifiers
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

			// Check if keyboard navigation is enabled
			const settings = this.bundle.settingsStore.currentSettings;
			if (!settings.enableKeyboardNavigation) return;

			// Don't navigate if any filter input is focused
			if (this.searchFilter.isFocused() || this.expressionFilter.isFocused()) return;

			if (e.key === "ArrowLeft") {
				e.preventDefault();
				this.calendar.prev();
			} else if (e.key === "ArrowRight") {
				e.preventDefault();
				this.calendar.next();
			}
		};

		this.hostEl.addEventListener("keydown", keydownHandler);

		this.hostEl.addEventListener("click", (e: MouseEvent) => {
			// Don't steal focus from input elements
			const target = e.target as HTMLElement;
			if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
				return;
			}
			this.hostEl.focus();
		});

		// Register cleanup
		this.register(() => {
			this.hostEl.removeEventListener("keydown", keydownHandler);
		});
	}

	openFilterPresetSelector(): void {
		this.ensureMobileControlsExpanded();
		this.filterPresetSelector.open();
	}

	toggleUntrackedEventsDropdown(): void {
		this.untrackedEventsDropdown?.toggle();
	}

	focusSearch(): void {
		this.ensureMobileControlsExpanded();
		this.searchFilter.focus();
	}

	focusExpressionFilter(): void {
		this.ensureMobileControlsExpanded();
		this.expressionFilter.focus();
	}

	// ─── State ───────────────────────────────────────────────────

	private saveCurrentState(): void {
		if (!this.calendar || this.isRestoring) return;

		const currentZoomLevel = this.zoomManager.getCurrentZoomLevel();
		this.bundle.viewStateManager.saveState(this.calendar, currentZoomLevel);
	}

	// ─── Utilities & Query API ───────────────────────────────────

	async undo(): Promise<boolean> {
		return await this.bundle.undo();
	}

	async redo(): Promise<boolean> {
		return await this.bundle.redo();
	}

	getViewContext(): { viewType: string; currentStart: Date; currentEnd: Date } | null {
		if (!this.calendar?.view) return null;
		return {
			viewType: this.calendar.view.type,
			currentStart: this.calendar.view.currentStart,
			currentEnd: this.calendar.view.currentEnd,
		};
	}

	getBundle(): CalendarBundle {
		return this.bundle;
	}

	refreshCalendar(): void {
		this.bundle.refreshCalendar();
	}

	isInBatchSelectionMode(): boolean {
		return this.batchSelectionManager?.isInSelectionMode() ?? false;
	}

	private formatIntervalLabel(viewType: string, currentStart: Date, currentEnd: Date, locale: string): string {
		if (viewType.includes("Day")) {
			return new Date(currentStart).toLocaleDateString(locale, {
				weekday: "long",
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		}
		if (viewType.includes("Week")) {
			const end = new Date(currentEnd);
			end.setDate(end.getDate() - 1);
			return `${new Date(currentStart).toLocaleDateString(locale, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}`;
		}
		if (viewType.includes("Month")) {
			return new Date(currentStart).toLocaleDateString(locale, {
				month: "long",
				year: "numeric",
			});
		}
		return "Current View";
	}

	private isMobileView(): boolean {
		return window.innerWidth <= 768;
	}
}
