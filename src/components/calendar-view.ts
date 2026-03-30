import { Calendar, type CustomButtonInput, type EventContentArg } from "@fullcalendar/core";
import allLocales from "@fullcalendar/core/locales-all";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type DropArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import {
	afterRender,
	calculateDuration,
	calculateEndTime,
	cls,
	ColorEvaluator,
	extractContentAfterFrontmatter,
	formatDuration,
	getNotePreviewLines,
	hasVeryCloseShadeFromRgb,
	MountableComponent,
	parseColorToRgb,
	type RgbColor,
	roundToNearestHour,
	toggleCls,
	toLocalISOString,
} from "@real1ty-obsidian-plugins";
import { type App, Component, type Modal, TFile, type WorkspaceLeaf } from "obsidian";

import type { CalendarBundle } from "../core/calendar-bundle";
import { fillTime, UpdateEventCommand, updateFrontmatter } from "../core/commands";
import { buildDependencyGraph } from "../core/dependency-graph";
import { PRO_FEATURES } from "../core/license";
import { MinimizedModalManager } from "../core/minimized-modal-manager";
import { getProGateUrls } from "../core/pro-feature-previews";
import type {
	CalendarEvent,
	CalendarEventData,
	EventMountInfo,
	EventUpdateInfo,
	ExtendedButtonInput,
	PrismaEventInput,
} from "../types/calendar";
import { isTimedEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/index";
import { getEventRenderingKey } from "../utils/calendar-settings";
import { isPointInsideElement, toggleEventHighlight } from "../utils/dom-utils";
import { resolveAllEventColors, resolveEventColor } from "../utils/event-color";
import { diffEvents, eventFingerprint, hashFrontmatter } from "../utils/event-diff";
import { getCommonCategories, stripISOSuffix } from "../utils/event-frontmatter";
import { findAdjacentEvent, getSourceEventInfoFromVirtual } from "../utils/event-matching";
import { cleanupTitle } from "../utils/event-naming";
import { invalidatePropertyExtractionCache } from "../utils/expression-utils";
import { buildEventTooltip } from "../utils/format";
import { stripZ } from "../utils/iso";
import { emitHover, getFileByPathOrThrow } from "../utils/obsidian";
import { getDisplayProperties, renderPropertyValue } from "../utils/property-display";
import { BatchSelectionManager } from "./batch-selection-manager";
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
	private previousViewState: { date: Date; viewType: string } | null = null;
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
		const indexingCompleteSubscription = this.bundle.indexer.indexingComplete$.subscribe((isComplete) => {
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

			headerToolbar: false, // Initially false, will be set by updateToolbar

			eventContent: (arg) => {
				return this.renderEventContent(arg);
			},

			eventClassNames: (arg) => {
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

				const classes = [];
				if (isPast) {
					const contrast = this.bundle.settingsStore.currentSettings.pastEventContrast;
					if (contrast === 0) {
						classes.push(cls("past-event-hidden"));
					} else if (contrast < 100) {
						classes.push(cls("past-event-faded"));
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

			dayMaxEvents: this.isMobileView() ? settings.mobileMaxEventsPerDay : settings.desktopMaxEventsPerDay || false,

			windowResize: () => {
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
			},

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
				return !draggedEvent?.extendedProps["isVirtual"];
			},

			eventClick: (info) => {
				if (this.prerequisiteSelectionManager?.isInSelectionMode()) {
					if (!info.event.extendedProps["isVirtual"]) {
						this.prerequisiteSelectionManager.handleEventClick(info.event.id);
					}
				} else if (this.batchSelectionManager?.isInSelectionMode()) {
					if (!info.event.extendedProps["isVirtual"]) {
						this.batchSelectionManager.handleEventClick(info.event.id);
					}
				} else {
					this.handleEventClick(info, info.el);
				}
			},

			eventDidMount: (info) => {
				if (info.event.extendedProps["isVirtual"]) {
					info.el.classList.add(cls("virtual-event-opacity"), cls("virtual-event-cursor"));
					const isHoliday = (info.event.extendedProps["filePath"] as string | undefined)?.startsWith("holiday:");
					info.el.title = isHoliday ? "Holiday (read-only)" : "Virtual recurring event (read-only)";
					if (isHoliday) {
						info.el.classList.add(cls("holiday-event"));
					}
				} else {
					this.batchSelectionManager?.handleEventMount(info.event.id, info.el);
				}
				this.handleEventMount(info);

				// Context menu — registered once per element (eventDidMount), not on every hover
				info.el.addEventListener("contextmenu", (e) => {
					e.preventDefault();
					this.eventContextMenu.show(e, info, info.el, this.container);
				});

				// Hover preview — registered once per element for non-virtual events
				if (!info.event.extendedProps["isVirtual"]) {
					const filePath = info.event.extendedProps["filePath"] as string | undefined;
					if (filePath) {
						info.el.addEventListener("mouseenter", (e) => {
							const settings = this.bundle.settingsStore.currentSettings;
							if (settings.enableEventPreview) {
								emitHover(this.app, this.container, info.el, e, filePath, this.bundle.calendarId);
							}
						});
					}
				}
			},

			eventMouseEnter: (info) => {
				this.lastFocusedEventInfo = info.event;
			},

			eventDragStart: (info) => {
				this.dragNavigatedInterval = false;
				this.setupDragEdgeScrolling();
				const filePath = info.event.extendedProps?.["filePath"];
				const isVirtual = info.event.extendedProps?.["isVirtual"] ?? false;
				this.isDraggingCalendarEvent = !isVirtual && typeof filePath === "string" && filePath.length > 0;
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
				const CLICK_THRESHOLD_MS = 150; // 150ms or less = click, more = drag

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
		this.prerequisiteSelectionManager = new PrerequisiteSelectionManager(
			this.app,
			this.calendar,
			this.bundle,
			this.container
		);
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
			}, 500);
		}

		setTimeout(() => {
			if (this.calendar) {
				this.calendar.updateSize();
			}
			this.scheduleStickyOffsetsUpdate();
		}, 100);

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

		void afterRender().then(() => {
			if (!inSelectionMode) {
				this.applyFilteredEventsButtonState();
				this.applySkippedEventsButtonState();
				this.zoomManager.updateZoomLevelButton();
			}
			this.scheduleStickyOffsetsUpdate();
		});
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

	private async buildCalendarEvents(view: { activeStart: Date; activeEnd: Date }): Promise<PrismaEventInput[]> {
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
			if (event.isVirtual) {
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
					isVirtual: event.isVirtual,
					computedColors: allColors,
					frontmatterHash: hashFrontmatter(meta),
				},
				backgroundColor: displayColor,
				borderColor: displayColor,
				className: classNames.join(" "),
			} as PrismaEventInput;
		});
	}

	private performInitialLoad(calendarEvents: PrismaEventInput[]): void {
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
	private performIncrementalUpdate(calendarEvents: PrismaEventInput[]): boolean {
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

	private populateRenderedEventsCache(events: PrismaEventInput[]): void {
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

	private renderEventContent(arg: EventContentArg): {
		domNodes: HTMLElement[];
	} {
		const event = arg.event;
		const isMobile = this.isMobileView();
		const isMonthView = arg.view.type === "dayGridMonth";

		// Don't create our own fc-event-main - FullCalendar already provides one
		const container = document.createElement("div");
		container.className = cls("fc-event-content-wrapper");

		const settings = this.bundle.settingsStore.currentSettings;
		const displayData = event.extendedProps["frontmatterDisplayData"];
		const isSourceRecurring = displayData?.[settings.rruleProp];
		const isPhysicalRecurring = displayData?.[settings.sourceProp];
		const isHoliday = (event.extendedProps["filePath"] as string | undefined)?.startsWith("holiday:");

		const { userIcon, integrationIcon } = this.getEventIcon(event);

		// Precedence: user icon > recurring markers > integration icons > holiday
		const hasRecurringMarker =
			(isSourceRecurring && settings.showSourceRecurringMarker) ||
			(isPhysicalRecurring && settings.showPhysicalRecurringMarker);

		if (userIcon || hasRecurringMarker || integrationIcon || isHoliday) {
			const markerEl = document.createElement("div");
			markerEl.className = cls("event-marker");

			if (userIcon) {
				markerEl.textContent = userIcon;
			} else if (isSourceRecurring && settings.showSourceRecurringMarker) {
				markerEl.textContent = settings.sourceRecurringMarker;
			} else if (isPhysicalRecurring && settings.showPhysicalRecurringMarker) {
				markerEl.textContent = settings.physicalRecurringMarker;
			} else if (integrationIcon) {
				markerEl.textContent = integrationIcon;
			} else if (isHoliday) {
				markerEl.textContent = "🏳️";
			}

			container.appendChild(markerEl);
		}

		const headerEl = document.createElement("div");
		headerEl.className = cls("fc-event-header");

		// On mobile monthly view, hide time to save space - show only event name
		const showTime = !event.allDay && event.start && !(isMobile && isMonthView);
		if (showTime) {
			const timeEl = document.createElement("div");
			timeEl.className = cls("fc-event-time");
			timeEl.textContent = arg.timeText;
			headerEl.appendChild(timeEl);
		}

		const titleEl = document.createElement("div");
		titleEl.className = cls("fc-event-title-custom");
		let title = cleanupTitle(event.title);

		if (settings.showDurationInTitle && !event.allDay && event.start && event.end) {
			const duration = calculateDuration(event.start, event.end);
			title = `${title} (${duration})`;
		}

		titleEl.textContent = title;
		headerEl.appendChild(titleEl);

		container.appendChild(headerEl);

		// On mobile only: hide display properties to save space (monthly)
		const hideProperties = isMobile && isMonthView;
		if (!hideProperties) {
			const displayPropertiesList = event.allDay
				? settings.frontmatterDisplayPropertiesAllDay
				: settings.frontmatterDisplayProperties;

			const displayProperties = displayData ? getDisplayProperties(displayData, displayPropertiesList) : [];
			if (displayProperties.length > 0) {
				const propsContainer = document.createElement("div");
				propsContainer.className = cls("fc-event-props");

				for (const [prop, value] of displayProperties) {
					const propEl = document.createElement("div");
					propEl.className = cls("fc-event-prop");

					const keyEl = document.createElement("span");
					keyEl.className = cls("fc-event-prop-key");
					keyEl.textContent = `${prop}:`;
					propEl.appendChild(keyEl);

					const valueEl = document.createElement("span");
					valueEl.className = cls("fc-event-prop-value");
					renderPropertyValue(valueEl, value, {
						app: this.app,
						linkClassName: cls("fc-event-prop-link"),
						addSpacePrefixToText: true,
					});
					propEl.appendChild(valueEl);

					propsContainer.appendChild(propEl);
				}
				container.appendChild(propsContainer);
			}
		}

		return { domNodes: [container] };
	}

	private getEventIcon(event: CalendarEventData): {
		userIcon?: string | undefined;
		integrationIcon?: string | undefined;
	} {
		const settings = this.bundle.settingsStore.currentSettings;
		const displayData = event.extendedProps.frontmatterDisplayData;
		const result: { userIcon?: string | undefined; integrationIcon?: string | undefined } = {};

		// User-set icon (highest precedence, overrides everything)
		const iconValue = displayData?.[settings.iconProp];
		if (typeof iconValue === "string" && iconValue.trim()) {
			result.userIcon = iconValue.trim();
		}

		// Integration icons (CalDAV / ICS subscription)
		const caldavMetadata = displayData?.[settings.caldavProp] as { accountId?: string } | undefined;
		const icsSubscriptionMetadata = displayData?.[settings.icsSubscriptionProp] as
			| { subscriptionId?: string }
			| undefined;

		if (caldavMetadata?.accountId) {
			result.integrationIcon = this.calendarIconCache.get(`caldav:${caldavMetadata.accountId}`);
		} else if (icsSubscriptionMetadata?.subscriptionId) {
			result.integrationIcon = this.calendarIconCache.get(`ics:${icsSubscriptionMetadata.subscriptionId}`);
		}

		return result;
	}

	private getEventColor(event: Pick<CalendarEvent, "meta">): string {
		return resolveEventColor(event.meta ?? {}, this.bundle, this.colorEvaluator);
	}

	private getAllEventColors(event: Pick<CalendarEvent, "meta">): string[] {
		return resolveAllEventColors(event.meta ?? {}, this.bundle, this.colorEvaluator);
	}

	private handleEventMount(info: EventMountInfo): void {
		if (info.event.extendedProps.isVirtual) {
			info.el.classList.add(cls("virtual-event-italic"));
		}

		const element = info.el;
		const event = info.event;

		const allColors = event.extendedProps.computedColors ?? [];
		const eventColor = allColors[0] || this.getEventColor({ meta: event.extendedProps.frontmatterDisplayData ?? {} });

		element.style.setProperty("--event-color", eventColor);
		const settings = this.bundle.settingsStore.currentSettings;
		const colorModeCount = settings.colorMode === "off" ? 0 : Number(settings.colorMode);

		if (colorModeCount >= 2 && allColors.length >= 2) {
			const appliedColors = allColors.slice(0, colorModeCount);
			element.style.setProperty("background-image", buildColorGradient(appliedColors));
			element.style.setProperty("border-color", appliedColors[0]);
		}

		if (settings.showEventColorDots) {
			const appliedCount = settings.colorMode === "off" ? 0 : Math.min(colorModeCount, allColors.length);
			const overflowColors = allColors.slice(appliedCount);
			if (overflowColors.length > 0) {
				this.appendEventColorDots(element, overflowColors);
			}
		}

		// Cache parsed foreground RGB to avoid re-parsing the same setting for every event
		if (this.cachedTextColorSource !== settings.eventTextColor) {
			this.cachedTextColorRgb = parseColorToRgb(settings.eventTextColor);
			this.cachedTextColorSource = settings.eventTextColor;
		}

		const textColor = hasVeryCloseShadeFromRgb(this.cachedTextColorRgb!, eventColor)
			? settings.eventTextColorAlt
			: settings.eventTextColor;
		element.style.setProperty("--event-text-color", textColor);
		element.classList.add(cls("calendar-event"));

		// Set opacity CSS variable for past events
		const now = new Date();
		const eventStart = event.start;
		const eventEnd = event.end || eventStart;
		let isPast: boolean;

		if (eventEnd === null) {
			isPast = false;
		} else if (event.allDay) {
			// For all-day events, compare dates only (not times)
			// An all-day event is past only if its date is before today
			const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const eventDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
			isPast = eventDate < today;
		} else {
			// For timed events, check if end time is before now
			isPast = eventEnd < now;
		}

		if (isPast) {
			const contrast = settings.pastEventContrast;
			const opacity = contrast / 100;
			element.style.setProperty("--past-event-opacity", opacity.toString());
		}

		const tooltip = buildEventTooltip(event, settings);

		element.setAttribute("title", tooltip);
		element.addClass(cls("calendar-event"));

		const filePath = event.extendedProps?.["filePath"];
		if (filePath && !event.extendedProps?.["isVirtual"]) {
			element.addEventListener("mouseenter", () => {
				if (element.dataset["notesLoaded"]) return;
				element.dataset["notesLoaded"] = "true";
				const currentTitle = element.getAttribute("title") ?? "";
				element.removeAttribute("title");
				void (async () => {
					try {
						const file = this.app.vault.getAbstractFileByPath(filePath);
						if (!(file instanceof TFile)) {
							element.setAttribute("title", currentTitle);
							return;
						}
						const fullContent = await this.app.vault.cachedRead(file);
						const body = extractContentAfterFrontmatter(fullContent);
						const preview = getNotePreviewLines(body, 3);
						element.setAttribute("title", preview ? currentTitle + "\n---\n" + preview : currentTitle);
					} catch {
						element.setAttribute("title", currentTitle);
					}
				})();
			});
		}
	}

	private appendEventColorDots(element: HTMLElement, colors: string[]): void {
		const container = buildColorDotsContainer(colors, 6);
		container.classList.add(cls("event-color-dots"));
		const main = element.querySelector(".fc-event-main") ?? element;
		main.appendChild(container);
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
		const isVirtual = event.extendedProps.isVirtual;
		const isHoliday = typeof filePath === "string" && filePath.startsWith("holiday:");

		if (isHoliday) {
			return;
		}

		// For virtual events, show preview of the source event
		if (isVirtual && filePath && typeof filePath === "string") {
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
					const previewEvent: PreviewEventData = {
						title: sourceEvent.title,
						start: null,
						end: null,
						allDay: false,
						extendedProps: sourceEvent.extendedProps,
					};
					showEventPreviewModal(this.app, this.bundle, previewEvent);
					return;
				}
			}
		}

		// On mobile: single tap = context menu, double tap = open note
		if (this.isMobileView()) {
			const currentTime = Date.now();
			const timeSinceLastTap = currentTime - this.lastMobileTapTime;
			const DOUBLE_TAP_DELAY = 300;

			if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
				// Double tap - open the note
				this.lastMobileTapTime = 0;
				if (filePath && typeof filePath === "string") {
					void this.app.workspace.openLinkText(filePath, "", false);
				}
				return;
			}

			// Single tap - show context menu
			this.lastMobileTapTime = currentTime;
			const rect = eventEl.getBoundingClientRect();
			const menuEvent = {
				title: event.title,
				start: event.start,
				end: event.end,
				allDay: event.allDay,
				extendedProps: event.extendedProps,
			};
			this.eventContextMenu.show(
				{ x: rect.left + rect.width / 2, y: rect.top },
				{ event: menuEvent },
				eventEl,
				this.container
			);
			return;
		}

		// For regular and physical events, open the file
		if (filePath && typeof filePath === "string") {
			void this.app.workspace.openLinkText(filePath, "", false);
		}
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

		const eventInfo = event.extendedProps?.isVirtual
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

		if (event.extendedProps?.isVirtual) {
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

		void this.bundle.commandManager.executeCommand(fillTime(this.app, filePath, propertyName, timeValue));
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
		if (info.event.extendedProps.isVirtual === true) {
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
		this.untrackedEventsDropdown?.ignoreOutsideClicksFor(1500);

		void this.moveCalendarEventToUntracked(this.draggingCalendarEventFilePath);
	};

	private async moveCalendarEventToUntracked(filePath: string): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;

		const propertyUpdates = new Map<string, string | null>();
		propertyUpdates.set(settings.startProp, null);
		propertyUpdates.set(settings.endProp, null);
		propertyUpdates.set(settings.dateProp, null);
		propertyUpdates.set(settings.allDayProp, null);

		const command = updateFrontmatter(this.app, filePath, propertyUpdates);
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

					const command = updateFrontmatter(this.app, filePath, propertyUpdates);
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

		const EDGE_THRESHOLD = 50;
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

		this.storePreviousViewState();

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
		if (!this.calendar || !this.previousViewState) {
			return false;
		}

		const { date, viewType } = this.previousViewState;

		// Don't store the current state as previous when going back
		// (to avoid creating a navigation loop)
		const tempPrevious = this.previousViewState;
		this.previousViewState = null;

		this.calendar.changeView(viewType);
		this.calendar.gotoDate(date);

		// Restore the previous state reference
		this.previousViewState = tempPrevious;

		return true;
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

	private storePreviousViewState(): void {
		if (!this.calendar) return;

		const currentDate = this.calendar.getDate();
		const currentViewType = this.calendar.view.type;

		this.previousViewState = {
			date: new Date(currentDate),
			viewType: currentViewType,
		};
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
		let intervalLabel = "";
		if (viewType.includes("Day")) {
			const date = new Date(view.currentStart);
			intervalLabel = date.toLocaleDateString(settings.locale, {
				weekday: "long",
				month: "short",
				day: "numeric",
				year: "numeric",
			});
		} else if (viewType.includes("Week")) {
			const start = new Date(view.currentStart);
			const end = new Date(view.currentEnd);
			end.setDate(end.getDate() - 1);
			intervalLabel = `${start.toLocaleDateString(settings.locale, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(settings.locale, { month: "short", day: "numeric", year: "numeric" })}`;
		} else if (viewType.includes("Month")) {
			const date = new Date(view.currentStart);
			intervalLabel = date.toLocaleDateString(settings.locale, {
				month: "long",
				year: "numeric",
			});
		} else {
			intervalLabel = "Current View";
		}

		showIntervalEventsModal(this.app, intervalLabel, startDate, endDate, this.bundle.settingsStore.currentSettings);
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

	highlightEventByPath(filePath: string, durationMs = 5000): void {
		if (!this.calendar) return;

		// Find all events with matching file path
		const events = this.calendar.getEvents();
		const matchingEvents = events.filter((event) => event.extendedProps?.["filePath"] === filePath);

		for (const event of matchingEvents) {
			const eventElements = this.container.querySelectorAll<HTMLElement>(`[data-event-id="${event.id}"]`);
			for (let i = 0; i < eventElements.length; i++) {
				const element = eventElements[i];
				element.classList.add(cls("event-highlighted"));
				setTimeout(() => {
					element.classList.remove(cls("event-highlighted"));
				}, durationMs);
			}
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
		}, 10000);
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
		const result = new Set<string>();
		if (!this.calendar) return result;

		const events = this.calendar.getEvents();
		for (const event of events) {
			if (event.extendedProps["isVirtual"]) continue;

			const filePath = event.extendedProps["filePath"] as string | undefined;
			if (filePath && predicate(filePath)) {
				result.add(event.id);
			}
		}
		return result;
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
			if (!event.start || event.allDay || event.extendedProps?.["isVirtual"]) continue;

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

	private isMobileView(): boolean {
		return window.innerWidth <= 768;
	}
}

function buildColorDotsContainer(colors: string[], maxDots: number): HTMLDivElement {
	const container = document.createElement("div");
	container.className = cls("day-color-dots");
	for (const color of colors.slice(0, maxDots)) {
		const dot = document.createElement("div");
		dot.className = cls("day-color-dot");
		dot.style.setProperty("--dot-color", color);
		container.appendChild(dot);
	}
	return container;
}

function buildColorGradient(colors: string[]): string {
	const segmentSize = 100 / colors.length;
	const stops = colors.map((color, i) => `${color} ${i * segmentSize}%, ${color} ${(i + 1) * segmentSize}%`).join(", ");
	return `linear-gradient(90deg, ${stops})`;
}
