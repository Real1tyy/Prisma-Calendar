import { type App, Modal } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";

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
		header.createEl("h2", { text: cleanTitle });

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

		// File path section
		const filePath = this.event.extendedProps?.filePath;
		if (filePath) {
			const fileSection = contentEl.createDiv("event-preview-section event-preview-file-section");
			fileSection.createEl("div", { text: "File", cls: "event-preview-label" });
			const fileLink = fileSection.createEl("a", {
				text: filePath,
				cls: "event-preview-file-link",
			});
			fileLink.onclick = (e) => {
				e.preventDefault();
				this.app.workspace.openLinkText(filePath, "", false);
				this.close();
			};
		}

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
			valueEl.setText(value.join(", "));
		} else if (typeof value === "object") {
			valueEl.setText(JSON.stringify(value));
		} else {
			valueEl.setText(String(value));
		}
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
