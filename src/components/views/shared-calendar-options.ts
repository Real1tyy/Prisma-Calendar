import type { Calendar, CalendarOptions, EventContentArg } from "@fullcalendar/core";
import allLocales from "@fullcalendar/core/locales-all";
import {
	calculateDuration,
	cls,
	type ColorEvaluator,
	extractContentAfterFrontmatter,
	formatDuration,
	getNotePreviewLines,
	hasVeryCloseShadeFromRgb,
	parseColorToRgb,
	type RgbColor,
	toggleCls,
} from "@real1ty-obsidian-plugins";
import { type App, TFile } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent, CalendarEventData, PrismaEventInput } from "../../types/calendar";
import { isTimedEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { resolveAllEventColors, resolveEventColor } from "../../utils/event-color";
import { hashFrontmatter } from "../../utils/event-diff";
import { cleanupTitle } from "../../utils/event-naming";
import { buildEventTooltip } from "../../utils/format";
import { stripZ } from "../../utils/iso";
import { emitHover } from "../../utils/obsidian";
import { getDisplayProperties, renderPropertyValue } from "../../utils/property-display";
import type { BatchSelectionManager } from "../batch-selection-manager";
import type { CalendarHost } from "../calendar-host";
import type { EventContextMenu } from "../event-context-menu";

export interface SharedCalendarDeps {
	app: App;
	bundle: CalendarBundle;
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
		const displayData = event.extendedProps["frontmatterDisplayData"] as Record<string, unknown> | undefined;
		const isSourceRecurring = displayData?.[settings.rruleProp];
		const isPhysicalRecurring = displayData?.[settings.sourceProp];
		const filePath = event.extendedProps["filePath"] as string | undefined;
		const isHoliday = filePath?.startsWith("holiday:");

		const calendarIconCache = deps.getCalendarIconCache();
		const { userIcon, integrationIcon } = getEventIcon(event, settings, calendarIconCache);

		const container = document.createElement("div");
		container.className = cls("fc-event-content-wrapper");

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

		const showTime = !event.allDay && event.start;
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
					app: deps.app,
					linkClassName: cls("fc-event-prop-link"),
					addSpacePrefixToText: true,
				});
				propEl.appendChild(valueEl);

				propsContainer.appendChild(propEl);
			}
			container.appendChild(propsContainer);
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
	let cachedTextColorRgb: RgbColor | null = null;
	let cachedTextColorSource: string | null = null;

	return (info) => {
		const { el, event } = info;

		const isVirtual = event.extendedProps["isVirtual"];
		const isManualVirtual = event.extendedProps["isManualVirtual"];
		const eventFilePath = event.extendedProps["filePath"];
		const computedColors = event.extendedProps.computedColors ?? [];
		const displayData = (event.extendedProps["frontmatterDisplayData"] ?? {}) as Record<string, unknown>;

		if (isManualVirtual) {
			el.classList.add(cls("virtual-event-opacity"));
			el.title = "Virtual event (no backing file)";
			el.classList.add(cls("virtual-event-italic"));
		} else if (isVirtual) {
			el.classList.add(cls("virtual-event-opacity"), cls("virtual-event-cursor"));
			const isHoliday = eventFilePath?.startsWith("holiday:");
			el.title = isHoliday ? "Holiday (read-only)" : "Virtual recurring event (read-only)";
			if (isHoliday) {
				el.classList.add(cls("holiday-event"));
			}
			el.classList.add(cls("virtual-event-italic"));
		} else {
			getBatchSelectionManager()?.handleEventMount(event.id, el);
		}

		const eventColor = computedColors[0] || resolveEventColor(displayData, deps.bundle, deps.colorEvaluator);

		el.style.setProperty("--event-color", eventColor);
		const settings = deps.bundle.settingsStore.currentSettings;

		if (cachedTextColorSource !== settings.eventTextColor) {
			cachedTextColorRgb = parseColorToRgb(settings.eventTextColor);
			cachedTextColorSource = settings.eventTextColor;
		}

		const textColor = hasVeryCloseShadeFromRgb(cachedTextColorRgb!, eventColor)
			? settings.eventTextColorAlt
			: settings.eventTextColor;
		el.style.setProperty("--event-text-color", textColor);
		el.classList.add(cls("calendar-event"));

		const now = new Date();
		const eventStart = event.start;
		const eventEnd = event.end || eventStart;
		let isPast: boolean;

		if (eventEnd === null) {
			isPast = false;
		} else if (event.allDay) {
			const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			const eventDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
			isPast = eventDate < today;
		} else {
			isPast = eventEnd < now;
		}

		if (isPast) {
			const contrast = settings.pastEventContrast;
			const opacity = contrast / 100;
			el.style.setProperty("--past-event-opacity", opacity.toString());
		}

		const tooltip = buildEventTooltip(event, settings);
		el.setAttribute("title", tooltip);

		// Async note preview on hover
		if (eventFilePath && !isVirtual && !isManualVirtual) {
			el.addEventListener("mouseenter", () => {
				if (el.dataset["notesLoaded"]) return;
				el.dataset["notesLoaded"] = "true";
				const currentTitle = el.getAttribute("title") ?? "";
				el.removeAttribute("title");
				void (async () => {
					try {
						const file = deps.app.vault.getAbstractFileByPath(eventFilePath);
						if (!(file instanceof TFile)) {
							el.setAttribute("title", currentTitle);
							return;
						}
						const fullContent = await deps.app.vault.cachedRead(file);
						const body = extractContentAfterFrontmatter(fullContent);
						const preview = getNotePreviewLines(body, 3);
						el.setAttribute("title", preview ? currentTitle + "\n---\n" + preview : currentTitle);
					} catch {
						el.setAttribute("title", currentTitle);
					}
				})();
			});
		}

		// Context menu
		el.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			eventContextMenu.show(e, info, el, deps.container);
		});

		// Hover preview
		if (!isVirtual && !isManualVirtual && eventFilePath) {
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
): (arg: { event: CalendarEventData }) => string[] {
	return (arg) => {
		const eventEnd = arg.event.end || arg.event.start;
		if (!eventEnd) return [];

		const { now, todayStart } = getCachedTimestamps();
		const isAllDay = arg.event.allDay;
		let isPast: boolean;

		if (isAllDay) {
			const eventDate = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
			isPast = eventDate < todayStart;
		} else {
			isPast = eventEnd < now;
		}

		if (!isPast) return [];

		const contrast = deps.bundle.settingsStore.currentSettings.pastEventContrast;
		if (contrast === 0) return [cls("past-event-hidden")];
		if (contrast < 100) return [cls("past-event-faded")];
		return [];
	};
}

export function mapEventToPrismaInput(
	event: CalendarEvent,
	bundle: CalendarBundle,
	colorEvaluator: ColorEvaluator<SingleCalendarConfig>
): PrismaEventInput {
	const allColors = resolveAllEventColors(event.meta ?? {}, bundle, colorEvaluator);
	const eventColor = allColors[0] ?? bundle.settingsStore.currentSettings.defaultNodeColor;
	const start = stripZ(event.start);
	const end = isTimedEvent(event) ? stripZ(event.end) : undefined;

	const classNames = ["regular-event"];
	if (event.isVirtual) {
		classNames.push(cls("virtual-event"));
	}
	if (event.isManualVirtual) {
		classNames.push(cls("manual-virtual-event"));
	}

	const folder = event.meta?.["folder"];
	const folderStr = typeof folder === "string" ? folder : "";
	const meta = event.meta ?? {};

	const input: PrismaEventInput = {
		id: event.id,
		title: event.title,
		start,
		allDay: event.allDay,
		extendedProps: {
			filePath: event.ref.filePath,
			folder: folderStr,
			originalTitle: event.title,
			frontmatterDisplayData: meta,
			isVirtual: event.isVirtual,
			isManualVirtual: event.isManualVirtual,
			...(event.isManualVirtual ? { virtualEventId: event.id } : {}),
			computedColors: allColors,
			frontmatterHash: hashFrontmatter(meta),
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
