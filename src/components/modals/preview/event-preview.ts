import {
	addCls,
	calculateDuration,
	cls,
	createDefaultSeparator,
	intoDate,
	type PropertyRendererConfig,
	renderPropertyValue,
	showModal,
} from "@real1ty-obsidian-plugins";
import { type App, TFile } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { Frontmatter } from "../../../types";
import { createTextDiv } from "../../../utils/dom-utils";
import { removeZettelId } from "../../../utils/event-naming";
import { categorizeProperties, formatDateOnlyDisplay, formatDateTimeDisplay } from "../../../utils/format";

export interface PreviewEventData {
	title: string;
	start: Date | null;
	end?: Date | null | undefined;
	allDay: boolean;
	extendedProps?:
		| {
				filePath?: string | undefined;
				[key: string]: unknown;
		  }
		| undefined;
}

function loadAllFrontmatter(app: App, filePath: string | undefined): Frontmatter {
	if (!filePath) return {};
	try {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return {};
		const cache = app.metadataCache.getFileCache(file);
		return cache?.frontmatter ? { ...cache.frontmatter } : {};
	} catch (error) {
		console.error("[EventPreview] Error loading frontmatter:", error);
		return {};
	}
}

function formatPreviewDateTime(date: Date | null, allDay: boolean): string {
	if (!date || Number.isNaN(date.getTime())) return "N/A";
	return allDay ? formatDateOnlyDisplay(date) : formatDateTimeDisplay(date);
}

function renderProperty(container: HTMLElement, app: App, key: string, value: unknown, close: () => void): void {
	const propItem = container.createDiv(cls("event-preview-prop-item"));
	createTextDiv(propItem, key, cls("event-preview-prop-key"));
	const valueEl = propItem.createEl("div", { cls: cls("event-preview-prop-value") });

	const config: PropertyRendererConfig = {
		createLink: (text: string, path: string) => {
			const link = document.createElement("a");
			link.textContent = text;
			link.className = cls("event-preview-prop-value-link");
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

function renderPropertiesSection(
	parent: HTMLElement,
	app: App,
	title: string,
	properties: [string, unknown][],
	close: () => void
): void {
	if (properties.length === 0) return;

	const section = parent.createDiv(cls("event-preview-section event-preview-props-section"));
	createTextDiv(section, title, cls("event-preview-section-title"));
	const grid = section.createDiv(cls("event-preview-props-grid"));

	for (const [key, value] of properties) {
		renderProperty(grid, app, key, value, close);
	}
}

function renderEventPreview(
	el: HTMLElement,
	app: App,
	bundle: CalendarBundle,
	event: PreviewEventData,
	close: () => void
): void {
	const filePath = event.extendedProps?.filePath;
	const allFrontmatter = loadAllFrontmatter(app, filePath);

	el.setAttribute("data-testid", "prisma-event-preview-modal");

	const header = el.createDiv(cls("event-preview-header"));
	const title = event.title || "Untitled Event";
	const cleanTitle = removeZettelId(title);
	const titleEl = header.createEl("h2", {
		text: cleanTitle,
		attr: { "data-testid": "prisma-event-preview-title" },
	});

	if (filePath) {
		titleEl.onclick = () => {
			void app.workspace.openLinkText(filePath, "", false);
			close();
		};
	}

	const timeSection = el.createDiv(cls("event-preview-section event-preview-time-section"));
	const timeGrid = timeSection.createDiv(cls("event-preview-time-grid"));

	const startItem = timeGrid.createDiv(cls("event-preview-time-item"));
	createTextDiv(startItem, "Start", cls("event-preview-label"));
	createTextDiv(startItem, formatPreviewDateTime(event.start, event.allDay), cls("event-preview-value"));

	if (event.end) {
		const endItem = timeGrid.createDiv(cls("event-preview-time-item"));
		createTextDiv(endItem, "End", cls("event-preview-label"));
		createTextDiv(endItem, formatPreviewDateTime(event.end, event.allDay), cls("event-preview-value"));
	}

	if (event.start && event.end && !event.allDay) {
		const startDate = intoDate(event.start);
		const endDate = intoDate(event.end);
		if (startDate && endDate) {
			const duration = calculateDuration(startDate, endDate);
			const durationItem = timeGrid.createDiv(cls("event-preview-time-item"));
			createTextDiv(durationItem, "Duration", cls("event-preview-label"));
			createTextDiv(durationItem, duration, cls("event-preview-value"));
		}
	}

	const settings = bundle.settingsStore.currentSettings;
	const { displayProperties, otherProperties } = categorizeProperties(allFrontmatter, settings, event.allDay);

	renderPropertiesSection(el, app, "Display Properties", displayProperties, close);
	renderPropertiesSection(el, app, "Other Properties", otherProperties, close);
}

export function showEventPreviewModal(app: App, bundle: CalendarBundle, event: PreviewEventData): void {
	showModal({
		app,
		cls: cls("event-preview-modal"),
		render: (el, ctx) => {
			addCls(el, "event-preview-modal");
			renderEventPreview(el, app, bundle, event, ctx.close);
		},
	});
}
