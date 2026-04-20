import type { EventContentArg } from "@fullcalendar/core";
import {
	calculateDuration,
	cls,
	extractContentAfterFrontmatter,
	getNotePreviewLines,
	hasVeryCloseShadeFromRgb,
	parseColorToRgb,
	type RgbColor,
} from "@real1ty-obsidian-plugins";
import { type App, TFile } from "obsidian";

import type { CalendarEventData } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/settings";
import { isHolidayEvent } from "../utils/event-classification";
import { cleanupTitle } from "../utils/events/naming";
import { buildEventTooltip } from "../utils/format";
import { getDisplayProperties, renderPropertyValue } from "../utils/property-display";

export interface EventRenderContext {
	app: App;
	settings: SingleCalendarConfig;
	isMobile: boolean;
	calendarIconCache: Map<string, string | undefined>;
}

export function renderEventContent(arg: EventContentArg, context: EventRenderContext): { domNodes: HTMLElement[] } {
	const event = arg.event;
	const { settings, isMobile, calendarIconCache } = context;
	const isMonthView = arg.view.type === "dayGridMonth" || arg.view.type === "multiMonthYear";

	const container = document.createElement("div");
	container.className = cls("fc-event-content-wrapper");

	const displayData = event.extendedProps["frontmatterDisplayData"];
	const isSourceRecurring = displayData?.[settings.rruleProp];
	const isPhysicalRecurring = displayData?.[settings.sourceProp];
	const holiday = isHolidayEvent(event);

	const { userIcon, integrationIcon } = getEventIcon(event, settings, calendarIconCache);

	const hasRecurringMarker =
		(isSourceRecurring && settings.showSourceRecurringMarker) ||
		(isPhysicalRecurring && settings.showPhysicalRecurringMarker);

	if (userIcon || hasRecurringMarker || integrationIcon || holiday) {
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
		} else if (holiday) {
			markerEl.textContent = "🏳️";
		}

		container.appendChild(markerEl);
	}

	const headerEl = document.createElement("div");
	headerEl.className = cls("fc-event-header");

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
					app: context.app,
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

/**
 * Cached text-color state for `applyEventMountStyling`.
 * Passed in by the caller and **mutated in-place** when the settings color
 * changes, so the parsed RGB is reused across consecutive mount calls.
 * The (potentially updated) cache is also returned for callers that
 * destructure into their own fields.
 */
export interface TextColorCache {
	rgb: RgbColor | null;
	source: string | null;
}

export function applyEventMountStyling(
	element: HTMLElement,
	event: CalendarEventData,
	settings: SingleCalendarConfig,
	eventColor: string,
	allColors: string[],
	cachedTextColor: TextColorCache
): TextColorCache {
	element.style.setProperty("--event-color", eventColor);

	// Color gradient for multi-color mode
	const colorModeCount = settings.colorMode === "off" ? 0 : Number(settings.colorMode);

	if (colorModeCount >= 2 && allColors.length >= 2) {
		const appliedColors = allColors.slice(0, colorModeCount);
		element.style.setProperty("background-image", buildColorGradient(appliedColors));
		element.style.setProperty("border-color", appliedColors[0]);
	}

	// Overflow color dots
	if (settings.showEventColorDots) {
		const appliedCount = settings.colorMode === "off" ? 0 : Math.min(colorModeCount, allColors.length);
		const overflowColors = allColors.slice(appliedCount);
		if (overflowColors.length > 0) {
			appendEventColorDots(element, overflowColors);
		}
	}

	// Text color (cached to avoid re-parsing the same setting for every event)
	if (cachedTextColor.source !== settings.eventTextColor) {
		cachedTextColor.rgb = parseColorToRgb(settings.eventTextColor);
		cachedTextColor.source = settings.eventTextColor;
	}

	const textColor = hasVeryCloseShadeFromRgb(cachedTextColor.rgb!, eventColor)
		? settings.eventTextColorAlt
		: settings.eventTextColor;
	element.style.setProperty("--event-text-color", textColor);
	element.classList.add(cls("calendar-event"));

	// Past event opacity
	const now = new Date();
	const eventEnd = event.end || event.start;
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
		element.style.setProperty("--past-event-opacity", opacity.toString());
	}

	const tooltip = buildEventTooltip(event, settings);
	element.setAttribute("title", tooltip);

	return cachedTextColor;
}

function appendEventColorDots(element: HTMLElement, colors: string[]): void {
	const container = buildColorDotsContainer(colors, 6);
	container.classList.add(cls("event-color-dots"));
	const main = element.querySelector(".fc-event-main") ?? element;
	main.appendChild(container);
}

export function attachLazyNotePreview(element: HTMLElement, filePath: string, app: App): void {
	element.addEventListener("mouseenter", () => {
		if (element.dataset["notesLoaded"]) return;
		element.dataset["notesLoaded"] = "true";
		const currentTitle = element.getAttribute("title") ?? "";
		element.removeAttribute("title");
		void (async () => {
			try {
				const file = app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile)) {
					element.setAttribute("title", currentTitle);
					return;
				}
				const fullContent = await app.vault.cachedRead(file);
				const body = extractContentAfterFrontmatter(fullContent);
				const preview = getNotePreviewLines(body, 3);
				element.setAttribute("title", preview ? currentTitle + "\n---\n" + preview : currentTitle);
			} catch {
				element.setAttribute("title", currentTitle);
			}
		})();
	});
}

export function buildColorDotsContainer(colors: string[], maxDots: number): HTMLDivElement {
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

export function buildColorGradient(colors: string[]): string {
	const segmentSize = 100 / colors.length;
	const stops = colors.map((color, i) => `${color} ${i * segmentSize}%, ${color} ${(i + 1) * segmentSize}%`).join(", ");
	return `linear-gradient(90deg, ${stops})`;
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
