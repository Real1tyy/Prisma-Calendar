import { type App, Modal } from "obsidian";
import type { SingleCalendarConfig } from "../types/settings";
import { removeZettelId } from "../utils/calendar-events";
import { createTextDiv } from "../utils/dom-utils";
import { categorizeProperties } from "../utils/format";
import type { PropertyRendererConfig } from "../utils/property-renderer";
import { createDefaultSeparator, renderPropertyValue } from "../utils/property-renderer";

interface NotificationEventData {
	title: string;
	filePath: string;
	startDate: Date;
	isAllDay: boolean;
	frontmatter: Record<string, unknown>;
}

export class NotificationModal extends Modal {
	private eventData: NotificationEventData;
	private settings: SingleCalendarConfig;

	constructor(app: App, eventData: NotificationEventData, settings: SingleCalendarConfig) {
		super(app);
		this.eventData = eventData;
		this.settings = settings;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.addClass("event-notification-modal");

		this.renderNotificationContent();
	}

	private renderNotificationContent(): void {
		const { contentEl } = this;

		// Header with notification timing
		const header = contentEl.createDiv("event-notification-header");
		const timingInfo = this.getTimingInfo();
		header.createEl("div", {
			text: timingInfo,
			cls: "event-notification-timing",
		});

		// Event title
		const cleanTitle = removeZettelId(this.eventData.title);
		const titleEl = header.createEl("h2", {
			text: `🔔 ${cleanTitle}`,
			cls: "event-notification-title",
		});

		// Make title clickable to open file
		titleEl.onclick = () => {
			this.app.workspace.openLinkText(this.eventData.filePath, "", false);
			this.close();
		};

		// Event details section
		const detailsSection = contentEl.createDiv("event-notification-section");
		this.renderEventDetails(detailsSection);

		// Properties section
		const { displayProperties, otherProperties } = categorizeProperties(this.eventData.frontmatter, this.settings);

		this.renderPropertiesSection(contentEl, "Event Properties", displayProperties);
		if (otherProperties.length > 0) {
			this.renderPropertiesSection(contentEl, "Additional Properties", otherProperties);
		}

		// Action buttons
		this.renderActionButtons(contentEl);
	}

	private getTimingInfo(): string {
		const now = new Date();
		const eventTime = this.eventData.startDate;
		const diffMs = eventTime.getTime() - now.getTime();
		const diffMinutes = Math.round(diffMs / (1000 * 60));

		if (this.eventData.isAllDay) {
			if (diffMinutes <= 0) {
				return "Event is today";
			}
			const diffDays = Math.ceil(diffMinutes / (24 * 60));
			if (diffDays === 1) {
				return "Event is tomorrow";
			}
			return `Event in ${diffDays} days`;
		} else {
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
	}

	private renderEventDetails(container: HTMLElement): void {
		const timeGrid = container.createDiv("event-notification-time-grid");

		// Start date/time
		const startItem = timeGrid.createDiv("event-notification-time-item");
		createTextDiv(startItem, "Start", "event-notification-label");
		createTextDiv(
			startItem,
			this.formatDateTime(this.eventData.startDate, this.eventData.isAllDay),
			"event-notification-value"
		);

		// File path
		const fileItem = timeGrid.createDiv("event-notification-time-item");
		createTextDiv(fileItem, "File", "event-notification-label");
		const fileEl = createTextDiv(
			fileItem,
			this.eventData.filePath,
			"event-notification-value event-notification-file-link"
		);
		fileEl.onclick = () => {
			this.app.workspace.openLinkText(this.eventData.filePath, "", false);
			this.close();
		};
	}

	private renderPropertiesSection(parent: HTMLElement, title: string, properties: [string, unknown][]): void {
		if (properties.length === 0) return;

		const section = parent.createDiv("event-notification-section");
		createTextDiv(section, title, "event-notification-section-title");
		const grid = section.createDiv("event-notification-props-grid");

		for (const [key, value] of properties) {
			this.renderProperty(grid, key, value);
		}
	}

	private renderProperty(container: HTMLElement, key: string, value: any): void {
		const propItem = container.createDiv("event-notification-prop-item");
		createTextDiv(propItem, key, "event-notification-prop-key");
		const valueEl = propItem.createEl("div", { cls: "event-notification-prop-value" });

		const config: PropertyRendererConfig = {
			createLink: (text: string, path: string) => {
				const link = document.createElement("a");
				link.textContent = text;
				link.className = "event-notification-prop-value-link";
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

	private renderActionButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv("event-notification-buttons");

		// Open file button
		const openButton = buttonContainer.createEl("button", {
			text: "Open Event",
			cls: "mod-cta",
		});
		openButton.onclick = () => {
			this.app.workspace.openLinkText(this.eventData.filePath, "", false);
			this.close();
		};

		// Dismiss button
		const dismissButton = buttonContainer.createEl("button", {
			text: "Dismiss",
		});
		dismissButton.onclick = () => {
			this.close();
		};
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
