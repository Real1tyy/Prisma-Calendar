import {
	addCls,
	cls,
	createDefaultSeparator,
	type PropertyRendererConfig,
	renderPropertyValue,
	showModal,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { Frontmatter } from "../../../types";
import type { SingleCalendarConfig } from "../../../types/settings";
import { createTextDiv } from "../../../utils/dom-utils";
import { removeZettelId } from "../../../utils/event-naming";
import { categorizeProperties } from "../../../utils/format";

export interface NotificationEventData {
	title: string;
	filePath: string;
	startDate: Date;
	isAllDay: boolean;
	frontmatter: Frontmatter;
}

function getTimingInfo(eventData: NotificationEventData): string {
	const now = new Date();
	const eventTime = eventData.startDate;
	const diffMs = eventTime.getTime() - now.getTime();
	const diffMinutes = Math.round(diffMs / (1000 * 60));

	if (eventData.isAllDay) {
		if (diffMinutes <= 0) return "Event is today";
		const diffDays = Math.ceil(diffMinutes / (24 * 60));
		if (diffDays === 1) return "Event is tomorrow";
		return `Event in ${diffDays} days`;
	}

	if (diffMinutes <= 0) {
		return `Event started at ${eventTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	}
	if (diffMinutes < 60) {
		return `In ${diffMinutes} minutes → at ${eventTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	}
	const diffHours = Math.round(diffMinutes / 60);
	if (diffHours < 24) {
		return `In ${diffHours} hours → at ${eventTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
	}
	const diffDays = Math.round(diffHours / 24);
	return `In ${diffDays} days → ${eventTime.toLocaleDateString([], {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})}`;
}

function formatNotificationDateTime(date: Date | null, allDay: boolean): string {
	if (!date) return "N/A";
	const options: Intl.DateTimeFormatOptions = allDay
		? { year: "numeric", month: "long", day: "numeric" }
		: { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" };
	return date.toLocaleDateString(undefined, options);
}

function renderNotificationProperty(
	container: HTMLElement,
	app: App,
	key: string,
	value: unknown,
	close: () => void
): void {
	const propItem = container.createDiv(cls("event-notification-prop-item"));
	createTextDiv(propItem, key, cls("event-notification-prop-key"));
	const valueEl = propItem.createEl("div", { cls: cls("event-notification-prop-value") });

	const config: PropertyRendererConfig = {
		createLink: (text: string, path: string) => {
			const link = document.createElement("a");
			link.textContent = text;
			link.className = cls("event-notification-prop-value-link");
			link.onclick = (e) => {
				e.preventDefault();
				void app.workspace.openLinkText(path, "", false);
				close();
			};
			return link;
		},
		createText: (text: string) => document.createTextNode(text),
		createSeparator: createDefaultSeparator,
	};

	renderPropertyValue(valueEl, value, config);
}

function renderNotificationPropertiesSection(
	parent: HTMLElement,
	app: App,
	title: string,
	properties: [string, unknown][],
	close: () => void
): void {
	if (properties.length === 0) return;

	const section = parent.createDiv(cls("event-notification-section"));
	createTextDiv(section, title, cls("event-notification-section-title"));
	const grid = section.createDiv(cls("event-notification-props-grid"));

	for (const [key, value] of properties) {
		renderNotificationProperty(grid, app, key, value, close);
	}
}

function renderSnoozeControl(
	container: HTMLElement,
	settings: SingleCalendarConfig,
	onSnooze: () => void,
	close: () => void
): void {
	const snoozeContainer = container.createDiv(cls("event-notification-snooze-container"));

	const snoozeButton = snoozeContainer.createEl("button", { text: "Snooze" });

	const inputGroup = snoozeContainer.createDiv(cls("event-notification-snooze-input-group"));
	const snoozeInput = inputGroup.createEl("input", {
		type: "number",
		value: settings.snoozeMinutes.toString(),
		cls: cls("event-notification-snooze-input"),
	});
	snoozeInput.min = "1";
	snoozeInput.max = "1440";

	inputGroup.createEl("span", { text: "Min", cls: cls("event-notification-snooze-unit") });

	snoozeButton.onclick = () => {
		const minutes = Number.parseInt(snoozeInput.value, 10);
		if (Number.isNaN(minutes) || minutes < 1) {
			snoozeInput.value = settings.snoozeMinutes.toString();
			return;
		}
		onSnooze();
		close();
	};

	snoozeInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") snoozeButton.click();
	});
}

function renderNotificationContent(
	el: HTMLElement,
	app: App,
	eventData: NotificationEventData,
	settings: SingleCalendarConfig,
	close: () => void,
	onSnooze?: () => void
): void {
	const header = el.createDiv(cls("event-notification-header"));
	header.createEl("div", { text: getTimingInfo(eventData), cls: cls("event-notification-timing") });

	const cleanTitle = removeZettelId(eventData.title);
	const titleEl = header.createEl("h2", { text: `🔔 ${cleanTitle}`, cls: cls("event-notification-title") });
	titleEl.onclick = () => {
		void app.workspace.openLinkText(eventData.filePath, "", false);
		close();
	};

	const detailsSection = el.createDiv(cls("event-notification-section"));
	const timeGrid = detailsSection.createDiv(cls("event-notification-time-grid"));

	const startItem = timeGrid.createDiv(cls("event-notification-time-item"));
	createTextDiv(startItem, "Start", cls("event-notification-label"));
	createTextDiv(
		startItem,
		formatNotificationDateTime(eventData.startDate, eventData.isAllDay),
		cls("event-notification-value")
	);

	const fileItem = timeGrid.createDiv(cls("event-notification-time-item"));
	createTextDiv(fileItem, "File", cls("event-notification-label"));
	const fileEl = createTextDiv(
		fileItem,
		eventData.filePath,
		cls("event-notification-value event-notification-file-link")
	);
	fileEl.onclick = () => {
		void app.workspace.openLinkText(eventData.filePath, "", false);
		close();
	};

	const { displayProperties, otherProperties } = categorizeProperties(
		eventData.frontmatter,
		settings,
		eventData.isAllDay
	);

	renderNotificationPropertiesSection(el, app, "Event Properties", displayProperties, close);
	if (otherProperties.length > 0) {
		renderNotificationPropertiesSection(el, app, "Additional Properties", otherProperties, close);
	}

	const buttonContainer = el.createDiv(cls("event-notification-buttons"));

	const openButton = buttonContainer.createEl("button", { text: "Open event", cls: "mod-cta" });
	openButton.onclick = () => {
		void app.workspace.openLinkText(eventData.filePath, "", false);
		close();
	};

	if (onSnooze && !eventData.isAllDay) {
		renderSnoozeControl(buttonContainer, settings, onSnooze, close);
	}

	const dismissButton = buttonContainer.createEl("button", { text: "Dismiss" });
	dismissButton.onclick = close;
}

export function showNotificationModal(
	app: App,
	eventData: NotificationEventData,
	settings: SingleCalendarConfig,
	onSnooze?: () => void
): void {
	showModal({
		app,
		cls: cls("event-notification-modal"),
		render: (el, ctx) => {
			addCls(el, "event-notification-modal");
			renderNotificationContent(el, app, eventData, settings, ctx.close, onSnooze);
		},
	});
}
