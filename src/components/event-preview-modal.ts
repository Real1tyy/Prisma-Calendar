import {
	addCls,
	cls,
	createDefaultSeparator,
	type PropertyRendererConfig,
	renderPropertyValue,
} from "@real1ty-obsidian-plugins/utils";
import { type App, Modal, TFile } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { removeZettelId } from "../utils/calendar-events";
import { createTextDiv } from "../utils/dom-utils";
import { calculateDuration, categorizeProperties, intoDate } from "../utils/format";

export interface PreviewEventData {
	title: string;
	start: Date | null;
	end?: Date | null;
	allDay: boolean;
	extendedProps?: {
		filePath?: string;
		[key: string]: unknown;
	};
}

export class EventPreviewModal extends Modal {
	private event: PreviewEventData;
	private bundle: CalendarBundle;
	private allFrontmatter: Record<string, unknown> = {};

	constructor(app: App, bundle: CalendarBundle, event: PreviewEventData) {
		super(app);
		this.bundle = bundle;
		this.event = event;
	}

	onOpen(): void {
		const { contentEl } = this;
		addCls(contentEl, "event-preview-modal");

		void this.loadAllFrontmatter().then(() => {
			this.renderEventPreview();
		});
	}

	private async loadAllFrontmatter(): Promise<void> {
		try {
			const filePath = this.event.extendedProps?.filePath;
			if (!filePath) return;

			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) return;

			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				this.allFrontmatter = { ...cache.frontmatter };
			}
		} catch (error) {
			console.error("Error loading frontmatter:", error);
		}
	}

	private renderEventPreview(): void {
		const { contentEl } = this;

		// Header section with title
		const header = contentEl.createDiv(cls("event-preview-header"));
		const title = this.event.title || "Untitled Event";
		const cleanTitle = removeZettelId(title);
		const titleEl = header.createEl("h2", { text: cleanTitle });

		// Make title clickable to open file
		const filePath = this.event.extendedProps?.filePath;
		if (filePath) {
			titleEl.onclick = () => {
				void this.app.workspace.openLinkText(filePath, "", false);
				this.close();
			};
		}

		// Time and date section
		const timeSection = contentEl.createDiv(cls("event-preview-section event-preview-time-section"));
		this.renderTimeInfo(timeSection);

		const settings = this.bundle.settingsStore.currentSettings;

		const { displayProperties, otherProperties } = categorizeProperties(this.allFrontmatter, settings);

		this.renderPropertiesSection(contentEl, "Display Properties", displayProperties);
		this.renderPropertiesSection(contentEl, "Other Properties", otherProperties);
	}

	private renderPropertiesSection(parent: HTMLElement, title: string, properties: [string, unknown][]): void {
		if (properties.length === 0) return;

		const section = parent.createDiv(cls("event-preview-section event-preview-props-section"));
		createTextDiv(section, title, cls("event-preview-section-title"));
		const grid = section.createDiv(cls("event-preview-props-grid"));

		for (const [key, value] of properties) {
			this.renderProperty(grid, key, value);
		}
	}

	private renderTimeInfo(container: HTMLElement): void {
		const start = this.event.start;
		const end = this.event.end;
		const allDay = this.event.allDay;

		const timeGrid = container.createDiv(cls("event-preview-time-grid"));

		// Start date/time
		const startItem = timeGrid.createDiv(cls("event-preview-time-item"));
		createTextDiv(startItem, "Start", cls("event-preview-label"));
		createTextDiv(startItem, this.formatDateTime(start, allDay), cls("event-preview-value"));

		// End date/time
		if (end) {
			const endItem = timeGrid.createDiv(cls("event-preview-time-item"));
			createTextDiv(endItem, "End", cls("event-preview-label"));
			createTextDiv(endItem, this.formatDateTime(end, allDay), cls("event-preview-value"));
		}

		// Duration (if applicable)
		if (start && end && !allDay) {
			const startDate = intoDate(start);
			const endDate = intoDate(end);
			if (startDate && endDate) {
				const duration = calculateDuration(startDate, endDate);
				const durationItem = timeGrid.createDiv(cls("event-preview-time-item"));
				createTextDiv(durationItem, "Duration", cls("event-preview-label"));
				createTextDiv(durationItem, duration, cls("event-preview-value"));
			}
		}
	}

	private renderProperty(container: HTMLElement, key: string, value: unknown): void {
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
					void this.app.workspace.openLinkText(path, "", false);
					this.close();
				};
				return link;
			},
			createText: (text: string) => {
				return document.createTextNode(text);
			},
			createSeparator: createDefaultSeparator,
		};

		renderPropertyValue(valueEl, value, config);
	}

	private formatDateTime(date: Date | null, allDay: boolean): string {
		if (!date || Number.isNaN(date.getTime())) return "N/A";

		const options: Intl.DateTimeFormatOptions = allDay
			? { year: "numeric", month: "long", day: "numeric" }
			: {
					year: "numeric",
					month: "long",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
				};

		return date.toLocaleDateString(undefined, options);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
