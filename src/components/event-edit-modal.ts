import {
	addCls,
	cls,
	parseFrontmatterRecord,
	parsePositiveInt,
	serializeFrontmatterValue,
} from "@real1ty-obsidian-plugins/utils";
import { type App, Modal, TFile } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { RECURRENCE_TYPE_OPTIONS, WEEKDAY_OPTIONS, WEEKDAY_SUPPORTED_TYPES } from "../types/recurring-event";
import { extractZettelId, removeZettelId } from "../utils/calendar-events";
import type { RecurrenceType, Weekday } from "../utils/date-recurrence";
import {
	calculateDurationMinutes,
	categorizeProperties,
	formatDateOnly,
	formatDateTimeForInput,
	inputValueToISOString,
} from "../utils/format";
import { CategoryInput } from "./category-input";

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
	start: string;
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
	public durationInput!: HTMLInputElement;
	protected durationContainer!: HTMLElement;
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
	protected futureInstancesCountInput!: HTMLInputElement;

	protected categoryInput?: CategoryInput;

	// Custom properties
	protected customProperties: CustomProperty[] = [];
	protected displayPropertiesContainer!: HTMLElement;
	protected otherPropertiesContainer!: HTMLElement;
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

		addCls(this.modalEl, "event-modal");

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
		allDayContainer.createEl("div", { text: "All day", cls: "setting-item-name" });
		this.allDayCheckbox = allDayContainer.createEl("input", {
			type: "checkbox",
			cls: "setting-item-control",
		});
		this.allDayCheckbox.checked = this.event.allDay || false;

		// Container for TIMED event fields (Start Date/Time + End Date/Time)
		this.timedContainer = contentEl.createDiv("timed-event-fields");
		if (this.event.allDay) {
			this.timedContainer.classList.add("prisma-hidden");
		}

		// Start date/time field (for timed events)
		this.startInput = this.createDateTimeInputWithNowButton(
			this.timedContainer,
			"Start Date",
			this.event.start ? formatDateTimeForInput(this.event.start) : ""
		);

		// End date/time field (for timed events)
		this.endInput = this.createDateTimeInputWithNowButton(
			this.timedContainer,
			"End Date",
			this.event.end ? formatDateTimeForInput(this.event.end) : ""
		);

		// Duration field (for timed events) - conditionally shown based on settings
		const settings = this.bundle.settingsStore.currentSettings;
		if (settings.showDurationField) {
			this.durationContainer = this.timedContainer.createDiv("setting-item");
			this.durationContainer.createEl("div", { text: "Duration (minutes)", cls: "setting-item-name" });
			this.durationInput = this.durationContainer.createEl("input", {
				type: "number",
				cls: "setting-item-control",
				attr: {
					min: "0",
					step: "1",
				},
			});

			if (this.event.start && this.event.end) {
				const durationMinutes = calculateDurationMinutes(this.event.start, this.event.end);
				this.durationInput.value = durationMinutes.toString();
			}
		}

		// Container for ALL-DAY event fields (Date only)
		this.allDayContainer = contentEl.createDiv("allday-event-fields");
		if (!this.event.allDay) {
			this.allDayContainer.classList.add("prisma-hidden");
		}

		// Date field (for all-day events)
		const dateContainer = this.allDayContainer.createDiv("setting-item");
		dateContainer.createEl("div", { text: "Date", cls: "setting-item-name" });
		this.dateInput = dateContainer.createEl("input", {
			type: "date",
			value: this.event.start ? formatDateOnly(this.event.start) : "",
			cls: "setting-item-control",
		});

		this.createRecurringEventFields(contentEl);
		this.createCategoryField(contentEl);
		this.createCustomPropertiesFields(contentEl);
	}

	private createCategoryField(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.categoryProp) return;

		this.categoryInput = new CategoryInput(this.bundle.categoryTracker);
		this.categoryInput.render(contentEl);
	}

	private createDateTimeInputWithNowButton(parent: HTMLElement, label: string, initialValue: string): HTMLInputElement {
		const container = parent.createDiv("setting-item");
		container.createEl("div", { text: label, cls: "setting-item-name" });
		const inputWrapper = container.createDiv("prisma-datetime-input-wrapper");

		const nowButton = inputWrapper.createEl("button", {
			text: "Now",
			cls: "prisma-now-button",
			type: "button",
		});

		const input = inputWrapper.createEl("input", {
			type: "datetime-local",
			value: initialValue,
			cls: "setting-item-control",
		});

		nowButton.addEventListener("click", () => {
			this.setToCurrentTime(input);
		});

		return input;
	}

	private createRecurringEventFields(contentEl: HTMLElement): void {
		// Recurring event checkbox
		const recurringCheckboxContainer = contentEl.createDiv("setting-item");
		recurringCheckboxContainer.createEl("div", { text: "Recurring event", cls: "setting-item-name" });
		this.recurringCheckbox = recurringCheckboxContainer.createEl("input", {
			type: "checkbox",
			cls: "setting-item-control",
		});

		// Container for recurring event options (initially hidden)
		this.recurringContainer = contentEl.createDiv(cls("recurring-event-fields"));
		this.recurringContainer.classList.add("prisma-hidden");

		// RRule type dropdown
		const rruleContainer = this.recurringContainer.createDiv("setting-item");
		rruleContainer.createEl("div", { text: "Recurrence pattern", cls: "setting-item-name" });
		this.rruleSelect = rruleContainer.createEl("select", { cls: "setting-item-control" });

		// Add options to the select
		for (const [value, label] of Object.entries(RECURRENCE_TYPE_OPTIONS)) {
			const option = this.rruleSelect.createEl("option", { value, text: label });
			option.value = value;
		}

		// Weekday selection (initially hidden, shown when weekly/bi-weekly selected)
		this.weekdayContainer = this.recurringContainer.createDiv(`setting-item ${cls("weekday-selection")}`);
		this.weekdayContainer.classList.add("prisma-hidden");
		this.weekdayContainer.createEl("div", { text: "Days of week", cls: "setting-item-name" });

		const weekdayGrid = this.weekdayContainer.createDiv(cls("weekday-grid"));

		// Create checkboxes for each weekday
		for (const [value, label] of Object.entries(WEEKDAY_OPTIONS)) {
			const weekdayItem = weekdayGrid.createDiv(cls("weekday-item"));

			const checkboxId = `weekday-${value}`;
			const checkbox = weekdayItem.createEl("input", {
				type: "checkbox",
				attr: {
					"data-weekday": value,
					id: checkboxId,
				},
			});
			weekdayItem.createEl("label", {
				text: label,
				attr: { for: checkboxId },
			});

			this.weekdayCheckboxes.set(value as Weekday, checkbox);

			// Make the entire weekday item clickable
			weekdayItem.addEventListener("click", (e) => {
				// Prevent double-toggle when clicking directly on checkbox or label
				if (e.target === checkbox || (e.target as HTMLElement).tagName === "LABEL") {
					return;
				}
				checkbox.checked = !checkbox.checked;
			});
		}

		const futureInstancesContainer = this.recurringContainer.createDiv("setting-item");
		futureInstancesContainer.createEl("div", {
			text: "Future instances count",
			cls: "setting-item-name",
		});
		const futureInstancesDesc = futureInstancesContainer.createEl("div", {
			cls: "setting-item-description",
		});
		futureInstancesDesc.setText("Override the global setting for this event. Leave empty to use the default.");
		this.futureInstancesCountInput = futureInstancesContainer.createEl("input", {
			type: "number",
			cls: "setting-item-control",
			attr: {
				min: "1",
				step: "1",
				placeholder: "Default",
			},
		});
	}

	private createCustomPropertiesFields(contentEl: HTMLElement): void {
		this.displayPropertiesContainer = this.createPropertySection(contentEl, "Display Properties", () =>
			this.addCustomProperty("", "", "display")
		);

		const otherSectionParent = contentEl.createDiv(cls("other-section-spacing"));
		this.otherPropertiesContainer = this.createPropertySection(otherSectionParent, "Other Properties", () =>
			this.addCustomProperty("", "", "other")
		);
	}

	private createPropertySection(parent: HTMLElement, title: string, onAddClick: () => void): HTMLElement {
		const headerContainer = parent.createDiv("setting-item");
		const headerDiv = headerContainer.createDiv("setting-item-name");
		headerDiv.createEl("div", { text: title, cls: "setting-item-heading" });

		const addButton = headerContainer.createEl("button", {
			text: "+ add property",
			cls: "mod-cta",
		});
		addButton.addEventListener("click", onAddClick);

		const container = parent.createDiv(cls("property-container"));

		return container;
	}

	protected addCustomProperty(key = "", value = "", section: "display" | "other" = "other"): void {
		const container = section === "display" ? this.displayPropertiesContainer : this.otherPropertiesContainer;
		const propertyRow = container.createDiv(cls("custom-property-row"));

		propertyRow.createEl("input", {
			type: "text",
			placeholder: "Property name",
			value: key,
			cls: "setting-item-control",
		});

		propertyRow.createEl("input", {
			type: "text",
			placeholder: "Value",
			value: value,
			cls: "setting-item-control",
		});

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

		// Collect from both display and other properties containers
		const displayRows = this.displayPropertiesContainer.querySelectorAll(`.${cls("custom-property-row")}`);
		const otherRows = this.otherPropertiesContainer.querySelectorAll(`.${cls("custom-property-row")}`);
		const allRows = [...Array.from(displayRows), ...Array.from(otherRows)];

		for (const row of allRows) {
			const keyInput = row.querySelector("input[placeholder='Property name']") as HTMLInputElement;
			const valueInput = row.querySelector("input[placeholder='Value']") as HTMLInputElement;

			if (keyInput?.value && valueInput?.value) {
				properties[keyInput.value] = valueInput.value;
			}
		}

		// Parse string values back to their original types (arrays, numbers, booleans, etc.)
		return parseFrontmatterRecord(properties);
	}

	private updateDurationFromDates(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.showDurationField || !this.durationInput) return;

		if (this.startInput.value && this.endInput.value) {
			const durationMinutes = calculateDurationMinutes(this.startInput.value, this.endInput.value);
			this.durationInput.value = durationMinutes.toString();
		}
	}

	private updateEndFromDuration(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.showDurationField || !this.durationInput) return;

		if (this.startInput.value && this.durationInput.value) {
			const startDate = new Date(this.startInput.value);
			const durationMinutes = Number.parseInt(this.durationInput.value, 10);

			if (!Number.isNaN(durationMinutes) && durationMinutes >= 0) {
				const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
				this.endInput.value = formatDateTimeForInput(endDate);
			}
		}
	}

	private setToCurrentTime(input: HTMLInputElement): void {
		const now = new Date();
		input.value = formatDateTimeForInput(now);

		// Trigger change event to update duration field if present
		const event = new Event("change", { bubbles: true });
		input.dispatchEvent(event);
	}

	private setupEventHandlers(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;

		// Handle all-day toggle
		this.allDayCheckbox.addEventListener("change", () => {
			if (this.allDayCheckbox.checked) {
				// Switching TO all-day
				this.timedContainer.classList.add("prisma-hidden");
				this.allDayContainer.classList.remove("prisma-hidden");
				// Copy start date to date field if available
				if (this.startInput.value) {
					this.dateInput.value = formatDateOnly(this.startInput.value);
				}
			} else {
				// Switching TO timed
				this.timedContainer.classList.remove("prisma-hidden");
				this.allDayContainer.classList.add("prisma-hidden");
				// Copy date to start field if available
				if (this.dateInput.value) {
					this.startInput.value = `${this.dateInput.value}T09:00`;
					this.endInput.value = `${this.dateInput.value}T10:00`;
					this.updateDurationFromDates();
				}
			}
		});

		if (settings.showDurationField && this.durationInput) {
			this.startInput.addEventListener("change", () => {
				this.updateDurationFromDates();
			});
			this.endInput.addEventListener("change", () => {
				this.updateDurationFromDates();
			});
			this.durationInput.addEventListener("input", () => {
				this.updateEndFromDuration();
			});
		}

		// Handle recurring event checkbox toggle
		this.recurringCheckbox.addEventListener("change", () => {
			this.recurringContainer.classList.toggle("prisma-hidden", !this.recurringCheckbox.checked);
		});

		// Handle RRule type selection
		this.rruleSelect.addEventListener("change", () => {
			const selectedType = this.rruleSelect.value as RecurrenceType;
			// Show weekday selection only for weekly and bi-weekly
			const showWeekdays = WEEKDAY_SUPPORTED_TYPES.includes(selectedType as any);
			this.weekdayContainer.classList.toggle("prisma-hidden", !showWeekdays);
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
			start = inputValueToISOString(this.startInput.value);
			end = this.endInput.value ? inputValueToISOString(this.endInput.value) : null;

			preservedFrontmatter[settings.startProp] = start;
			if (end) {
				preservedFrontmatter[settings.endProp] = end;
			}
			delete preservedFrontmatter[settings.dateProp];
		}

		// Handle category property (supports multiple comma-separated categories)
		if (settings.categoryProp && this.categoryInput) {
			const rawValue = this.categoryInput.getValue();
			if (rawValue) {
				// Parse comma-separated categories and trim whitespace
				const categories = rawValue
					.split(",")
					.map((c) => c.trim())
					.filter((c) => c.length > 0);

				if (categories.length === 0) {
					delete preservedFrontmatter[settings.categoryProp];
				} else if (categories.length === 1) {
					// Single category: store as string
					preservedFrontmatter[settings.categoryProp] = categories[0];
				} else {
					// Multiple categories: store as array
					preservedFrontmatter[settings.categoryProp] = categories;
				}
			} else {
				delete preservedFrontmatter[settings.categoryProp];
			}
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

			// Handle future instances count override
			if (this.futureInstancesCountInput?.value) {
				const futureCount = Number.parseInt(this.futureInstancesCountInput.value, 10);
				if (!Number.isNaN(futureCount) && futureCount > 0) {
					preservedFrontmatter[settings.futureInstancesCountProp] = futureCount;
				}
			} else {
				delete preservedFrontmatter[settings.futureInstancesCountProp];
			}
		} else {
			// Clear recurring event properties if not checked
			delete preservedFrontmatter[settings.rruleProp];
			delete preservedFrontmatter[settings.rruleSpecProp];
			delete preservedFrontmatter[settings.futureInstancesCountProp];
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
			const zettelId = extractZettelId(this.event.title);
			if (zettelId) {
				this.originalZettelId = `-${zettelId}`; // Store "-20250103123456" format
				this.displayTitle = removeZettelId(this.event.title);
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
			this.recurringContainer.classList.remove("prisma-hidden");
			this.rruleSelect.value = rruleType;

			// Load weekdays if applicable
			if (WEEKDAY_SUPPORTED_TYPES.includes(rruleType as any)) {
				this.weekdayContainer.classList.remove("prisma-hidden");

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

			const futureCount = this.originalFrontmatter[settings.futureInstancesCountProp];
			const parsed = parsePositiveInt(futureCount, 0);
			if (parsed > 0) {
				this.futureInstancesCountInput.value = String(parsed);
			}
		}
	}

	private async loadCustomPropertiesData(): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;

		// Categorize properties using shared utility
		const { displayProperties, otherProperties } = categorizeProperties(this.originalFrontmatter, settings);

		// Load display properties
		for (const [key, value] of displayProperties) {
			this.originalCustomPropertyKeys.add(key);
			const stringValue = serializeFrontmatterValue(value);
			this.addCustomProperty(key, stringValue, "display");
		}

		// Load other properties
		for (const [key, value] of otherProperties) {
			this.originalCustomPropertyKeys.add(key);
			const stringValue = serializeFrontmatterValue(value);
			this.addCustomProperty(key, stringValue, "other");
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
		this.loadCategoryData();
		await this.loadCustomPropertiesData();
	}

	private loadCategoryData(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.categoryProp || !this.categoryInput) return;

		const categoryValue = this.originalFrontmatter[settings.categoryProp];
		this.categoryInput.setValue(categoryValue);
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
