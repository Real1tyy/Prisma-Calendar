import { type App, Modal, TFile } from "obsidian";
import { calculateDuration } from "src/utils/format";
import type { CalendarBundle } from "../core/calendar-bundle";
import { createTextDiv } from "../utils/dom-utils";
import type { PropertyRendererConfig } from "../utils/property-renderer";
import { createDefaultSeparator, renderPropertyValue } from "../utils/property-renderer";
import { isNotEmpty } from "../utils/value-checks";

export class EventPreviewModal extends Modal {
	private event: any;
	private bundle: CalendarBundle;
	private allFrontmatter: Record<string, unknown> = {};

	constructor(app: App, bundle: CalendarBundle, event: any) {
		super(app);
		this.bundle = bundle;
		this.event = event;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.addClass("event-preview-modal");

		await this.loadAllFrontmatter();
		this.renderEventPreview();
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
		const header = contentEl.createDiv("event-preview-header");
		const title = this.event.title || "Untitled Event";
		// Remove ZettelID from title if it exists
		const cleanTitle = title.replace(/-\d{14}$/, "");
		const titleEl = header.createEl("h2", { text: cleanTitle });

		// Make title clickable to open file
		const filePath = this.event.extendedProps?.filePath;
		if (filePath) {
			titleEl.onclick = () => {
				this.app.workspace.openLinkText(filePath, "", false);
				this.close();
			};
		}

		// Time and date section
		const timeSection = contentEl.createDiv("event-preview-section event-preview-time-section");
		this.renderTimeInfo(timeSection);

		// Frontmatter properties section - show ALL properties
		const settings = this.bundle.settingsStore.currentSettings;

		// Get known properties to filter out (same as edit modal)
		const knownProperties = new Set([
			settings.startProp,
			settings.endProp,
			settings.dateProp,
			settings.allDayProp,
			settings.skipProp,
			settings.rruleProp,
			settings.rruleSpecProp,
			settings.rruleIdProp,
			settings.sourceProp,
			"position", // Internal Obsidian properties
			"nodeRecurringInstanceDate", // Internal recurring event property
		]);

		if (settings.titleProp) {
			knownProperties.add(settings.titleProp);
		}
		if (settings.zettelIdProp) {
			knownProperties.add(settings.zettelIdProp);
		}

		// Filter out known properties and display all remaining ones
		const customProperties: [string, unknown][] = [];
		for (const [key, value] of Object.entries(this.allFrontmatter)) {
			if (!knownProperties.has(key) && isNotEmpty(value)) {
				customProperties.push([key, value]);
			}
		}

		if (customProperties.length > 0) {
			const propsSection = contentEl.createDiv("event-preview-section event-preview-props-section");
			createTextDiv(propsSection, "Properties", "event-preview-section-title");

			const propsGrid = propsSection.createDiv("event-preview-props-grid");

			for (const [key, value] of customProperties) {
				this.renderProperty(propsGrid, key, value);
			}
		}
	}

	private renderTimeInfo(container: HTMLElement): void {
		const start = this.event.start;
		const end = this.event.end;
		const allDay = this.event.allDay;

		const timeGrid = container.createDiv("event-preview-time-grid");

		// Start date/time
		const startItem = timeGrid.createDiv("event-preview-time-item");
		createTextDiv(startItem, "Start", "event-preview-label");
		createTextDiv(startItem, this.formatDateTime(start, allDay), "event-preview-value");

		// End date/time
		if (end) {
			const endItem = timeGrid.createDiv("event-preview-time-item");
			createTextDiv(endItem, "End", "event-preview-label");
			createTextDiv(endItem, this.formatDateTime(end, allDay), "event-preview-value");
		}

		// Duration (if applicable)
		if (start && end && !allDay) {
			const duration = calculateDuration(start, end);
			const durationItem = timeGrid.createDiv("event-preview-time-item");
			createTextDiv(durationItem, "Duration", "event-preview-label");
			createTextDiv(durationItem, duration, "event-preview-value");
		}
	}

	private renderProperty(container: HTMLElement, key: string, value: any): void {
		const propItem = container.createDiv("event-preview-prop-item");
		createTextDiv(propItem, key, "event-preview-prop-key");
		const valueEl = propItem.createEl("div", { cls: "event-preview-prop-value" });

		const config: PropertyRendererConfig = {
			createLink: (text: string, path: string) => {
				const link = document.createElement("a");
				link.textContent = text;
				link.className = "event-preview-prop-value-link";
				link.onclick = (e) => {
					e.preventDefault();
					this.app.workspace.openLinkText(path, "", false);
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
		if (!date) return "N/A";

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
