import type { Calendar, CalendarOptions, EventContentArg } from "@fullcalendar/core";
import allLocales from "@fullcalendar/core/locales-all";
import { calculateDuration, formatDuration, toLocalISOString, type ColorEvaluator } from "@real1ty/obsidian-plugins";
import { Platform, type App } from "obsidian";

import { cls, tid, toggleCls } from "../../constants";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { UpdateEventCommand } from "../../core/commands";
import { openEventCreateModal } from "../../react/modals/event/event-create-modal";
import {
	isAnyVirtual,
	isTimedEvent,
	type CalendarEvent,
	type CalendarEventData,
	type EventDateTime,
	type EventUpdateInfo,
	type FCPrismaEventInput,
} from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { stripZ } from "../../utils/dates/iso";
import { isBatchSelectable, isHolidayEvent } from "../../utils/events/classification";
import { resolveAllEventColors, resolveEventColor } from "../../utils/events/color";
import { hashFrontmatter } from "../../utils/events/diff";
import { cleanupTitle } from "../../utils/events/naming";
import { getDisplayProperties, renderPropertyValue } from "../../utils/frontmatter/display";
import { parseFCExtendedProps } from "../../utils/frontmatter/extended-props";
import { emitHover } from "../../utils/obsidian";
import { shouldUseMobileLayout } from "../../utils/responsive";
import type { BatchSelectionManager } from "../batch-selection-manager";
import {
	applyEventMountStyling,
	attachLazyNotePreview,
	getEventTimeAutoRootClass,
	renderEventTime,
} from "../calendar-event-renderer";
import type { CalendarHost } from "../calendar-host";
import { handleMoreLinkClick } from "../calendar-more-popover";
import type { EventContextMenu } from "../event-context-menu";
import { showEventPreviewModal } from "../modals";

export interface ModalContext {
	app: App;
	bundle: CalendarBundle;
}

export interface SharedCalendarDeps extends ModalContext {
	container: HTMLElement;
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>;
	calendarHost: CalendarHost;
	getCalendarIconCache: () => Map<string, string | undefined>;
}

export function buildCoreCalendarOptions(settings: SingleCalendarConfig): Partial<CalendarOptions> {
	return {
		locales: allLocales,
		locale: settings.locale,
		timeZone: "local",
		nowIndicator: settings.nowIndicator,
		defaultTimedEventDuration: "00:01:00",
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
		slotMinTime: `${String(settings.hourStart).padStart(2, "0")}:00:00`,
		slotMaxTime: `${String(settings.hourEnd).padStart(2, "0")}:00:00`,
		slotDuration: formatDuration(settings.slotDurationMinutes),
		snapDuration: formatDuration(settings.snapDurationMinutes),
		weekends: !settings.hideWeekends,
		firstDay: settings.firstDayOfWeek,
		eventOverlap: settings.eventOverlap,
		slotEventOverlap: settings.slotEventOverlap,
		moreLinkClick: handleMoreLinkClick,
	};
}

export function syncCalendarSettings(calendar: Calendar, settings: SingleCalendarConfig): void {
	calendar.setOption("locale", settings.locale);
	calendar.setOption("weekends", !settings.hideWeekends);
	calendar.setOption("firstDay", settings.firstDayOfWeek);
	calendar.setOption("nowIndicator", settings.nowIndicator);
	calendar.setOption("slotMinTime", `${String(settings.hourStart).padStart(2, "0")}:00:00`);
	calendar.setOption("slotMaxTime", `${String(settings.hourEnd).padStart(2, "0")}:00:00`);
	calendar.setOption("slotDuration", formatDuration(settings.slotDurationMinutes));
	calendar.setOption("snapDuration", formatDuration(settings.snapDurationMinutes));
	calendar.setOption("eventOverlap", settings.eventOverlap);
	calendar.setOption("slotEventOverlap", settings.slotEventOverlap);
}

export function applyContainerStyles(container: HTMLElement, settings: SingleCalendarConfig): void {
	toggleCls(container, "thicker-hour-lines", settings.thickerHourLines);
	toggleCls(container, "sticky-all-day-events", settings.stickyAllDayEvents);
	toggleCls(container, "sticky-day-headers", settings.stickyDayHeaders);
	container.style.setProperty("--all-day-event-height", `${settings.allDayEventHeight}px`);
}

export function buildSharedEventContent(
	deps: SharedCalendarDeps
): (arg: EventContentArg) => { domNodes: HTMLElement[] } {
	return (arg) => {
		const event = arg.event;
		const settings = deps.bundle.settingsStore.currentSettings;
		const displayData = parseFCExtendedProps(event).frontmatterDisplayData;
		const isSourceRecurring = displayData[settings.rruleProp];
		const isPhysicalRecurring = displayData[settings.sourceProp];
		const holiday = isHolidayEvent(event);

		const calendarIconCache = deps.getCalendarIconCache();
		const { userIcon, integrationIcon } = getEventIcon(event, settings, calendarIconCache);

		const container = createDiv({ cls: cls("fc-event-content-wrapper") });

		const hasRecurringMarker =
			(isSourceRecurring && settings.showSourceRecurringMarker) ||
			(isPhysicalRecurring && settings.showPhysicalRecurringMarker);

		if (userIcon || hasRecurringMarker || integrationIcon || holiday) {
			const markerEl = container.createDiv({ cls: cls("event-marker") });

			if (userIcon) {
				markerEl.textContent = userIcon;
			} else if (isSourceRecurring && settings.showSourceRecurringMarker) {
				markerEl.textContent = settings.sourceRecurringMarker;
			} else if (isPhysicalRecurring && settings.showPhysicalRecurringMarker) {
				markerEl.textContent = settings.physicalRecurringMarker;
			} else if (integrationIcon) {
				markerEl.textContent = integrationIcon;
			} else if (holiday) {
				markerEl.textContent = "🏳️";
			}
		}

		const headerEl = container.createDiv({ cls: cls("fc-event-header") });

		renderEventTime(headerEl, arg, settings, {
			isMobile: shouldUseMobileLayout({ isPlatformMobile: Platform.isMobile, width: window.innerWidth }),
		});

		const titleEl = headerEl.createDiv({ cls: cls("fc-event-title-custom") });
		let title = cleanupTitle(event.title);

		if (settings.showDurationInTitle && !event.allDay && event.start && event.end) {
			const duration = calculateDuration(event.start, event.end);
			title = `${title} (${duration})`;
		}

		titleEl.textContent = title;

		const displayPropertiesList = event.allDay
			? settings.frontmatterDisplayPropertiesAllDay
			: settings.frontmatterDisplayProperties;

		const displayProperties = getDisplayProperties(displayData, displayPropertiesList);
		if (displayProperties.length > 0) {
			const propsContainer = container.createDiv({ cls: cls("fc-event-props") });

			for (const [prop, value] of displayProperties) {
				const propEl = propsContainer.createDiv({ cls: cls("fc-event-prop") });

				propEl.createSpan({ cls: cls("fc-event-prop-key"), text: `${prop}:` });

				const valueEl = propEl.createSpan({ cls: cls("fc-event-prop-value") });
				renderPropertyValue(valueEl, value, {
					app: deps.app,
					linkClassName: cls("fc-event-prop-link"),
					addSpacePrefixToText: true,
				});
			}
		}

		return { domNodes: [container] };
	};
}

interface SharedEventMountInfo {
	el: HTMLElement;
	event: CalendarEventData & { id: string };
}

export function buildSharedEventDidMount(
	deps: SharedCalendarDeps,
	eventContextMenu: EventContextMenu,
	getBatchSelectionManager: () => BatchSelectionManager | null
): (info: SharedEventMountInfo) => void {
	return (info) => {
		const { el, event } = info;

		const ep = parseFCExtendedProps(event);
		const virtualKind = ep.virtualKind;
		const eventFilePath = ep.filePath || undefined;
		const computedColors = ep.computedColors ?? [];

		if (isAnyVirtual(virtualKind)) {
			el.classList.add(cls("virtual-event-opacity"), cls("virtual-event-cursor"), cls("virtual-event-italic"));
			if (virtualKind === "holiday") {
				el.classList.add(cls("holiday-event"));
				el.title = "Holiday (read-only)";
			} else if (virtualKind === "manual") {
				el.title = "Virtual event (no backing file)";
			} else if (virtualKind === "recurring") {
				el.title = "Virtual recurring event (read-only)";
			}
		}
		if (isBatchSelectable(event)) {
			getBatchSelectionManager()?.handleEventMount(event.id, el);
		}

		el.setAttribute("data-testid", tid("cal-event"));
		if (event.title) el.setAttribute("data-event-title", event.title);
		if (eventFilePath) el.setAttribute("data-event-file-path", eventFilePath);

		const eventColor =
			computedColors[0] || resolveEventColor(ep.frontmatterDisplayData, deps.bundle, deps.colorEvaluator);
		const settings = deps.bundle.settingsStore.currentSettings;

		applyEventMountStyling(el, event, settings, eventColor, computedColors);

		if (eventFilePath && !isAnyVirtual(virtualKind)) {
			attachLazyNotePreview(el, eventFilePath, deps.app);
		}

		// Context menu
		el.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			eventContextMenu.show(e, info, el, deps.container);
		});

		// Hover preview
		if (!isAnyVirtual(virtualKind) && eventFilePath) {
			el.addEventListener("mouseenter", (e) => {
				if (settings.enableEventPreview) {
					emitHover(deps.app, deps.container, el, e, eventFilePath, deps.bundle.calendarId);
				}
			});
		}
	};
}

export function buildSharedEventClassNames(
	deps: SharedCalendarDeps,
	getCachedTimestamps: () => { now: Date; todayStart: Date }
): (arg: { event: CalendarEventData; view: { type: string } }) => string[] {
	return (arg) => {
		const settings = deps.bundle.settingsStore.currentSettings;
		const classes: string[] = [];

		const autoRootClass = getEventTimeAutoRootClass(settings, {
			allDay: arg.event.allDay,
			hasStart: Boolean(arg.event.start),
			isMobile: shouldUseMobileLayout({ isPlatformMobile: Platform.isMobile, width: window.innerWidth }),
			viewType: arg.view.type,
		});
		if (autoRootClass) classes.push(autoRootClass);

		const eventEnd = arg.event.end || arg.event.start;
		if (!eventEnd) return classes;

		const { now, todayStart } = getCachedTimestamps();
		const isAllDay = arg.event.allDay;
		let isPast: boolean;

		if (isAllDay) {
			const eventDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
			isPast = eventDate < todayStart;
		} else {
			isPast = eventEnd < now;
		}

		if (!isPast) return classes;

		const contrast = settings.pastEventContrast;
		if (contrast === 0) classes.push(cls("past-event-hidden"));
		else if (contrast < 100) classes.push(cls("past-event-faded"));
		return classes;
	};
}

export function mapEventToPrismaInput(
	event: CalendarEvent,
	bundle: CalendarBundle,
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>
): FCPrismaEventInput {
	const allColors = resolveAllEventColors(event.meta, bundle, colorEvaluator);
	const eventColor = allColors[0] ?? bundle.settingsStore.currentSettings.defaultNodeColor;
	const start = stripZ(event.start);
	const end = isTimedEvent(event) ? stripZ(event.end) : undefined;

	const classNames = ["regular-event"];
	if (isAnyVirtual(event.virtualKind)) {
		classNames.push(cls("virtual-event"));
	}

	const folder = event.meta["folder"];
	const folderStr = typeof folder === "string" ? folder : "";
	const meta = event.meta;

	const input: FCPrismaEventInput = {
		id: event.id,
		title: event.title,
		start,
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
		backgroundColor: eventColor,
		borderColor: eventColor,
		className: classNames.join(" "),
	};
	if (end !== undefined) {
		input.end = end;
	}
	return input;
}

export function buildCalendarIconCache(bundle: CalendarBundle): Map<string, string | undefined> {
	const cache = new Map<string, string | undefined>();

	const caldavSettings = bundle.getCalDAVSettings();
	for (const account of caldavSettings.accounts) {
		if (account.icon) {
			cache.set(`caldav:${account.id}`, account.icon);
		}
	}

	const icsSubscriptionSettings = bundle.getICSSubscriptionSettings();
	for (const subscription of icsSubscriptionSettings.subscriptions) {
		if (subscription.icon) {
			cache.set(`ics:${subscription.id}`, subscription.icon);
		}
	}

	return cache;
}

// ─── Shared Interaction Handlers ─────────────────────────────────

export const CLICK_THRESHOLD_MS = 150;
export const SELECTION_GUARD_DELAY_MS = 50;

export function handleSharedEventClick(
	app: App,
	bundle: CalendarBundle,
	event: Pick<CalendarEventData, "title" | "extendedProps" | "start" | "end" | "allDay">
): void {
	const filePath = event.extendedProps.filePath;
	const virtualKind = event.extendedProps.virtualKind;

	if (virtualKind === "holiday") return;

	if (virtualKind === "recurring" && filePath && typeof filePath === "string") {
		showEventPreviewModal(app, bundle, {
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

	if (filePath && typeof filePath === "string") {
		void app.workspace.openLinkText(filePath, "", false);
	}
}

export function handleSharedDateClick(
	app: App,
	bundle: CalendarBundle,
	calendar: Calendar,
	info: { date: Date; allDay: boolean }
): void {
	const settings = bundle.settingsStore.currentSettings;
	const endDate = new Date(info.date);
	endDate.setMinutes(endDate.getMinutes() + settings.defaultDurationMinutes);

	openEventCreateModal(app, bundle, {
		title: "",
		start: toLocalISOString(info.date),
		end: info.allDay ? null : toLocalISOString(endDate),
		allDay: info.allDay,
		extendedProps: { filePath: null as string | null },
	});
	calendar.unselect();
}

export function handleSharedDateSelection(
	app: App,
	bundle: CalendarBundle,
	calendar: Calendar,
	info: { start: Date; end: Date; allDay: boolean }
): void {
	openEventCreateModal(app, bundle, {
		title: "",
		start: toLocalISOString(info.start),
		end: toLocalISOString(info.end),
		allDay: info.allDay,
		extendedProps: { filePath: null as string | null },
	});
	calendar.unselect();
}

export function extractSharedEventUpdateInfo(info: {
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

export async function handleSharedEventUpdate(
	app: App,
	bundle: CalendarBundle,
	info: EventUpdateInfo | null,
	errorMessage: string,
	logPrefix: string
): Promise<void> {
	if (!info) return;

	if (isAnyVirtual(info.event.extendedProps.virtualKind)) {
		info.revert();
		return;
	}

	const filePath = info.event.extendedProps.filePath;
	if (!filePath || typeof filePath !== "string") {
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
		const command = new UpdateEventCommand(app, bundle, filePath, newDateTime, oldDateTime);
		await bundle.commandManager.executeCommand(command);
	} catch (error) {
		console.error(`[${logPrefix}] ${errorMessage}`, error);
		info.revert();
	}
}

// ─── Internals ───────────────────────────────────────────────────

function getEventIcon(
	event: CalendarEventData,
	settings: SingleCalendarConfig,
	calendarIconCache: Map<string, string | undefined>
): { userIcon: string | undefined; integrationIcon: string | undefined } {
	const displayData = event.extendedProps.frontmatterDisplayData;
	let userIcon: string | undefined;
	let integrationIcon: string | undefined;

	const iconValue = displayData?.[settings.iconProp];
	if (typeof iconValue === "string" && iconValue.trim()) {
		userIcon = iconValue.trim();
	}

	const caldavMetadata = displayData?.[settings.caldavProp] as { accountId?: string } | undefined;
	const icsSubscriptionMetadata = displayData?.[settings.icsSubscriptionProp] as
		| { subscriptionId?: string }
		| undefined;

	if (caldavMetadata?.accountId) {
		integrationIcon = calendarIconCache.get(`caldav:${caldavMetadata.accountId}`);
	} else if (icsSubscriptionMetadata?.subscriptionId) {
		integrationIcon = calendarIconCache.get(`ics:${icsSubscriptionMetadata.subscriptionId}`);
	}

	return { userIcon, integrationIcon };
}
