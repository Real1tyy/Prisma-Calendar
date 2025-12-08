import { addCls, cls, parseFrontmatterRecord, serializeFrontmatterValue } from "@real1ty-obsidian-plugins/utils";
import { type App, Modal, Notice, TFile } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { type FormData, MinimizedModalManager, type MinimizedModalState } from "../../core/minimized-modal-manager";
import { RECURRENCE_TYPE_OPTIONS, WEEKDAY_OPTIONS, WEEKDAY_SUPPORTED_TYPES } from "../../types/recurring-event";
import type { EventPreset } from "../../types/settings";
import { findAdjacentEvent, setEventBasics } from "../../utils/calendar-events";
import type { RecurrenceType, Weekday } from "../../utils/date-recurrence";
import {
	calculateDurationMinutes,
	formatDateOnly,
	formatDateTimeForInput,
	inputValueToISOString,
} from "../../utils/format";
import { CategoryInput } from "../category-input";
import { Stopwatch } from "../stopwatch";
import { SavePresetModal } from "./save-preset-modal";

export interface EventModalData {
	title: string;
	start: string | Date | null;
	end?: string | Date | null;
	allDay?: boolean;
	extendedProps?: {
		filePath?: string | null;
		[key: string]: unknown;
	};
}

export interface EventSaveData {
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

export abstract class BaseEventModal extends Modal {
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
	protected breakInput!: HTMLInputElement;
	protected notificationInput!: HTMLInputElement;
	protected notificationContainer!: HTMLElement;
	protected notificationLabel!: HTMLElement;

	// Stopwatch for time tracking
	protected stopwatch?: Stopwatch;
	protected stopwatchContainer?: HTMLElement;

	// Custom properties
	protected customProperties: CustomProperty[] = [];
	protected displayPropertiesContainer!: HTMLElement;
	protected otherPropertiesContainer!: HTMLElement;
	public originalCustomPropertyKeys: Set<string> = new Set();

	protected presetSelector!: HTMLSelectElement;

	// State to restore from minimized modal (set before opening)
	private pendingRestoreState: MinimizedModalState | null = null;

	// Flag to prevent double-saving when minimize() is called explicitly
	private isMinimizing = false;

	constructor(app: App, bundle: CalendarBundle, event: EventModalData, onSave: (eventData: EventSaveData) => void) {
		super(app);
		this.event = event;
		this.bundle = bundle;
		this.onSave = onSave;
	}

	setRestoreState(state: MinimizedModalState): void {
		this.pendingRestoreState = state;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		addCls(this.modalEl, "event-modal");

		// Allow subclasses to perform initialization
		void this.initialize();

		// Header with title and preset selector
		this.createModalHeader(contentEl);
		this.createFormFields(contentEl);
		this.setupEventHandlers(contentEl);
		this.createActionButtons(contentEl);

		// Check if we're restoring from minimized state
		if (this.pendingRestoreState) {
			this.restoreFromState(this.pendingRestoreState);
			this.pendingRestoreState = null;
		} else {
			// Apply default preset for create mode (only when not restoring)
			this.applyDefaultPreset();
		}

		requestAnimationFrame(() => {
			setTimeout(() => {
				this.titleInput.focus();
			}, 50);
		});
	}

	private createModalHeader(contentEl: HTMLElement): void {
		const headerContainer = contentEl.createDiv(cls("event-modal-header"));

		headerContainer.createEl("h2", { text: this.getModalTitle() });

		const controlsContainer = headerContainer.createDiv(cls("event-modal-header-controls"));

		// Minimize button - saves modal state and allows reopening later
		const minimizeButton = controlsContainer.createEl("button", {
			text: "−",
			cls: cls("event-modal-minimize-button"),
			type: "button",
			attr: { title: "Minimize modal (preserves all form data)" },
		});
		minimizeButton.addEventListener("click", () => {
			this.minimize();
		});

		// Clear button to reset all fields
		const clearButton = controlsContainer.createEl("button", {
			text: "Clear",
			cls: cls("event-modal-clear-button"),
			type: "button",
		});
		clearButton.addEventListener("click", () => {
			this.clearAllFields();
		});

		// Preset selector (only for create mode, but rendered for all - hidden via CSS if needed)
		this.createPresetSelector(controlsContainer);
	}

	private createPresetSelector(container: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const presets = settings.eventPresets || [];

		const selectorWrapper = container.createDiv(cls("event-preset-selector-wrapper"));

		selectorWrapper.createEl("span", {
			text: "Preset:",
			cls: cls("event-preset-label"),
		});

		this.presetSelector = selectorWrapper.createEl("select", {
			cls: cls("event-preset-select"),
		});

		// Add default "None" option
		const noneOption = this.presetSelector.createEl("option", {
			value: "",
			text: "None",
		});
		noneOption.value = "";

		// Add preset options
		for (const preset of presets) {
			const option = this.presetSelector.createEl("option", {
				value: preset.id,
				text: preset.name,
			});
			option.value = preset.id;
		}

		// Handle preset selection
		this.presetSelector.addEventListener("change", () => {
			const selectedId = this.presetSelector.value;
			if (selectedId) {
				const preset = presets.find((p) => p.id === selectedId);
				if (preset) {
					this.applyPreset(preset);
				}
			}
		});
	}

	protected applyDefaultPreset(): void {
		// Override in subclasses if needed
	}

	protected clearAllFields(): void {
		// Clear title
		this.titleInput.value = "";

		// Reset all-day checkbox
		this.allDayCheckbox.checked = false;
		this.timedContainer.classList.remove("prisma-hidden");
		this.allDayContainer.classList.add("prisma-hidden");

		// Clear date/time fields
		this.startInput.value = "";
		this.endInput.value = "";
		this.dateInput.value = "";
		if (this.durationInput) {
			this.durationInput.value = "";
		}

		// Clear recurring event fields
		this.recurringCheckbox.checked = false;
		this.recurringContainer.classList.add("prisma-hidden");
		this.rruleSelect.value = Object.keys(RECURRENCE_TYPE_OPTIONS)[0];
		this.weekdayContainer.classList.add("prisma-hidden");
		for (const checkbox of this.weekdayCheckboxes.values()) {
			checkbox.checked = false;
		}
		this.futureInstancesCountInput.value = "";

		// Clear category
		if (this.categoryInput) {
			this.categoryInput.setValue("");
		}

		// Clear break
		if (this.breakInput) {
			this.breakInput.value = "";
		}

		// Clear notification
		if (this.notificationInput) {
			this.notificationInput.value = "";
		}

		// Reset stopwatch
		this.stopwatch?.reset();

		// Clear custom properties
		this.displayPropertiesContainer.empty();
		this.otherPropertiesContainer.empty();
		this.customProperties = [];

		// Reset preset selector
		this.presetSelector.value = "";

		// Focus on title input
		this.titleInput.focus();
	}

	protected applyPreset(preset: FormData | EventPreset): void {
		const settings = this.bundle.settingsStore.currentSettings;

		// Apply title
		if (preset.title !== undefined) {
			this.titleInput.value = preset.title;
		}

		// Apply all-day setting
		if (preset.allDay !== undefined) {
			this.allDayCheckbox.checked = preset.allDay;
			const changeEvent = new Event("change", { bubbles: true });
			this.allDayCheckbox.dispatchEvent(changeEvent);
		}

		// Apply date for all-day events
		if (preset.date) {
			this.dateInput.value = preset.date;
		}

		// Apply start/end dates for timed events
		if (preset.startDate) {
			this.startInput.value = formatDateTimeForInput(preset.startDate);
		}
		if (preset.endDate) {
			this.endInput.value = formatDateTimeForInput(preset.endDate);
		}

		// Update duration field if both dates are set
		if (preset.startDate && preset.endDate && this.durationInput) {
			const durationMinutes = calculateDurationMinutes(preset.startDate, preset.endDate);
			this.durationInput.value = durationMinutes.toString();
		}

		// Apply categories
		if (preset.categories !== undefined && this.categoryInput) {
			this.categoryInput.setValue(preset.categories);
		}

		// Apply break time
		if (preset.breakMinutes !== undefined && this.breakInput) {
			this.breakInput.value = preset.breakMinutes.toString();
		}

		// Apply notification timing
		if (preset.notifyBefore !== undefined && this.notificationInput) {
			this.notificationInput.value = preset.notifyBefore.toString();
		}

		// Apply recurring settings
		if (preset.rruleType) {
			this.recurringCheckbox.checked = true;
			this.recurringContainer.classList.remove("prisma-hidden");
			this.rruleSelect.value = preset.rruleType;

			// Trigger change to show/hide weekday selector
			const rruleChangeEvent = new Event("change", { bubbles: true });
			this.rruleSelect.dispatchEvent(rruleChangeEvent);

			// Apply weekdays if set
			if (preset.rruleSpec && (WEEKDAY_SUPPORTED_TYPES as readonly string[]).includes(preset.rruleType)) {
				const weekdays = preset.rruleSpec.split(",").map((day) => day.trim().toLowerCase());
				for (const weekday of weekdays) {
					const checkbox = this.weekdayCheckboxes.get(weekday as Weekday);
					if (checkbox) {
						checkbox.checked = true;
					}
				}
			}

			// Apply future instances count override
			if (preset.futureInstancesCount !== undefined && this.futureInstancesCountInput) {
				this.futureInstancesCountInput.value = preset.futureInstancesCount.toString();
			}
		}

		// Apply custom properties
		if (preset.customProperties) {
			// Clear existing custom properties
			this.displayPropertiesContainer.empty();
			this.otherPropertiesContainer.empty();

			// Get display properties list to categorize
			const displayPropsSet = new Set(settings.frontmatterDisplayProperties || []);

			for (const [key, value] of Object.entries(preset.customProperties)) {
				const stringValue = serializeFrontmatterValue(value);
				const section = displayPropsSet.has(key) ? "display" : "other";
				this.addCustomProperty(key, stringValue, section);
			}
		}
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

		// Stopwatch for time tracking (only for timed events)
		this.createStopwatchField(contentEl);

		this.createRecurringEventFields(contentEl);
		this.createCategoryField(contentEl);
		this.createBreakField(contentEl);
		this.createNotificationField(contentEl);
		this.createCustomPropertiesFields(contentEl);
	}

	private createCategoryField(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.categoryProp) return;

		this.categoryInput = new CategoryInput(this.bundle.categoryTracker);
		this.categoryInput.render(contentEl);
	}

	private createBreakField(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.breakProp) return;

		const breakContainer = contentEl.createDiv("setting-item");
		breakContainer.createEl("div", { text: "Break (minutes)", cls: "setting-item-name" });
		const breakDesc = breakContainer.createEl("div", {
			cls: "setting-item-description",
		});
		breakDesc.setText("Time to subtract from duration in statistics (decimals supported)");
		this.breakInput = breakContainer.createEl("input", {
			type: "number",
			cls: "setting-item-control",
			attr: {
				min: "0",
				step: "any",
				placeholder: "0",
			},
		});
	}

	private createNotificationField(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.enableNotifications) return;

		this.notificationContainer = contentEl.createDiv("setting-item");
		const isAllDay = this.event.allDay ?? false;
		const labelText = isAllDay ? "Notify days before" : "Notify minutes before";

		this.notificationLabel = this.notificationContainer.createEl("div", {
			text: labelText,
			cls: "setting-item-name",
		});
		const notificationDesc = this.notificationContainer.createEl("div", {
			cls: "setting-item-description",
		});
		notificationDesc.setText("Override default notification timing for this event");
		this.notificationInput = this.notificationContainer.createEl("input", {
			type: "number",
			cls: "setting-item-control",
			attr: {
				min: "0",
				step: "1",
				placeholder: "Default",
			},
		});
	}

	private createStopwatchField(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.showStopwatch) return;

		this.stopwatchContainer = contentEl.createDiv(cls("stopwatch-field"));

		// Initially hidden when all-day is selected
		if (this.event.allDay) {
			this.stopwatchContainer.classList.add("prisma-hidden");
		}

		this.stopwatch = new Stopwatch({
			onStart: (startTime: Date) => {
				this.startInput.value = formatDateTimeForInput(startTime);
				// Trigger change event to update duration field
				const event = new Event("change", { bubbles: true });
				this.startInput.dispatchEvent(event);
			},
			onStop: (endTime: Date) => {
				this.endInput.value = formatDateTimeForInput(endTime);
				// Trigger change event to update duration field
				const event = new Event("change", { bubbles: true });
				this.endInput.dispatchEvent(event);
			},
			onBreakUpdate: (breakMinutes: number) => {
				if (this.breakInput) {
					this.breakInput.value = breakMinutes.toString();
				}
			},
		});

		this.stopwatch.render(this.stopwatchContainer);
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

		const isStartInput = label.toLowerCase().includes("start");
		const fillButton = inputWrapper.createEl("button", {
			text: isStartInput ? "Fill prev" : "Fill next",
			cls: "prisma-fill-button",
			type: "button",
			attr: {
				title: isStartInput ? "Fill from previous event's end time" : "Fill from next event's start time",
			},
		});

		const input = inputWrapper.createEl("input", {
			type: "datetime-local",
			value: initialValue,
			cls: "setting-item-control",
		});

		nowButton.addEventListener("click", () => {
			this.setToCurrentTime(input);
		});

		fillButton.addEventListener("click", () => {
			if (isStartInput) {
				this.fillStartTimeFromPrevious(input);
			} else {
				this.fillEndTimeFromNext(input);
			}
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
			text: "Add property",
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

	private fillStartTimeFromPrevious(input: HTMLInputElement): void {
		this.fillTimeFromAdjacent(input, "previous", "end", "Start time filled from previous event");
	}

	private fillEndTimeFromNext(input: HTMLInputElement): void {
		this.fillTimeFromAdjacent(input, "next", "start", "End time filled from next event");
	}

	private fillTimeFromAdjacent(
		input: HTMLInputElement,
		direction: "next" | "previous",
		timeField: "start" | "end",
		successMessage: string
	): void {
		const currentValue = inputValueToISOString(input.value);

		const adjacentEvent = findAdjacentEvent(
			this.bundle.eventStore,
			this.event.start,
			this.event.extendedProps?.filePath,
			direction,
			currentValue
		);

		if (!adjacentEvent) {
			new Notice(`No ${direction} event found`);
			return;
		}

		const timeValue = timeField === "start" ? adjacentEvent.start : adjacentEvent.end;

		if (!timeValue) {
			new Notice(`${direction === "previous" ? "Previous" : "Next"} event has no ${timeField} time`);
			return;
		}

		input.value = formatDateTimeForInput(timeValue);

		const event = new Event("change", { bubbles: true });
		input.dispatchEvent(event);

		new Notice(successMessage);
	}

	private setupEventHandlers(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;

		// Handle all-day toggle
		this.allDayCheckbox.addEventListener("change", () => {
			if (this.allDayCheckbox.checked) {
				// Switching TO all-day
				this.timedContainer.classList.add("prisma-hidden");
				this.allDayContainer.classList.remove("prisma-hidden");
				// Hide stopwatch for all-day events
				this.stopwatchContainer?.classList.add("prisma-hidden");
				// Copy start date to date field if available
				if (this.startInput.value) {
					this.dateInput.value = formatDateOnly(this.startInput.value);
				}
				// Update notification label
				if (this.notificationLabel) {
					this.notificationLabel.setText("Notify days before");
				}
			} else {
				// Switching TO timed
				this.timedContainer.classList.remove("prisma-hidden");
				this.allDayContainer.classList.add("prisma-hidden");
				// Show stopwatch for timed events
				this.stopwatchContainer?.classList.remove("prisma-hidden");
				// Copy date to start field if available
				if (this.dateInput.value) {
					this.startInput.value = `${this.dateInput.value}T09:00`;
					this.endInput.value = `${this.dateInput.value}T10:00`;
					this.updateDurationFromDates();
				}
				// Update notification label
				if (this.notificationLabel) {
					this.notificationLabel.setText("Notify minutes before");
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
			const showWeekdays = (WEEKDAY_SUPPORTED_TYPES as readonly string[]).includes(selectedType);
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

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		// Save as Preset button - available in both Create and Edit modals
		const savePresetButton = buttonContainer.createEl("button", {
			text: "Save as preset",
		});
		savePresetButton.addEventListener("click", () => {
			this.openSavePresetModal();
		});

		const saveButton = buttonContainer.createEl("button", {
			text: this.getSaveButtonText(),
			cls: "mod-cta",
		});
		saveButton.addEventListener("click", () => {
			this.saveEvent();
		});
	}

	private openSavePresetModal(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const existingPresets = settings.eventPresets || [];

		const modal = new SavePresetModal(this.app, existingPresets, (presetName, overridePresetId) => {
			this.saveCurrentAsPreset(presetName, overridePresetId);
		});
		modal.open();
	}

	private saveCurrentAsPreset(presetName: string, overridePresetId: string | null): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const now = Date.now();

		const formData = this.extractFormData();

		const preset: EventPreset = {
			...formData,
			id: overridePresetId || `preset-${now}`,
			name: presetName,
			createdAt: now,
		};

		// If overriding, preserve the original createdAt
		if (overridePresetId) {
			const existingPreset = (settings.eventPresets || []).find((p) => p.id === overridePresetId);
			if (existingPreset) {
				preset.createdAt = existingPreset.createdAt;
				preset.updatedAt = now;
			}
		}

		const currentPresets = settings.eventPresets || [];
		let updatedPresets: EventPreset[];

		if (overridePresetId) {
			// Replace existing preset
			updatedPresets = currentPresets.map((p) => (p.id === overridePresetId ? preset : p));
			new Notice(`Preset "${presetName}" updated!`);
		} else {
			// Add new preset
			updatedPresets = [...currentPresets, preset];
			new Notice(`Preset "${presetName}" saved!`);
		}

		void this.bundle.settingsStore.updateSettings((s) => ({
			...s,
			eventPresets: updatedPresets,
		}));

		// Update the preset selector
		this.refreshPresetSelector(updatedPresets);
	}

	private refreshPresetSelector(presets: EventPreset[]): void {
		if (!this.presetSelector) return;

		// Clear existing options except "None"
		while (this.presetSelector.options.length > 1) {
			this.presetSelector.remove(1);
		}

		// Add all preset options
		for (const preset of presets) {
			const option = this.presetSelector.createEl("option", {
				value: preset.id,
				text: preset.name,
			});
			option.value = preset.id;
		}
	}

	public saveEvent(): void {
		const settings = this.bundle.settingsStore.currentSettings;

		// Start with original frontmatter to preserve all existing properties
		const preservedFrontmatter = { ...this.originalFrontmatter };

		// Update title if titleProp is configured and value is provided
		if (this.titleInput.value && settings.titleProp) {
			preservedFrontmatter[settings.titleProp] = this.titleInput.value;
		}

		let start: string | null;
		let end: string | null;

		if (this.allDayCheckbox.checked) {
			// For FullCalendar compatibility, we still return ISO strings
			start = `${this.dateInput.value}T00:00:00`;
			end = `${this.dateInput.value}T23:59:59`;
		} else {
			start = inputValueToISOString(this.startInput.value);
			end = this.endInput.value ? inputValueToISOString(this.endInput.value) : null;
		}
		setEventBasics(preservedFrontmatter, settings, {
			title: this.titleInput.value,
			start: start!,
			end: end ?? undefined,
			allDay: this.allDayCheckbox.checked,
		});

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

		// Handle break property
		if (settings.breakProp && this.breakInput) {
			const breakValue = Number.parseFloat(this.breakInput.value);
			if (!Number.isNaN(breakValue) && breakValue > 0) {
				preservedFrontmatter[settings.breakProp] = breakValue;
			} else {
				delete preservedFrontmatter[settings.breakProp];
			}
		}

		// Handle notification property (minutes before for timed, days before for all-day)
		if (this.notificationInput) {
			const notifyValue = Number.parseInt(this.notificationInput.value, 10);
			if (!Number.isNaN(notifyValue) && notifyValue >= 0) {
				if (this.allDayCheckbox.checked) {
					preservedFrontmatter[settings.daysBeforeProp] = notifyValue;
					delete preservedFrontmatter[settings.minutesBeforeProp];
				} else {
					preservedFrontmatter[settings.minutesBeforeProp] = notifyValue;
					delete preservedFrontmatter[settings.daysBeforeProp];
				}
			} else {
				delete preservedFrontmatter[settings.minutesBeforeProp];
				delete preservedFrontmatter[settings.daysBeforeProp];
			}
		}

		// Handle recurring event properties
		if (this.recurringCheckbox.checked) {
			const rruleType = this.rruleSelect.value as RecurrenceType;
			preservedFrontmatter[settings.rruleProp] = rruleType;

			// Handle weekdays for weekly/bi-weekly events
			if ((WEEKDAY_SUPPORTED_TYPES as readonly string[]).includes(rruleType)) {
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

	protected loadExistingFrontmatter(): void {
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
		// If stopwatch is active and we're NOT already in the minimize flow,
		// auto-save state before closing (handles ESC key, clicking outside, etc.)
		if (this.isStopwatchActive() && !this.isMinimizing) {
			const state = this.extractMinimizedState();
			MinimizedModalManager.saveState(state);
		}

		// Clean up stopwatch to stop any running intervals
		this.stopwatch?.destroy();

		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Minimize the modal - saves state and closes the modal.
	 * Time tracking continues via MinimizedModalManager.
	 * The modal can be restored later using the "Restore minimized modal" command.
	 */
	minimize(): void {
		// Set flag to prevent double-saving in onClose
		this.isMinimizing = true;

		const state = this.extractMinimizedState();
		MinimizedModalManager.saveState(state);
		new Notice("Modal minimized. Run command: restore minimized event modal");
		this.close();
	}

	protected extractFormData(): FormData {
		const formData: FormData = {};

		if (this.titleInput.value) {
			formData.title = this.titleInput.value;
		}

		formData.allDay = this.allDayCheckbox.checked;
		if (this.allDayCheckbox.checked) {
			if (this.dateInput.value) {
				formData.date = this.dateInput.value;
			}
		} else {
			if (this.startInput.value) {
				formData.startDate = inputValueToISOString(this.startInput.value);
			}
			if (this.endInput.value) {
				formData.endDate = inputValueToISOString(this.endInput.value);
			}
		}

		if (this.categoryInput) {
			const categoryValue = this.categoryInput.getValue();
			if (categoryValue) {
				formData.categories = categoryValue;
			}
		}

		if (this.breakInput?.value) {
			const breakValue = Number.parseFloat(this.breakInput.value);
			if (!Number.isNaN(breakValue) && breakValue > 0) {
				formData.breakMinutes = breakValue;
			}
		}

		if (this.notificationInput?.value) {
			const notifyValue = Number.parseInt(this.notificationInput.value, 10);
			if (!Number.isNaN(notifyValue) && notifyValue >= 0) {
				formData.notifyBefore = notifyValue;
			}
		}

		if (this.recurringCheckbox.checked) {
			formData.rruleType = this.rruleSelect.value;

			if ((WEEKDAY_SUPPORTED_TYPES as readonly string[]).includes(this.rruleSelect.value)) {
				const selectedWeekdays: Weekday[] = [];
				for (const [weekday, checkbox] of this.weekdayCheckboxes.entries()) {
					if (checkbox.checked) {
						selectedWeekdays.push(weekday);
					}
				}
				if (selectedWeekdays.length > 0) {
					formData.rruleSpec = selectedWeekdays.join(", ");
				}
			}

			if (this.futureInstancesCountInput?.value) {
				const futureCount = Number.parseInt(this.futureInstancesCountInput.value, 10);
				if (!Number.isNaN(futureCount) && futureCount > 0) {
					formData.futureInstancesCount = futureCount;
				}
			}
		}

		const customProps = this.getCustomProperties();
		if (Object.keys(customProps).length > 0) {
			formData.customProperties = customProps;
		}

		return formData;
	}

	private extractMinimizedState(): MinimizedModalState {
		const formData = this.extractFormData();
		const stopwatchState = this.stopwatch?.exportState() ?? {
			state: "idle" as const,
			startTime: null,
			breakStartTime: null,
			totalBreakMs: 0,
		};

		return {
			...formData,
			stopwatch: stopwatchState,
			modalType: this.getModalType(),
			filePath: this.event.extendedProps?.filePath ?? null,
			originalFrontmatter: this.originalFrontmatter,
			calendarId: this.bundle.calendarId,
		};
	}

	private restoreFromState(state: MinimizedModalState): void {
		this.applyPreset(state);
		this.originalFrontmatter = state.originalFrontmatter;

		if (this.stopwatch) {
			this.stopwatch.importState(state.stopwatch);
		}
	}

	protected getModalType(): "create" | "edit" {
		return "create";
	}

	isStopwatchActive(): boolean {
		return this.stopwatch?.isActive() ?? false;
	}

	getBundle(): CalendarBundle {
		return this.bundle;
	}

	getOnSave(): (eventData: EventSaveData) => void {
		return this.onSave;
	}
}
