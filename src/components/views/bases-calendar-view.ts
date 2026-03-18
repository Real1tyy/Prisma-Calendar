import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import { cls, ColorEvaluator, toLocalISOString } from "@real1ty-obsidian-plugins";
import { BasesView, Notice, type QueryController } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { UpdateEventCommand } from "../../core/commands";
import { PRO_FEATURES } from "../../core/license";
import type CustomCalendarPlugin from "../../main";
import type { CalendarEventData, EventUpdateInfo } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import type { CalendarHost } from "../calendar-host";
import { EventContextMenu } from "../event-context-menu";
import { EventCreateModal, showEventPreviewModal } from "../modals";
import {
	applyContainerStyles,
	buildCalendarIconCache,
	buildCoreCalendarOptions,
	buildSharedEventClassNames,
	buildSharedEventContent,
	buildSharedEventDidMount,
	mapEventToPrismaInput,
	type SharedCalendarDeps,
	syncCalendarSettings,
} from "./shared-calendar-options";

export const BASES_CALENDAR_VIEW_ID = "prisma-calendar";

const DEFAULT_VIEW = "dayGridMonth";
const CLICK_THRESHOLD_MS = 150;

class PrismaBasesView extends BasesView {
	readonly type = BASES_CALENDAR_VIEW_ID;

	private calendar: Calendar | null = null;
	private calendarContainerEl: HTMLElement | null = null;
	private colorEvaluator: ColorEvaluator<SingleCalendarConfig> | null = null;
	private eventContextMenu: EventContextMenu | null = null;
	private calendarIconCache = new Map<string, string | undefined>();
	private cachedNow = new Date();
	private cachedTodayStart = new Date(
		this.cachedNow.getFullYear(),
		this.cachedNow.getMonth(),
		this.cachedNow.getDate()
	);
	private mouseDownTime = 0;
	private isHandlingSelection = false;
	private hasNavigatedInitially = false;
	private currentViewType: string | null = null;
	private currentBundleId: string | null = null;

	constructor(
		controller: QueryController,
		private readonly containerEl: HTMLElement,
		private readonly plugin: CustomCalendarPlugin
	) {
		super(controller);
	}

	override onunload(): void {
		this.destroyCalendar();
	}

	private destroyCalendar(): void {
		this.calendar?.destroy();
		this.calendar = null;
		this.colorEvaluator?.destroy();
		this.colorEvaluator = null;
		this.eventContextMenu = null;
		this.calendarContainerEl = null;
		this.currentViewType = null;
		this.currentBundleId = null;
	}

	onDataUpdated(): void {
		if (!this.plugin.licenseManager.requirePro(PRO_FEATURES.BASES_VIEW)) {
			this.containerEl.empty();
			this.containerEl.createDiv({
				cls: cls("bases-view-pro-gate"),
				text: "Bases Calendar View is a Pro feature.",
			});
			return;
		}

		const bundle = this.resolveBundle();
		if (!bundle) {
			this.containerEl.empty();
			this.containerEl.createDiv({
				cls: cls("bases-view-empty"),
				text: "No calendar configured. Select a calendar in the view options.",
			});
			return;
		}

		// Re-initialize if the selected calendar changed
		if (this.currentBundleId !== bundle.calendarId) {
			this.destroyCalendar();
		}

		if (!this.calendar) {
			this.initializeCalendar(bundle);
			this.currentBundleId = bundle.calendarId;
		}

		if (!this.calendar || !this.colorEvaluator) return;

		// Switch view type if changed
		const desiredView = this.resolveView();
		if (this.currentViewType !== desiredView) {
			this.currentViewType = desiredView;
			this.calendar.changeView(desiredView);
		}

		const colorEvaluator = this.colorEvaluator;
		const events = this.data.data
			.map((entry) => bundle.eventStore.getEventByPath(entry.file.path))
			.filter((e) => e !== null)
			.map((event) => mapEventToPrismaInput(event, bundle, colorEvaluator));

		this.calendar.removeAllEvents();
		this.calendar.batchRendering(() => {
			for (const ev of events) {
				this.calendar!.addEvent(ev);
			}
		});

		if (!this.hasNavigatedInitially) {
			this.hasNavigatedInitially = true;
			this.navigateToInitialDate();
		}

		if (events.length === 0) {
			this.ensureEmptyMessage();
		} else {
			this.removeEmptyMessage();
		}
	}

	private resolveBundle(): CalendarBundle | null {
		const bundles = this.plugin.calendarBundles;
		if (bundles.length === 0) return null;

		const calendarId = this.config.get("calendarId");
		if (typeof calendarId === "string" && calendarId) {
			return bundles.find((b) => b.calendarId === calendarId) ?? bundles[0]!;
		}
		return bundles[0]!;
	}

	private navigateToInitialDate(): void {
		if (!this.calendar) return;

		const initialDate = this.config.get("initialDate");
		if (typeof initialDate === "string" && initialDate.trim()) {
			const parsed = new Date(initialDate.trim());
			if (!isNaN(parsed.getTime())) {
				this.calendar.gotoDate(parsed);
				return;
			}
		}

		// Default: navigate to today
		this.calendar.today();
	}

	private initializeCalendar(bundle: CalendarBundle): void {
		this.containerEl.empty();

		this.calendarContainerEl = this.containerEl.createDiv({ cls: cls("calendar-container") });

		this.colorEvaluator = new ColorEvaluator<SingleCalendarConfig>(bundle.settingsStore.settings$);
		this.calendarIconCache = buildCalendarIconCache(bundle);

		const calendarHost: CalendarHost = {
			navigateToDate: (date) => this.calendar?.gotoDate(date),
			highlightEventByPath: () => {},
		};

		this.eventContextMenu = new EventContextMenu(this.app, bundle, calendarHost);

		const deps: SharedCalendarDeps = {
			app: this.app,
			bundle,
			container: this.calendarContainerEl,
			colorEvaluator: this.colorEvaluator,
			calendarHost,
			getCalendarIconCache: () => this.calendarIconCache,
		};

		const eventContentCallback = buildSharedEventContent(deps);
		const eventClassNamesCallback = buildSharedEventClassNames(deps, () => ({
			now: this.cachedNow,
			todayStart: this.cachedTodayStart,
		}));
		const eventDidMountCallback = buildSharedEventDidMount(deps, this.eventContextMenu, () => null);

		const settings = bundle.settingsStore.currentSettings;
		const coreOptions = buildCoreCalendarOptions(settings);
		const viewType = this.resolveView();
		this.currentViewType = viewType;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- FullCalendar's exactOptionalPropertyTypes requires building options dynamically
		const calendarOptions: Record<string, any> = {
			...coreOptions,
			plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
			initialView: viewType,
			headerToolbar: { left: "prev,next today", center: "title", right: "" },
			editable: true,
			eventStartEditable: true,
			eventDurationEditable: true,
			eventResizableFromStart: true,
			selectable: true,
			selectMirror: true,
			unselectAuto: true,
			eventAllow: (_dropInfo: unknown, draggedEvent: { extendedProps: Record<string, unknown> } | null) =>
				!draggedEvent?.extendedProps["isVirtual"],
			eventContent: eventContentCallback,
			eventClassNames: eventClassNamesCallback,
			eventDidMount: eventDidMountCallback,
			eventClick: (info: { event: CalendarEventData }) => this.handleEventClick(bundle, info.event),
			eventDrop: (info: { event: CalendarEventData; oldEvent: CalendarEventData; revert: () => void }) => {
				void this.handleEventUpdate(bundle, this.extractEventUpdateInfo(info), "Error updating event dates:");
			},
			eventResize: (info: { event: CalendarEventData; oldEvent: CalendarEventData; revert: () => void }) => {
				void this.handleEventUpdate(bundle, this.extractEventUpdateInfo(info), "Error updating event duration:");
			},
			dateClick: (info: { date: Date; allDay: boolean }) => {
				if (!this.isHandlingSelection) this.handleDateClick(bundle, info);
				setTimeout(() => {
					this.isHandlingSelection = false;
				}, 50);
			},
			select: (info: { start: Date; end: Date; allDay: boolean }) => {
				if (Date.now() - this.mouseDownTime < CLICK_THRESHOLD_MS) {
					this.calendar!.unselect();
				} else {
					this.isHandlingSelection = true;
					this.handleDateSelection(bundle, info);
				}
			},
			datesSet: () => {
				this.cachedNow = new Date();
				this.cachedTodayStart = new Date(
					this.cachedNow.getFullYear(),
					this.cachedNow.getMonth(),
					this.cachedNow.getDate()
				);
			},
			height: "auto",
		};

		this.calendar = new Calendar(this.calendarContainerEl, calendarOptions);
		this.calendar.render();

		this.calendarContainerEl.addEventListener("mousedown", () => {
			this.mouseDownTime = Date.now();
		});

		applyContainerStyles(this.calendarContainerEl, settings);

		const settingsSub = bundle.settingsStore.settings$.subscribe((s: SingleCalendarConfig) => {
			if (this.calendar) syncCalendarSettings(this.calendar, s);
			if (this.calendarContainerEl) applyContainerStyles(this.calendarContainerEl, s);
		});
		this.register(() => settingsSub.unsubscribe());

		const mainSettingsSub = bundle.settingsStore.mainSettingsStore.settings$.subscribe(() => {
			this.calendarIconCache = buildCalendarIconCache(bundle);
		});
		this.register(() => mainSettingsSub.unsubscribe());
	}

	private resolveView(): string {
		const view = this.config.get("view");
		if (typeof view === "string" && view) return view;
		return DEFAULT_VIEW;
	}

	private handleEventClick(
		bundle: CalendarBundle,
		event: Pick<CalendarEventData, "title" | "extendedProps" | "start" | "end" | "allDay">
	): void {
		const filePath = event.extendedProps.filePath;
		const isVirtual = event.extendedProps.isVirtual;
		const isHoliday = typeof filePath === "string" && filePath.startsWith("holiday:");

		if (isHoliday) return;

		if (isVirtual && typeof filePath === "string") {
			showEventPreviewModal(this.app, bundle, {
				title: event.title,
				start: null,
				end: null,
				allDay: false,
				extendedProps: {
					filePath,
					frontmatterDisplayData: event.extendedProps.frontmatterDisplayData,
				},
			});
			return;
		}

		if (typeof filePath === "string") {
			void this.app.workspace.openLinkText(filePath, "", false);
		}
	}

	private handleDateClick(bundle: CalendarBundle, info: { date: Date; allDay: boolean }): void {
		const currentSettings = bundle.settingsStore.currentSettings;
		const endDate = new Date(info.date);
		endDate.setMinutes(endDate.getMinutes() + currentSettings.defaultDurationMinutes);

		new EventCreateModal(this.app, bundle, {
			title: "",
			start: toLocalISOString(info.date),
			end: info.allDay ? null : toLocalISOString(endDate),
			allDay: info.allDay,
			extendedProps: { filePath: null as string | null },
		}).open();
		this.calendar?.unselect();
	}

	private handleDateSelection(bundle: CalendarBundle, info: { start: Date; end: Date; allDay: boolean }): void {
		new EventCreateModal(this.app, bundle, {
			title: "",
			start: toLocalISOString(info.start),
			end: toLocalISOString(info.end),
			allDay: info.allDay,
			extendedProps: { filePath: null as string | null },
		}).open();
		this.calendar?.unselect();
	}

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

	private async handleEventUpdate(
		bundle: CalendarBundle,
		info: EventUpdateInfo | null,
		errorMessage: string
	): Promise<void> {
		if (!info) return;

		if (info.event.extendedProps.isVirtual === true) {
			info.revert();
			return;
		}

		const filePath = info.event.extendedProps.filePath;
		if (!filePath || typeof filePath !== "string") {
			info.revert();
			return;
		}

		try {
			const command = new UpdateEventCommand(
				this.app,
				bundle,
				filePath,
				toLocalISOString(info.event.start),
				info.event.end ? toLocalISOString(info.event.end) : undefined,
				info.event.allDay || false,
				toLocalISOString(info.oldEvent.start),
				info.oldEvent.end ? toLocalISOString(info.oldEvent.end) : undefined,
				info.oldEvent.allDay || false
			);
			await bundle.commandManager.executeCommand(command);
		} catch (error) {
			console.error(`[BasesCalendarView] ${errorMessage}`, error);
			info.revert();
		}
	}

	private ensureEmptyMessage(): void {
		if (this.calendarContainerEl?.querySelector(`.${cls("bases-view-empty")}`)) return;
		new Notice(
			"Prisma Calendar: No events found for this query. Ensure the Base's folder filter matches the calendar's directory.",
			6000
		);
		this.calendarContainerEl?.createDiv({
			cls: cls("bases-view-empty"),
			text: "No events found. Ensure the folder matches your calendar directory.",
		});
	}

	private removeEmptyMessage(): void {
		this.calendarContainerEl?.querySelector(`.${cls("bases-view-empty")}`)?.remove();
	}
}

export function registerPrismaBasesView(plugin: CustomCalendarPlugin): boolean {
	return plugin.registerBasesView(BASES_CALENDAR_VIEW_ID, {
		name: "Prisma Calendar",
		icon: "calendar",
		factory: (controller, containerEl) => {
			const view = new PrismaBasesView(controller, containerEl, plugin);
			view.load();
			return view;
		},
		options: () => {
			const calendars = plugin.calendarBundles;
			const calendarOptions: Record<string, string> = {};
			for (const bundle of calendars) {
				calendarOptions[bundle.calendarId] = bundle.settingsStore.currentSettings.name;
			}

			return [
				{
					type: "dropdown" as const,
					displayName: "Calendar",
					key: "calendarId",
					default: calendars[0]?.calendarId ?? "",
					options: calendarOptions,
				},
				{
					type: "dropdown" as const,
					displayName: "View",
					key: "view",
					default: DEFAULT_VIEW,
					options: {
						dayGridMonth: "Month",
						timeGridWeek: "Week",
						timeGridDay: "Day",
					},
				},
				{
					type: "text" as const,
					displayName: "Initial Date",
					key: "initialDate",
					default: "",
				},
			];
		},
	});
}
