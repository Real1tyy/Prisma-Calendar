import { type App, Modal, TFile } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";

function formatDateTimeForInputUTC(dateInput: string | Date): string {
	// Convert to Date object if it's a string
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

	// Extract UTC components directly
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	const hours = String(date.getUTCHours()).padStart(2, "0");
	const minutes = String(date.getUTCMinutes()).padStart(2, "0");

	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateOnly(dateInput: string | Date): string {
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	// Use UTC components to avoid timezone conversion
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

/**
 * Converts datetime-local input value to UTC ISO string without timezone conversion.
 * Takes "2025-10-03T17:30" and returns "2025-10-03T17:30:00.000Z"
 */
function inputValueToISOStringUTC(inputValue: string): string {
	// Append seconds and Z to make it a UTC ISO string
	return `${inputValue}:00.000Z`;
}

interface EventModalData {
	title: string;
	start: string | Date | null;
	end?: string | Date | null;
	allDay?: boolean;
	extendedProps?: {
		filePath?: string | null;
		[key: string]: unknown;
	};
}

interface EventSaveData {
	filePath: string | null;
	title: string;
	start: string | null;
	end: string | null;
	allDay: boolean;
	preservedFrontmatter: Record<string, unknown>;
}

abstract class BaseEventModal extends Modal {
	protected event: EventModalData;
	protected bundle: CalendarBundle;
	protected onSave: (eventData: EventSaveData) => void;
	protected titleInput!: HTMLInputElement;
	protected startInput!: HTMLInputElement;
	protected endInput!: HTMLInputElement;
	protected dateInput!: HTMLInputElement;
	protected allDayCheckbox!: HTMLInputElement;
	protected originalFrontmatter: Record<string, unknown> = {};
	protected timedContainer!: HTMLElement;
	protected allDayContainer!: HTMLElement;

	constructor(app: App, bundle: CalendarBundle, event: EventModalData, onSave: (eventData: EventSaveData) => void) {
		super(app);
		this.event = event;
		this.bundle = bundle;
		this.onSave = onSave;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		// Allow subclasses to perform initialization
		await this.initialize();

		// Create modal header
		contentEl.createEl("h2", { text: this.getModalTitle() });

		// Create form fields
		this.createFormFields(contentEl);

		// Setup event handlers
		this.setupEventHandlers(contentEl);

		// Focus the title input for better UX
		this.titleInput.focus();

		// Create action buttons
		this.createActionButtons(contentEl);
	}

	protected abstract getModalTitle(): string;
	protected abstract getSaveButtonText(): string;
	protected abstract initialize(): Promise<void>;

	private createFormFields(contentEl: HTMLElement): void {
		// Title field
		const titleContainer = contentEl.createDiv("setting-item");
		titleContainer.createEl("div", { text: "Title", cls: "setting-item-name" });
		this.titleInput = titleContainer.createEl("input", {
			type: "text",
			value: this.event.title || "",
			cls: "setting-item-control",
		});

		// All day checkbox
		const allDayContainer = contentEl.createDiv("setting-item");
		allDayContainer.createEl("div", { text: "All Day", cls: "setting-item-name" });
		this.allDayCheckbox = allDayContainer.createEl("input", {
			type: "checkbox",
			cls: "setting-item-control",
		});
		this.allDayCheckbox.checked = this.event.allDay || false;

		// Container for TIMED event fields (Start Date/Time + End Date/Time)
		this.timedContainer = contentEl.createDiv("timed-event-fields");
		this.timedContainer.style.display = this.event.allDay ? "none" : "block";

		// Start date/time field (for timed events)
		const startContainer = this.timedContainer.createDiv("setting-item");
		startContainer.createEl("div", { text: "Start Date", cls: "setting-item-name" });
		this.startInput = startContainer.createEl("input", {
			type: "datetime-local",
			value: this.event.start ? formatDateTimeForInputUTC(this.event.start) : "",
			cls: "setting-item-control",
		});

		// End date/time field (for timed events)
		const endContainer = this.timedContainer.createDiv("setting-item");
		endContainer.createEl("div", { text: "End Date", cls: "setting-item-name" });
		this.endInput = endContainer.createEl("input", {
			type: "datetime-local",
			value: this.event.end ? formatDateTimeForInputUTC(this.event.end) : "",
			cls: "setting-item-control",
		});

		// Container for ALL-DAY event fields (Date only)
		this.allDayContainer = contentEl.createDiv("allday-event-fields");
		this.allDayContainer.style.display = this.event.allDay ? "block" : "none";

		// Date field (for all-day events)
		const dateContainer = this.allDayContainer.createDiv("setting-item");
		dateContainer.createEl("div", { text: "Date", cls: "setting-item-name" });
		this.dateInput = dateContainer.createEl("input", {
			type: "date",
			value: this.event.start ? formatDateOnly(this.event.start) : "",
			cls: "setting-item-control",
		});
	}

	private setupEventHandlers(contentEl: HTMLElement): void {
		// Handle all-day toggle
		this.allDayCheckbox.addEventListener("change", () => {
			if (this.allDayCheckbox.checked) {
				// Switching TO all-day
				this.timedContainer.style.display = "none";
				this.allDayContainer.style.display = "block";
				// Copy start date to date field if available
				if (this.startInput.value) {
					this.dateInput.value = formatDateOnly(this.startInput.value);
				}
			} else {
				// Switching TO timed
				this.timedContainer.style.display = "block";
				this.allDayContainer.style.display = "none";
				// Copy date to start field if available
				if (this.dateInput.value) {
					this.startInput.value = `${this.dateInput.value}T09:00`;
					this.endInput.value = `${this.dateInput.value}T10:00`;
				}
			}
		});

		// Add Enter key handler for the modal
		contentEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey) {
				e.preventDefault();
				this.saveEvent();
			}
		});
	}

	private createActionButtons(contentEl: HTMLElement): void {
		const buttonContainer = contentEl.createDiv("modal-button-container");

		const saveButton = buttonContainer.createEl("button", {
			text: this.getSaveButtonText(),
			cls: "mod-cta",
		});
		saveButton.addEventListener("click", () => {
			this.saveEvent();
		});

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.addEventListener("click", () => {
			this.close();
		});
	}

	protected saveEvent(): void {
		const settings = this.bundle.settingsStore.currentSettings;

		// Start with original frontmatter to preserve all existing properties
		const preservedFrontmatter = { ...this.originalFrontmatter };

		// Update title if provided
		if (this.titleInput.value && settings.titleProp) {
			preservedFrontmatter[settings.titleProp] = this.titleInput.value;
		}

		// Update allDay property
		if (settings.allDayProp) {
			preservedFrontmatter[settings.allDayProp] = this.allDayCheckbox.checked;
		}

		let start: string | null;
		let end: string | null;

		if (this.allDayCheckbox.checked) {
			// ALL-DAY EVENT: Use dateProp, clear startProp/endProp
			preservedFrontmatter[settings.dateProp] = this.dateInput.value;
			delete preservedFrontmatter[settings.startProp];
			delete preservedFrontmatter[settings.endProp];

			// For FullCalendar compatibility, we still return ISO strings
			start = `${this.dateInput.value}T00:00:00`;
			end = `${this.dateInput.value}T23:59:59`;
		} else {
			// TIMED EVENT: Use startProp/endProp, clear dateProp
			preservedFrontmatter[settings.startProp] = inputValueToISOStringUTC(this.startInput.value);
			if (this.endInput.value) {
				preservedFrontmatter[settings.endProp] = inputValueToISOStringUTC(this.endInput.value);
			}
			delete preservedFrontmatter[settings.dateProp];

			start = inputValueToISOStringUTC(this.startInput.value);
			end = this.endInput.value ? inputValueToISOStringUTC(this.endInput.value) : null;
		}

		const eventData: EventSaveData = {
			filePath: this.event.extendedProps?.filePath || null,
			title: this.titleInput.value,
			start,
			end,
			allDay: this.allDayCheckbox.checked,
			preservedFrontmatter,
		};

		this.onSave(eventData);
		this.close();
	}

	protected async loadExistingFrontmatter(): Promise<void> {
		try {
			const filePath = this.event.extendedProps?.filePath;
			if (!filePath) return;

			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) return;

			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter) {
				this.originalFrontmatter = { ...cache.frontmatter };
			}
		} catch (error) {
			console.error("Error loading existing frontmatter:", error);
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class EventCreateModal extends BaseEventModal {
	protected getModalTitle(): string {
		return "Create Event";
	}

	protected getSaveButtonText(): string {
		return "Create";
	}

	protected async initialize(): Promise<void> {
		// No initialization needed for create mode
	}
}

export class EventEditModal extends BaseEventModal {
	protected getModalTitle(): string {
		return "Edit Event";
	}

	protected getSaveButtonText(): string {
		return "Save";
	}

	protected async initialize(): Promise<void> {
		await this.loadExistingFrontmatter();
	}
}
