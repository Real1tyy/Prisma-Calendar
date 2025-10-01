import { type App, Modal } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { getObsidianLinkDisplay, getObsidianLinkPath, isFilePath, isObsidianLink } from "../utils/obsidian-link-utils";

export class EventPreviewModal extends Modal {
	private event: any;
	private bundle: CalendarBundle;

	constructor(app: App, bundle: CalendarBundle, event: any) {
		super(app);
		this.bundle = bundle;
		this.event = event;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("event-preview-modal");

		this.renderEventPreview();

		// Allow closing with ESC (Modal handles this by default)
		this.scope.register([], "Escape", () => {
			this.close();
		});
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

		// Close button
		const closeBtn = header.createEl("button", {
			cls: "event-preview-close-btn",
			attr: { "aria-label": "Close" },
		});
		closeBtn.innerHTML = "×";
		closeBtn.onclick = () => this.close();

		// Time and date section
		const timeSection = contentEl.createDiv("event-preview-section event-preview-time-section");
		this.renderTimeInfo(timeSection);

		// Frontmatter properties section
		const settings = this.bundle.settingsStore.currentSettings;
		const displayData = this.event.extendedProps?.frontmatterDisplayData;

		if (displayData && settings.frontmatterDisplayProperties.length > 0) {
			const propsSection = contentEl.createDiv("event-preview-section event-preview-props-section");
			propsSection.createEl("div", { text: "Properties", cls: "event-preview-section-title" });

			const propsGrid = propsSection.createDiv("event-preview-props-grid");

			for (const prop of settings.frontmatterDisplayProperties) {
				const value = displayData[prop];
				if (value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0)) {
					this.renderProperty(propsGrid, prop, value);
				}
			}

			if (propsGrid.children.length === 0) {
				propsSection.createEl("p", {
					text: "No properties to display",
					cls: "event-preview-empty-message",
				});
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
		startItem.createEl("div", { text: "Start", cls: "event-preview-label" });
		startItem.createEl("div", {
			text: this.formatDateTime(start, allDay),
			cls: "event-preview-value",
		});

		// End date/time
		if (end) {
			const endItem = timeGrid.createDiv("event-preview-time-item");
			endItem.createEl("div", { text: "End", cls: "event-preview-label" });
			endItem.createEl("div", {
				text: this.formatDateTime(end, allDay),
				cls: "event-preview-value",
			});
		}

		// Duration (if applicable)
		if (start && end && !allDay) {
			const duration = this.calculateDuration(start, end);
			const durationItem = timeGrid.createDiv("event-preview-time-item");
			durationItem.createEl("div", { text: "Duration", cls: "event-preview-label" });
			durationItem.createEl("div", {
				text: duration,
				cls: "event-preview-value",
			});
		}
	}

	private renderProperty(container: HTMLElement, key: string, value: any): void {
		const propItem = container.createDiv("event-preview-prop-item");

		propItem.createEl("div", {
			text: key,
			cls: "event-preview-prop-key",
		});

		const valueEl = propItem.createEl("div", {
			cls: "event-preview-prop-value",
		});

		// Handle different value types
		if (Array.isArray(value)) {
			const hasClickableLinks = value.some((item) => isFilePath(item) || isObsidianLink(item));

			if (hasClickableLinks) {
				// Render each item separately, making file paths and links clickable
				value.forEach((item, index) => {
					if (index > 0) {
						valueEl.createSpan({ text: ", " });
					}
					this.renderValue(valueEl, item);
				});
			} else {
				valueEl.setText(value.join(", "));
			}
		} else if (typeof value === "object") {
			valueEl.setText(JSON.stringify(value));
		} else {
			this.renderValue(valueEl, value);
		}
	}

	private renderValue(container: HTMLElement, value: any): void {
		const stringValue = String(value).trim();

		if (isObsidianLink(stringValue)) {
			const displayText = getObsidianLinkDisplay(stringValue);
			const linkPath = getObsidianLinkPath(stringValue);

			const link = container.createEl("a", {
				text: displayText,
				cls: "event-preview-prop-value-link",
			});
			link.onclick = (e) => {
				e.preventDefault();
				this.app.workspace.openLinkText(linkPath, "", false);
				this.close();
			};
			return;
		}

		if (isFilePath(stringValue)) {
			const link = container.createEl("a", {
				text: stringValue,
				cls: "event-preview-prop-value-link",
			});
			link.onclick = (e) => {
				e.preventDefault();
				this.app.workspace.openLinkText(stringValue, "", false);
				this.close();
			};
			return;
		}

		container.createSpan({ text: stringValue });
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

	private calculateDuration(start: Date, end: Date): string {
		const durationMs = end.getTime() - start.getTime();
		const hours = Math.floor(durationMs / (1000 * 60 * 60));
		const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

		if (hours === 0) {
			return `${minutes}m`;
		}
		if (minutes === 0) {
			return `${hours}h`;
		}
		return `${hours}h ${minutes}m`;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
