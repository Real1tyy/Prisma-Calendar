import type { RecurrenceType, Weekday } from "@real1ty-obsidian-plugins/utils/date-recurrence-utils";
import { parseFrontmatterRecord, serializeFrontmatterValue } from "@real1ty-obsidian-plugins/utils/frontmatter-utils";
import { type App, Modal, TFile } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { RECURRENCE_TYPE_OPTIONS, WEEKDAY_OPTIONS, WEEKDAY_SUPPORTED_TYPES } from "../types/recurring-event";
import { formatDateOnly, formatDateTimeForInput, inputValueToISOString } from "../utils/format";
import { isNotEmpty } from "../utils/value-checks";

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

interface CustomProperty {
	key: string;
	value: string;
}

abstract class BaseEventModal extends Modal {
	protected event: EventModalData;
	protected bundle: CalendarBundle;
	protected onSave: (eventData: EventSaveData) => void;
	public titleInput!: HTMLInputElement;
	public startInput!: HTMLInputElement;
	public endInput!: HTMLInputElement;
	protected dateInput!: HTMLInputElement;
	public allDayCheckbox!: HTMLInputElement;
	public originalFrontmatter: Record<string, unknown> = {};
	protected timedContainer!: HTMLElement;
	protected allDayContainer!: HTMLElement;

	// Recurring event fields
	public recurringCheckbox!: HTMLInputElement;
	protected recurringContainer!: HTMLElement;
	protected rruleSelect!: HTMLSelectElement;
	protected weekdayContainer!: HTMLElement;
	protected weekdayCheckboxes: Map<Weekday, HTMLInputElement> = new Map();

	// Custom properties
	protected customProperties: CustomProperty[] = [];
	protected customPropertiesContainer!: HTMLElement;
	public originalCustomPropertyKeys: Set<string> = new Set();

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

		contentEl.createEl("h2", { text: this.getModalTitle() });
		this.createFormFields(contentEl);
		this.setupEventHandlers(contentEl);
		this.titleInput.focus();
		this.createActionButtons(contentEl);
	}

	protected abstract getModalTitle(): string;
	protected abstract getSaveButtonText(): string;
	protected abstract initialize(): Promise<void>;

	private createFormFields(contentEl: HTMLElement): void {
		const titleContainer = contentEl.createDiv("setting-item");
		titleContainer.createEl("div", { text: "Title", cls: "setting-item-name" });
		this.titleInput = titleContainer.createEl("input", {
			type: "text",
			value: this.event.title || "",
			cls: "setting-item-control",
		});

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
			value: this.event.start ? formatDateTimeForInput(this.event.start) : "",
			cls: "setting-item-control",
		});

		// End date/time field (for timed events)
		const endContainer = this.timedContainer.createDiv("setting-item");
		endContainer.createEl("div", { text: "End Date", cls: "setting-item-name" });
		this.endInput = endContainer.createEl("input", {
			type: "datetime-local",
			value: this.event.end ? formatDateTimeForInput(this.event.end) : "",
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

		this.createRecurringEventFields(contentEl);
		this.createCustomPropertiesFields(contentEl);
	}

	private createRecurringEventFields(contentEl: HTMLElement): void {
		// Recurring event checkbox
		const recurringCheckboxContainer = contentEl.createDiv("setting-item");
		recurringCheckboxContainer.createEl("div", { text: "Recurring Event", cls: "setting-item-name" });
		this.recurringCheckbox = recurringCheckboxContainer.createEl("input", {
			type: "checkbox",
			cls: "setting-item-control",
		});

		// Container for recurring event options (initially hidden)
		this.recurringContainer = contentEl.createDiv("recurring-event-fields");
		this.recurringContainer.style.display = "none";

		// RRule type dropdown
		const rruleContainer = this.recurringContainer.createDiv("setting-item");
		rruleContainer.createEl("div", { text: "Recurrence Pattern", cls: "setting-item-name" });
		this.rruleSelect = rruleContainer.createEl("select", { cls: "setting-item-control" });

		// Add options to the select
		for (const [value, label] of Object.entries(RECURRENCE_TYPE_OPTIONS)) {
			const option = this.rruleSelect.createEl("option", { value, text: label });
			option.value = value;
		}

		// Weekday selection (initially hidden, shown when weekly/bi-weekly selected)
		this.weekdayContainer = this.recurringContainer.createDiv("setting-item weekday-selection");
		this.weekdayContainer.style.display = "none";
		this.weekdayContainer.createEl("div", { text: "Days of Week", cls: "setting-item-name" });

		const weekdayGrid = this.weekdayContainer.createDiv("weekday-grid");
		weekdayGrid.style.cssText = "display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px;";

		// Create checkboxes for each weekday
		for (const [value, label] of Object.entries(WEEKDAY_OPTIONS)) {
			const weekdayItem = weekdayGrid.createDiv("weekday-item");
			weekdayItem.style.cssText = "display: flex; align-items: center; gap: 8px;";

			const checkbox = weekdayItem.createEl("input", {
				type: "checkbox",
				attr: { "data-weekday": value },
			});
			weekdayItem.createEl("label", { text: label });

			this.weekdayCheckboxes.set(value as Weekday, checkbox);
		}
	}

	private createCustomPropertiesFields(contentEl: HTMLElement): void {
		// Custom properties section header
		const headerContainer = contentEl.createDiv("setting-item");
		const headerDiv = headerContainer.createDiv("setting-item-name");
		headerDiv.createEl("div", { text: "Custom Properties", cls: "setting-item-heading" });

		const addButton = headerContainer.createEl("button", {
			text: "+ Add Property",
			cls: "mod-cta",
		});
		addButton.style.marginLeft = "auto";
		addButton.addEventListener("click", () => {
			this.addCustomProperty();
		});

		// Container for custom property rows
		this.customPropertiesContainer = contentEl.createDiv("custom-properties-container");
		this.customPropertiesContainer.style.cssText = "display: flex; flex-direction: column; gap: 8px; margin-top: 8px;";
	}

	protected addCustomProperty(key = "", value = ""): void {
		const propertyRow = this.customPropertiesContainer.createDiv("custom-property-row");
		propertyRow.style.cssText = "display: flex; gap: 8px; align-items: center;";

		const keyInput = propertyRow.createEl("input", {
			type: "text",
			placeholder: "Property name",
			value: key,
			cls: "setting-item-control",
		});
		keyInput.style.flex = "1";

		const valueInput = propertyRow.createEl("input", {
			type: "text",
			placeholder: "Value",
			value: value,
			cls: "setting-item-control",
		});
		valueInput.style.flex = "1";

		const removeButton = propertyRow.createEl("button", {
			text: "Remove",
		});
		removeButton.addEventListener("click", () => {
			propertyRow.remove();
		});

		// Track the property
		this.customProperties.push({ key, value });
	}

	public getCustomProperties(): Record<string, unknown> {
		const properties: Record<string, string> = {};
		const rows = this.customPropertiesContainer.querySelectorAll(".custom-property-row");

		for (const row of Array.from(rows)) {
			const keyInput = row.querySelector("input[placeholder='Property name']") as HTMLInputElement;
			const valueInput = row.querySelector("input[placeholder='Value']") as HTMLInputElement;

			if (keyInput?.value && valueInput?.value) {
				properties[keyInput.value] = valueInput.value;
			}
		}

		// Parse string values back to their original types (arrays, numbers, booleans, etc.)
		return parseFrontmatterRecord(properties);
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

		// Handle recurring event checkbox toggle
		this.recurringCheckbox.addEventListener("change", () => {
			this.recurringContainer.style.display = this.recurringCheckbox.checked ? "block" : "none";
		});

		// Handle RRule type selection
		this.rruleSelect.addEventListener("change", () => {
			const selectedType = this.rruleSelect.value as RecurrenceType;
			// Show weekday selection only for weekly and bi-weekly
			const showWeekdays = WEEKDAY_SUPPORTED_TYPES.includes(selectedType as any);
			this.weekdayContainer.style.display = showWeekdays ? "block" : "none";
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

	public saveEvent(): void {
		const settings = this.bundle.settingsStore.currentSettings;

		// Start with original frontmatter to preserve all existing properties
		const preservedFrontmatter = { ...this.originalFrontmatter };

		// Update title if titleProp is configured and value is provided
		if (this.titleInput.value && settings.titleProp) {
			preservedFrontmatter[settings.titleProp] = this.titleInput.value;
		}

		preservedFrontmatter[settings.allDayProp] = this.allDayCheckbox.checked;

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
			preservedFrontmatter[settings.startProp] = inputValueToISOString(this.startInput.value);
			if (this.endInput.value) {
				preservedFrontmatter[settings.endProp] = inputValueToISOString(this.endInput.value);
			}
			delete preservedFrontmatter[settings.dateProp];

			start = inputValueToISOString(this.startInput.value);
			end = this.endInput.value ? inputValueToISOString(this.endInput.value) : null;
		}

		// Handle recurring event properties
		if (this.recurringCheckbox.checked) {
			const rruleType = this.rruleSelect.value as RecurrenceType;
			preservedFrontmatter[settings.rruleProp] = rruleType;

			// Handle weekdays for weekly/bi-weekly events
			if (WEEKDAY_SUPPORTED_TYPES.includes(rruleType as any)) {
				const selectedWeekdays: Weekday[] = [];
				for (const [weekday, checkbox] of this.weekdayCheckboxes.entries()) {
					if (checkbox.checked) {
						selectedWeekdays.push(weekday);
					}
				}

				// Only add RRuleSpec if weekdays are selected
				if (selectedWeekdays.length > 0) {
					preservedFrontmatter[settings.rruleSpecProp] = selectedWeekdays.join(", ");
				}
			} else {
				// Clear RRuleSpec for non-weekly events
				delete preservedFrontmatter[settings.rruleSpecProp];
			}
		} else {
			// Clear recurring event properties if not checked
			delete preservedFrontmatter[settings.rruleProp];
			delete preservedFrontmatter[settings.rruleSpecProp];
		}

		const customProps = this.getCustomProperties();
		const currentCustomKeys = new Set(Object.keys(customProps));

		for (const [key, value] of Object.entries(customProps)) {
			preservedFrontmatter[key] = value;
		}

		for (const originalKey of this.originalCustomPropertyKeys) {
			if (!currentCustomKeys.has(originalKey)) {
				delete preservedFrontmatter[originalKey];
			}
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
	private originalZettelId: string | null = null;
	private displayTitle: string = "";

	protected getModalTitle(): string {
		return "Edit Event";
	}

	protected getSaveButtonText(): string {
		return "Save";
	}

	protected async initialize(): Promise<void> {
		await this.loadExistingFrontmatter();

		// Extract and store ZettelID from the original title
		if (this.event.title) {
			const zettelIdMatch = this.event.title.match(/-(\d{14})$/);
			if (zettelIdMatch) {
				this.originalZettelId = zettelIdMatch[0]; // Store "-20250103123456" format
				this.displayTitle = this.event.title.replace(/-\d{14}$/, "");
			} else {
				this.displayTitle = this.event.title;
			}
		}
	}

	private async loadRecurringEventData(): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		const rruleType = this.originalFrontmatter[settings.rruleProp] as RecurrenceType | undefined;

		if (rruleType) {
			// Event has recurring rule
			this.recurringCheckbox.checked = true;
			this.recurringContainer.style.display = "block";
			this.rruleSelect.value = rruleType;

			// Load weekdays if applicable
			if (WEEKDAY_SUPPORTED_TYPES.includes(rruleType as any)) {
				this.weekdayContainer.style.display = "block";

				const rruleSpec = this.originalFrontmatter[settings.rruleSpecProp] as string | undefined;
				if (rruleSpec) {
					const weekdays = rruleSpec.split(",").map((day) => day.trim().toLowerCase());

					for (const weekday of weekdays) {
						const checkbox = this.weekdayCheckboxes.get(weekday as Weekday);
						if (checkbox) {
							checkbox.checked = true;
						}
					}
				}
			}
		}
	}

	private async loadCustomPropertiesData(): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;

		// List of known properties that should not be treated as custom
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

		// Load custom properties that are not in the known list
		for (const [key, value] of Object.entries(this.originalFrontmatter)) {
			if (!knownProperties.has(key) && isNotEmpty(value)) {
				this.originalCustomPropertyKeys.add(key);

				// Serialize value to string for display (preserves type information)
				const stringValue = serializeFrontmatterValue(value);
				this.addCustomProperty(key, stringValue);
			}
		}
	}

	async onOpen(): Promise<void> {
		// Call parent onOpen first
		await super.onOpen();

		// Update the title input with the display title (without ZettelID)
		if (this.displayTitle && this.titleInput) {
			this.titleInput.value = this.displayTitle;
		}

		await this.loadRecurringEventData();
		await this.loadCustomPropertiesData();
	}

	public saveEvent(): void {
		// Reconstruct the title with ZettelID before saving
		const userTitle = this.titleInput.value;
		let finalTitle = userTitle;

		// If there was a ZettelID, append it back
		if (this.originalZettelId) {
			finalTitle = `${userTitle}${this.originalZettelId}`;
		}

		// Temporarily update the input value with the full title for the parent save logic
		const originalInputValue = this.titleInput.value;
		this.titleInput.value = finalTitle;

		// Call parent save logic
		super.saveEvent();

		// Restore the input value (though the modal will close anyway)
		this.titleInput.value = originalInputValue;
	}
}
