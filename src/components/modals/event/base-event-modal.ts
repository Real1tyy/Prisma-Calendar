import {
	addCls,
	afterRender,
	calculateDurationMinutes,
	cls,
	parseAsLocalDate,
	parseFrontmatterRecord,
	parseIntoList,
	registerSubmitHotkey,
	removeCls,
	serializeFrontmatterValue,
	toggleCls,
} from "@real1ty-obsidian-plugins";
import { type App, Modal, Notice } from "obsidian";
import type { Subscription } from "rxjs";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { FREE_MAX_EVENT_PRESETS } from "../../../core/license";
import {
	END_TIME_SYNC_INTERVAL_MS,
	type FormData,
	MinimizedModalManager,
	type MinimizedModalState,
	type PresetFormData,
} from "../../../core/minimized-modal-manager";
import type { Frontmatter } from "../../../types";
import { isTimedEvent } from "../../../types/calendar";
import type { EventSaveData } from "../../../types/event-save";
import {
	buildCustomIntervalDSL,
	isPresetType,
	isWeekdaySupported,
	parseRecurrenceType,
	RECURRENCE_TYPE_OPTIONS,
	WEEKDAY_OPTIONS,
} from "../../../types/recurring-event";
import type { EventPreset } from "../../../types/settings";
import type { Weekday } from "../../../utils/date-recurrence";
import {
	assignListToFrontmatter,
	parseCustomDoneProperty,
	setEventBasics,
	setUntrackedEventBasics,
} from "../../../utils/event-frontmatter";
import { autoAssignCategories, findAdjacentEvent } from "../../../utils/event-matching";
import { formatDateOnly, formatDateTimeForInput, inputValueToISOString } from "../../../utils/format";
import { getCategoriesFromFilePath, getFileAndFrontmatter } from "../../../utils/obsidian";
import { Stopwatch } from "../../stopwatch";
import { TitleInputSuggest } from "../../title-input-suggest";
import { openCategoryAssignModal } from "../category/assignment";
import { showCategoryEventsModal } from "../series/bases-view";
import { createFormField } from "./event-form-fields";
import { showSavePresetModal } from "./save-preset";

interface EventModalData {
	title: string;
	start: string | Date | null;
	end?: string | Date | null;
	allDay?: boolean;
	// When the modal is opened from FullCalendar, this is often an EventApi instance.
	// EventApi exposes a setter for extended props while `extendedProps` itself is read-only (getter-only).
	setExtendedProp?: (name: string, value: unknown) => void;
	extendedProps?: {
		filePath?: string | null;
		[key: string]: unknown;
	};
}

interface CustomProperty {
	key: string;
	value: string;
}

export abstract class BaseEventModal extends Modal {
	protected event: EventModalData;
	protected bundle: CalendarBundle;
	public titleInput!: HTMLInputElement;
	public startInput!: HTMLInputElement;
	public endInput!: HTMLInputElement;
	public durationInput!: HTMLInputElement;
	protected durationContainer!: HTMLElement;
	protected dateInput!: HTMLInputElement;
	public allDayCheckbox!: HTMLInputElement;
	public originalFrontmatter: Frontmatter = {};
	protected timedContainer!: HTMLElement;
	protected allDayContainer!: HTMLElement;

	// Recurring event fields
	public recurringCheckbox!: HTMLInputElement;
	protected recurringContainer!: HTMLElement;
	protected rruleSelect!: HTMLSelectElement;
	protected weekdayContainer!: HTMLElement;
	protected weekdayCheckboxes: Map<Weekday, HTMLInputElement> = new Map();
	protected futureInstancesCountInput!: HTMLInputElement;
	protected generatePastEventsCheckbox!: HTMLInputElement;
	protected customIntervalContainer!: HTMLElement;
	protected customFreqSelect!: HTMLSelectElement;
	protected customIntervalInput!: HTMLInputElement;

	protected categoriesContainer?: HTMLElement;
	protected selectedCategories: string[] = [];
	protected locationInput!: HTMLInputElement;
	protected iconInput!: HTMLInputElement;
	protected participantsInput!: HTMLInputElement;
	protected breakInput!: HTMLInputElement;
	protected markAsDoneCheckbox!: HTMLInputElement;
	protected initialMarkAsDoneState: boolean = false;
	protected skipCheckbox!: HTMLInputElement;
	protected notificationInput!: HTMLInputElement;
	protected notificationContainer!: HTMLElement;
	protected notificationLabel!: HTMLElement;

	// Stopwatch for time tracking
	protected stopwatch?: Stopwatch;
	protected stopwatchContainer?: HTMLElement;
	private initialBreakMinutes = 0;

	// Custom properties
	protected customProperties: CustomProperty[] = [];
	protected displayPropertiesContainer!: HTMLElement;
	protected otherPropertiesContainer!: HTMLElement;
	public originalCustomPropertyKeys: Set<string> = new Set();

	protected presetSelector!: HTMLSelectElement;

	// State to restore from minimized modal (set before opening)
	private pendingRestoreState: MinimizedModalState | null = null;

	// Suppress auto-category assignment once user interacts with category UI
	private suppressAutoCategories = false;

	// Flag to prevent double-saving when minimize() is called explicitly
	private isMinimizing = false;

	// Flag for silent stop-and-save (used when auto-stopping previous stopwatch)
	private silentStopAndSave = false;

	// Flag to start stopwatch and auto-minimize (used by context menu "Trigger stopwatch")
	private startStopwatchAndMinimize = false;

	private titleSuggest?: TitleInputSuggest;
	private settingsSubscription: Subscription | null = null;

	// ─── Lifecycle ───────────────────────────────────────────────

	constructor(app: App, bundle: CalendarBundle, event: EventModalData) {
		super(app);
		this.event = event;
		this.bundle = bundle;
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Hide modal immediately if doing a silent stop-and-save or trigger-stopwatch
		if (this.silentStopAndSave || this.startStopwatchAndMinimize) {
			this.containerEl.style.display = "none";
		}

		addCls(this.modalEl, "event-modal");
		addCls(contentEl, cls("event-modal-content"));

		// Allow subclasses to perform initialization
		void this.initialize();

		// Scrollable body (header + form) and sticky footer (buttons)
		const bodyEl = contentEl.createDiv(cls("event-modal-body"));
		const footerEl = contentEl.createDiv(cls("event-modal-footer"));

		this.createModalHeader(bodyEl);
		this.createFormFields(bodyEl);
		this.setupEventHandlers(bodyEl);
		this.setupTitleBlurListener();
		if (this.bundle.settingsStore.currentSettings.titleAutocomplete) {
			this.titleSuggest = new TitleInputSuggest(this.app, this.titleInput, this.bundle);
		}
		this.createActionButtons(footerEl);

		// Check if we're restoring from minimized state
		if (this.pendingRestoreState) {
			this.restoreFromState(this.pendingRestoreState);
			this.pendingRestoreState = null;
		} else {
			// Apply default preset for create mode (only when not restoring)
			this.applyDefaultPreset();
		}

		// Silent stop-and-save: stop the stopwatch (updates end time + break via callbacks),
		// then trigger the normal save path and close. No UI shown to the user.
		if (this.silentStopAndSave) {
			this.stopwatch?.stop();
			this.saveEvent();
			return;
		}

		void afterRender().then(() => {
			this.titleInput.focus();
		});
	}

	override onClose(): void {
		// If stopwatch is active and we're NOT already in the minimize flow,
		// auto-save state before closing (handles ESC key, clicking outside, etc.)
		if (this.isStopwatchActive() && !this.isMinimizing) {
			const state = this.extractMinimizedState();
			MinimizedModalManager.saveState(state, this.bundle);
		}

		// Clean up stopwatch to stop any running intervals
		this.stopwatch?.destroy();

		this.titleSuggest?.destroy();
		this.titleSuggest?.close();

		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;

		const { contentEl } = this;
		contentEl.empty();
	}

	// ─── Configuration ───────────────────────────────────────────

	setRestoreState(state: MinimizedModalState): void {
		this.pendingRestoreState = state;
	}

	/**
	 * When set, the modal will open hidden, stop the stopwatch, save the event,
	 * and close — reusing the full modal save path without showing any UI.
	 */
	setSilentStopAndSave(): void {
		this.silentStopAndSave = true;
	}

	/**
	 * When set, the modal will open hidden, start the stopwatch, save the event,
	 * and close — which auto-minimizes via onClose (same as pressing ESC with a running stopwatch).
	 */
	setStartStopwatchAndMinimize(): void {
		this.startStopwatchAndMinimize = true;
	}

	// ─── Abstract Interface ───────────────────────────────────────

	protected abstract getModalTitle(): string;
	protected abstract getSaveButtonText(): string;
	protected abstract initialize(): Promise<void>;
	public abstract saveEvent(): void;

	// ─── UI — Header & Layout ────────────────────────────────────

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

		this.settingsSubscription = this.bundle.settingsStore.settings$.subscribe((settings) => {
			if (this.presetSelector) {
				this.refreshPresetSelector(settings.eventPresets || []);
			}
		});
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

		this.refreshPresetSelector(presets);

		this.presetSelector.addEventListener("change", () => {
			const selectedId = this.presetSelector.value;
			if (selectedId) {
				const settings = this.bundle.settingsStore.currentSettings;
				const preset = (settings.eventPresets || []).find((p) => p.id === selectedId);
				if (preset) {
					this.applyPreset(preset);
				}
			}
		});
	}

	private createActionButtons(contentEl: HTMLElement): void {
		const buttonContainer = contentEl.createDiv(cls("modal-button-container"));

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
			cls: cls("mod-cta"),
		});
		saveButton.addEventListener("click", () => {
			this.saveWithAutoCategories();
		});
	}

	// ─── UI — Form Fields ─────────────────────────────────────────

	private createFormFields(contentEl: HTMLElement): void {
		const titleContainer = contentEl.createDiv(cls("setting-item"));
		titleContainer.createEl("div", {
			text: "Title",
			cls: cls("setting-item-name"),
		});
		this.titleInput = titleContainer.createEl("input", {
			type: "text",
			value: this.event.title || "",
			cls: cls("setting-item-control"),
		});

		const allDayContainer = contentEl.createDiv(cls("setting-item"));
		allDayContainer.createEl("div", {
			text: "All day",
			cls: cls("setting-item-name"),
		});
		this.allDayCheckbox = allDayContainer.createEl("input", {
			type: "checkbox",
			cls: cls("setting-item-control"),
		});
		this.allDayCheckbox.checked = this.event.allDay || false;

		// Container for TIMED event fields (Start Date/Time + End Date/Time)
		this.timedContainer = contentEl.createDiv(cls("timed-event-fields"));
		if (this.event.allDay) {
			addCls(this.timedContainer, "hidden");
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
			this.durationContainer = this.timedContainer.createDiv(cls("setting-item"));
			this.durationContainer.createEl("div", {
				text: "Duration (min)",
				cls: cls("setting-item-name"),
			});
			this.durationInput = this.durationContainer.createEl("input", {
				type: "number",
				cls: cls("setting-item-control"),
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
		this.allDayContainer = contentEl.createDiv(cls("allday-event-fields"));
		if (!this.event.allDay) {
			addCls(this.allDayContainer, "hidden");
		}

		// Date field (for all-day events)
		const dateContainer = this.allDayContainer.createDiv(cls("setting-item"));
		dateContainer.createEl("div", {
			text: "Date",
			cls: cls("setting-item-name"),
		});
		this.dateInput = dateContainer.createEl("input", {
			type: "date",
			value: this.event.start ? formatDateOnly(this.event.start) : "",
			cls: cls("setting-item-control"),
		});

		// Stopwatch for time tracking (only for timed events)
		this.createStopwatchField(contentEl);

		this.createRecurringEventFields(contentEl);
		this.createCategoryField(contentEl);
		this.createLocationField(contentEl);
		this.createIconField(contentEl);
		this.createParticipantsField(contentEl);
		this.createBreakField(contentEl);
		this.createMarkAsDoneField(contentEl);
		this.createSkipField(contentEl);
		this.createNotificationField(contentEl);
		this.createCustomPropertiesFields(contentEl);
	}

	private createStopwatchField(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.showStopwatch) return;

		this.stopwatchContainer = contentEl.createDiv(cls("stopwatch-field"));

		// Initially hidden when all-day is selected
		if (this.event.allDay) {
			addCls(this.stopwatchContainer, "hidden");
		}

		this.stopwatch = new Stopwatch(
			{
				onStart: (startTime: Date) => {
					this.initialBreakMinutes = Number.parseFloat(this.breakInput?.value) || 0;
					this.startInput.value = formatDateTimeForInput(startTime);

					const endTime = new Date(startTime.getTime() + END_TIME_SYNC_INTERVAL_MS);
					this.endInput.value = formatDateTimeForInput(endTime);

					const event = new Event("change", { bubbles: true });
					this.startInput.dispatchEvent(event);
					this.endInput.dispatchEvent(event);
				},
				onContinueRequested: () => {
					// Continue uses the existing start time from the input field
					// Reset the break counter and return the current start time
					this.initialBreakMinutes = Number.parseFloat(this.breakInput?.value) || 0;
					const startValue = this.startInput.value;
					if (startValue) {
						// If end date is in the past, update it to now
						const endValue = this.endInput.value;
						if (endValue) {
							const endDate = parseAsLocalDate(endValue);
							if (endDate && endDate.getTime() < Date.now()) {
								this.endInput.value = formatDateTimeForInput(new Date());
								this.endInput.dispatchEvent(new Event("change", { bubbles: true }));
							}
						}
						return parseAsLocalDate(startValue);
					}
					return null;
				},
				onStop: (endTime: Date) => {
					this.endInput.value = formatDateTimeForInput(endTime);
					const event = new Event("change", { bubbles: true });
					this.endInput.dispatchEvent(event);
				},
				onBreakUpdate: (breakMinutes: number) => {
					if (this.breakInput) {
						const totalBreak = this.initialBreakMinutes + breakMinutes;
						this.breakInput.value = totalBreak.toString();
					}
				},
			},
			settings.showStopwatchStartWithoutFill
		);

		this.stopwatch.render(this.stopwatchContainer);
	}

	private createRecurringEventFields(contentEl: HTMLElement): void {
		// Recurring event checkbox
		const recurringCheckboxContainer = contentEl.createDiv(cls("setting-item"));
		recurringCheckboxContainer.createEl("div", {
			text: "Recurring event",
			cls: cls("setting-item-name"),
		});
		this.recurringCheckbox = recurringCheckboxContainer.createEl("input", {
			type: "checkbox",
			cls: cls("setting-item-control"),
		});

		// Container for recurring event options (initially hidden)
		this.recurringContainer = contentEl.createDiv(cls("recurring-event-fields"));
		addCls(this.recurringContainer, "hidden");

		// RRule type dropdown
		const rruleContainer = this.recurringContainer.createDiv(cls("setting-item"));
		rruleContainer.createEl("div", {
			text: "Recurrence pattern",
			cls: cls("setting-item-name"),
		});
		this.rruleSelect = rruleContainer.createEl("select", {
			cls: cls("setting-item-control"),
		});

		// Add options to the select
		for (const [value, label] of Object.entries(RECURRENCE_TYPE_OPTIONS)) {
			const option = this.rruleSelect.createEl("option", {
				value,
				text: label,
			});
			option.value = value;
		}
		// Add custom interval option
		const customOption = this.rruleSelect.createEl("option", {
			value: "custom",
			text: "Custom interval...",
		});
		customOption.value = "custom";

		// Custom interval container (initially hidden)
		this.customIntervalContainer = this.recurringContainer.createDiv(cls("setting-item", "custom-interval"));
		addCls(this.customIntervalContainer, "hidden");
		this.customIntervalContainer.createEl("div", {
			text: "Custom interval",
			cls: cls("setting-item-name"),
		});

		const customControlsRow = this.customIntervalContainer.createDiv(
			cls("setting-item-control", "custom-interval-controls")
		);

		// "Every" label
		customControlsRow.createEl("span", { text: "Every " });

		// Interval number input
		this.customIntervalInput = customControlsRow.createEl("input", {
			type: "number",
			cls: cls("custom-interval-input"),
			attr: { min: "1", step: "1", value: "1" },
		});

		// Frequency select
		this.customFreqSelect = customControlsRow.createEl("select", {
			cls: cls("custom-freq-select"),
		});
		const freqOptions: Array<{ value: string; label: string }> = [
			{ value: "DAILY", label: "Days" },
			{ value: "WEEKLY", label: "Weeks" },
			{ value: "MONTHLY", label: "Months" },
			{ value: "YEARLY", label: "Years" },
		];
		for (const { value, label } of freqOptions) {
			const opt = this.customFreqSelect.createEl("option", { value, text: label });
			opt.value = value;
		}

		// Weekday selection (initially hidden, shown when weekly/bi-weekly selected)
		this.weekdayContainer = this.recurringContainer.createDiv(cls("setting-item", "weekday-selection"));
		addCls(this.weekdayContainer, "hidden");
		this.weekdayContainer.createEl("div", {
			text: "Days of week",
			cls: cls("setting-item-name"),
		});

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

		const futureInstancesContainer = this.recurringContainer.createDiv(cls("setting-item"));
		futureInstancesContainer.createEl("div", {
			text: "Future instances count",
			cls: cls("setting-item-name"),
		});
		const futureInstancesDesc = futureInstancesContainer.createEl("div", {
			cls: cls("setting-item-description"),
		});
		futureInstancesDesc.setText("Override the global setting for this event. Leave empty to use the default.");
		this.futureInstancesCountInput = futureInstancesContainer.createEl("input", {
			type: "number",
			cls: cls("setting-item-control"),
			attr: {
				min: "1",
				step: "1",
				placeholder: "Default",
			},
		});

		const generatePastContainer = this.recurringContainer.createDiv(cls("setting-item"));
		generatePastContainer.createEl("div", {
			text: "Generate past events",
			cls: cls("setting-item-name"),
		});
		const generatePastDesc = generatePastContainer.createEl("div", {
			cls: cls("setting-item-description"),
		});
		generatePastDesc.setText("Generate instances from the source event start date instead of from today.");
		this.generatePastEventsCheckbox = generatePastContainer.createEl("input", {
			type: "checkbox",
			cls: cls("setting-item-control"),
		});
	}

	private createCategoryField(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.categoryProp) return;

		const categoryContainer = contentEl.createDiv(cls("setting-item"));
		categoryContainer.createEl("div", {
			text: "Categories",
			cls: cls("setting-item-name"),
		});

		const categoryContent = categoryContainer.createDiv(cls("category-display-content"));

		// Suppress auto-assign permanently once user interacts with categories.
		categoryContent.addEventListener("pointerdown", () => {
			this.suppressAutoCategories = true;
		});

		// Container for displaying selected categories
		this.categoriesContainer = categoryContent.createDiv(cls("categories-list"));

		// Assign Categories button
		const assignButton = categoryContent.createEl("button", {
			text: "Assign categories",
			cls: cls("assign-categories-button"),
		});
		assignButton.addEventListener("click", () => {
			this.openAssignCategoriesModal();
		});

		// Render initial categories
		this.renderCategories();
	}

	private createLocationField(contentEl: HTMLElement): void {
		if (!this.bundle.settingsStore.currentSettings.locationProp) return;
		this.locationInput = createFormField(contentEl, { label: "Location", type: "text", placeholder: "Event location" });
	}

	private createIconField(contentEl: HTMLElement): void {
		if (!this.bundle.settingsStore.currentSettings.iconProp) return;
		this.iconInput = createFormField(contentEl, {
			label: "Icon",
			type: "text",
			placeholder: "Event icon (emoji or text)",
		});
	}

	private createParticipantsField(contentEl: HTMLElement): void {
		if (!this.bundle.settingsStore.currentSettings.participantsProp) return;
		this.participantsInput = createFormField(contentEl, {
			label: "Participants",
			type: "text",
			placeholder: "Alice, Bob, Charlie",
			description: "Comma-separated list of participants",
		});
	}

	private createBreakField(contentEl: HTMLElement): void {
		if (!this.bundle.settingsStore.currentSettings.breakProp) return;
		this.breakInput = createFormField(contentEl, {
			label: "Break (min)",
			type: "number",
			description: "Time to subtract from duration in statistics (decimals supported)",
			attrs: { min: "0", step: "any" },
			placeholder: "0",
		});
	}

	private createMarkAsDoneField(contentEl: HTMLElement): void {
		if (!this.bundle.settingsStore.currentSettings.statusProperty) return;
		this.markAsDoneCheckbox = createFormField(contentEl, { label: "Mark as done", type: "checkbox" });
	}

	private createSkipField(contentEl: HTMLElement): void {
		if (!this.bundle.settingsStore.currentSettings.skipProp) return;
		this.skipCheckbox = createFormField(contentEl, {
			label: "Skip event",
			type: "checkbox",
			description: "Hide event from calendar",
		});
	}

	private createNotificationField(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.enableNotifications) return;

		this.notificationContainer = contentEl.createDiv(cls("setting-item"));
		const isAllDay = this.event.allDay ?? false;
		const labelText = isAllDay ? "Notify days before" : "Notify minutes before";

		this.notificationLabel = this.notificationContainer.createEl("div", {
			text: labelText,
			cls: cls("setting-item-name"),
		});
		const notificationDesc = this.notificationContainer.createEl("div", {
			cls: cls("setting-item-description"),
		});
		notificationDesc.setText("Override default notification timing for this event");
		this.notificationInput = this.notificationContainer.createEl("input", {
			type: "number",
			cls: cls("setting-item-control"),
			attr: {
				min: "0",
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
		const headerContainer = parent.createDiv(cls("setting-item", "property-section-header"));

		const headerDiv = headerContainer.createDiv(cls("setting-item-name"));
		const toggleIcon = headerDiv.createEl("span", {
			text: "▶",
			cls: cls("property-toggle-icon"),
		});
		headerDiv.createEl("span", {
			text: title,
			cls: cls("setting-item-heading"),
		});

		const addButton = headerContainer.createEl("button", {
			text: "Add property",
			cls: cls("mod-cta"),
		});
		addButton.addEventListener("click", () => {
			// Auto-expand when adding a property
			if (container.classList.contains(cls("hidden"))) {
				removeCls(container, "hidden");
				toggleIcon.textContent = "▼";
			}
			onAddClick();
		});

		const container = parent.createDiv(cls("property-container"));
		// Collapsed by default
		addCls(container, "hidden");

		// Toggle collapse on header click
		headerDiv.addEventListener("click", () => {
			const isHidden = container.classList.toggle(cls("hidden"));
			toggleIcon.textContent = isHidden ? "▶" : "▼";
		});

		return container;
	}

	protected addCustomProperty(key = "", value = "", section: "display" | "other" = "other"): void {
		const container = section === "display" ? this.displayPropertiesContainer : this.otherPropertiesContainer;
		const propertyRow = container.createDiv(cls("custom-property-row"));

		propertyRow.createEl("input", {
			type: "text",
			placeholder: "Property name",
			value: key,
			cls: cls("setting-item-control"),
		});

		propertyRow.createEl("input", {
			type: "text",
			placeholder: "Value",
			value: value,
			cls: cls("setting-item-control"),
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

	private createDateTimeInputWithNowButton(parent: HTMLElement, label: string, initialValue: string): HTMLInputElement {
		const container = parent.createDiv(cls("setting-item"));
		container.createEl("div", { text: label, cls: cls("setting-item-name") });
		const inputWrapper = container.createDiv(cls("datetime-input-wrapper"));

		const nowButton = inputWrapper.createEl("button", {
			text: "Now",
			cls: cls("now-button"),
			type: "button",
		});

		const isStartInput = label.toLowerCase().includes("start");
		const fillButton = inputWrapper.createEl("button", {
			text: isStartInput ? "Fill prev" : "Fill next",
			cls: cls("fill-button"),
			type: "button",
			attr: {
				title: isStartInput ? "Fill from previous event's end time" : "Fill from next event's start time",
			},
		});

		const input = inputWrapper.createEl("input", {
			type: "datetime-local",
			value: initialValue,
			cls: cls("setting-item-control"),
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

	// ─── Event Handlers ───────────────────────────────────────────

	private setupEventHandlers(_contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;

		// Handle all-day toggle
		this.allDayCheckbox.addEventListener("change", () => {
			if (this.allDayCheckbox.checked) {
				// Switching TO all-day
				addCls(this.timedContainer, "hidden");
				removeCls(this.allDayContainer, "hidden");
				// Hide stopwatch for all-day events
				if (this.stopwatchContainer) {
					addCls(this.stopwatchContainer, "hidden");
				}
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
				removeCls(this.timedContainer, "hidden");
				addCls(this.allDayContainer, "hidden");
				// Show stopwatch for timed events
				if (this.stopwatchContainer) {
					removeCls(this.stopwatchContainer, "hidden");
				}
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
			toggleCls(this.recurringContainer, "hidden", !this.recurringCheckbox.checked);
		});

		// Handle RRule type selection
		this.rruleSelect.addEventListener("change", () => {
			const selectedValue = this.rruleSelect.value;
			if (selectedValue === "custom") {
				removeCls(this.customIntervalContainer, "hidden");
				addCls(this.weekdayContainer, "hidden");
			} else {
				addCls(this.customIntervalContainer, "hidden");
				const showWeekdays = isWeekdaySupported(selectedValue);
				toggleCls(this.weekdayContainer, "hidden", !showWeekdays);
			}
		});

		registerSubmitHotkey(this.scope, () => this.saveWithAutoCategories());
	}

	protected setupTitleBlurListener(): void {
		this.titleInput.addEventListener("blur", () => {
			this.applyAutoCategories();
		});
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
		// Get the current time from the input field (already in ISO format) instead of this.event.start (Date object in local timezone)
		const currentTimeISO = this.allDayCheckbox.checked ? null : inputValueToISOString(this.startInput.value);

		const adjacentEvent = findAdjacentEvent(
			this.bundle.eventStore,
			currentTimeISO,
			this.event.extendedProps?.filePath,
			direction
		);

		if (!adjacentEvent) {
			new Notice(`No ${direction} event found`);
			return;
		}

		const timeValue =
			timeField === "start" ? adjacentEvent.start : isTimedEvent(adjacentEvent) ? adjacentEvent.end : undefined;

		if (!timeValue) {
			new Notice(`${direction === "previous" ? "Previous" : "Next"} event has no ${timeField} time`);
			return;
		}

		input.value = formatDateTimeForInput(timeValue);

		const event = new Event("change", { bubbles: true });
		input.dispatchEvent(event);

		new Notice(successMessage);
	}

	// ─── Categories ───────────────────────────────────────────────

	/** Exact-match auto-category assignment on blur. No modal — just assigns categories. */
	protected applyAutoCategories(): void {
		if (this.suppressAutoCategories) return;

		const eventName = this.titleInput.value.trim();
		if (!eventName) return;

		const settings = this.bundle.settingsStore.currentSettings;

		const hasAutoAssign =
			settings.autoAssignCategoryByName ||
			(settings.categoryAssignmentPresets && settings.categoryAssignmentPresets.length > 0);

		if (!hasAutoAssign) return;

		const availableCategories = this.bundle.categoryTracker.getCategories();
		const autoAssignedCategories = autoAssignCategories(
			eventName,
			settings,
			availableCategories,
			this.bundle.plugin.isProEnabled
		);

		if (autoAssignedCategories.length > 0) {
			this.selectedCategories = autoAssignedCategories;
			this.renderCategories();
		}
	}

	protected renderCategories(): void {
		if (!this.categoriesContainer) return;

		this.categoriesContainer.empty();

		if (this.selectedCategories.length === 0) {
			this.categoriesContainer.createEl("span", {
				text: "No categories",
				cls: cls("no-categories-text"),
			});
			return;
		}

		const categoriesWithColors = this.bundle.categoryTracker.getCategoriesWithColors();
		const categoryColorMap = new Map(categoriesWithColors.map((c) => [c.name, c.color]));

		for (const categoryName of this.selectedCategories) {
			const categoryItem = this.categoriesContainer.createDiv(cls("category-item"));

			const colorDot = categoryItem.createEl("span", {
				cls: cls("category-color-dot"),
			});
			const color = categoryColorMap.get(categoryName) || this.bundle.settingsStore.currentSettings.defaultNodeColor;
			colorDot.style.setProperty("--category-color", color);

			const nameSpan = categoryItem.createEl("span", {
				text: categoryName,
				cls: cls("category-name"),
			});

			nameSpan.addEventListener("click", () => {
				this.openCategoryEventsModal(categoryName);
			});

			const removeButton = categoryItem.createEl("span", {
				text: "\u00D7",
				cls: cls("category-remove-button"),
				attr: { title: "Remove category" },
			});
			removeButton.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.selectedCategories = this.selectedCategories.filter((c) => c !== categoryName);
				this.renderCategories();
			});
		}
	}

	private openAssignCategoriesModal(): void {
		this.suppressAutoCategories = true;

		const categories = this.bundle.categoryTracker.getCategoriesWithColors();
		const defaultColor = this.bundle.settingsStore.currentSettings.defaultNodeColor;

		openCategoryAssignModal(this.app, categories, defaultColor, this.selectedCategories, (selectedCategories) => {
			this.selectedCategories = selectedCategories;
			this.renderCategories();
		});
	}

	private openCategoryEventsModal(categoryName: string): void {
		const settings = this.bundle.settingsStore.currentSettings;
		showCategoryEventsModal(this.app, categoryName, settings);
	}

	// ─── Presets ──────────────────────────────────────────────────

	protected applyDefaultPreset(): void {
		// Override in subclasses if needed
	}

	protected clearAllFields(): void {
		this.titleInput.value = "";

		this.allDayCheckbox.checked = false;
		removeCls(this.timedContainer, "hidden");
		addCls(this.allDayContainer, "hidden");

		this.startInput.value = "";
		this.endInput.value = "";
		this.dateInput.value = "";
		if (this.durationInput) {
			this.durationInput.value = "";
		}

		this.recurringCheckbox.checked = false;
		removeCls(this.recurringContainer, "hidden");
		this.rruleSelect.value = Object.keys(RECURRENCE_TYPE_OPTIONS)[0]!;
		addCls(this.weekdayContainer, "hidden");
		addCls(this.customIntervalContainer, "hidden");
		this.customFreqSelect.value = "DAILY";
		this.customIntervalInput.value = "1";
		for (const checkbox of this.weekdayCheckboxes.values()) {
			checkbox.checked = false;
		}
		this.futureInstancesCountInput.value = "";

		this.selectedCategories = [];
		this.suppressAutoCategories = false;
		this.renderCategories();

		if (this.locationInput) {
			this.locationInput.value = "";
		}

		if (this.iconInput) {
			this.iconInput.value = "";
		}

		if (this.participantsInput) {
			this.participantsInput.value = "";
		}

		if (this.breakInput) {
			this.breakInput.value = "";
		}

		if (this.skipCheckbox) {
			this.skipCheckbox.checked = false;
		}

		if (this.notificationInput) {
			this.notificationInput.value = "";
		}

		this.stopwatch?.reset();

		this.displayPropertiesContainer.empty();
		this.otherPropertiesContainer.empty();
		addCls(this.displayPropertiesContainer, "hidden");
		addCls(this.otherPropertiesContainer, "hidden");
		this.customProperties = [];

		this.presetSelector.value = "";
		this.titleInput.focus();
	}

	protected applyPreset(preset: FormData | EventPreset): void {
		if ("date" in preset || "startDate" in preset || "endDate" in preset) {
			this.applyFormData(preset);
		} else {
			this.applyPresetData(preset as PresetFormData);
		}
	}

	private applyPresetData(preset: PresetFormData): void {
		const settings = this.bundle.settingsStore.currentSettings;

		if (preset.title !== undefined) {
			this.titleInput.value = preset.title;
		}

		// Apply all-day setting only if it's different from current state
		if (preset.allDay !== undefined && this.allDayCheckbox.checked !== preset.allDay) {
			this.allDayCheckbox.checked = preset.allDay;
			const changeEvent = new Event("change", { bubbles: true });
			this.allDayCheckbox.dispatchEvent(changeEvent);
		}

		if (preset.categories !== undefined) {
			// Parse categories from preset (could be comma-separated string)
			this.selectedCategories = parseIntoList(preset.categories);
			this.suppressAutoCategories = true;
			this.renderCategories();
		}

		if (preset.location !== undefined && this.locationInput) {
			this.locationInput.value = preset.location;
		}

		if (preset.icon !== undefined && this.iconInput) {
			this.iconInput.value = preset.icon;
		}

		if (preset.participants !== undefined && this.participantsInput) {
			this.participantsInput.value = preset.participants;
		}

		if (preset.breakMinutes !== undefined && this.breakInput) {
			this.breakInput.value = preset.breakMinutes.toString();
		}

		if (preset.skip !== undefined && this.skipCheckbox) {
			this.skipCheckbox.checked = preset.skip;
		}

		if (preset.markAsDone !== undefined && this.markAsDoneCheckbox) {
			this.markAsDoneCheckbox.checked = preset.markAsDone;
			this.initialMarkAsDoneState = preset.markAsDone;
		}

		if (preset.notifyBefore !== undefined && this.notificationInput) {
			this.notificationInput.value = preset.notifyBefore.toString();
		}

		if (preset.rruleType) {
			this.recurringCheckbox.checked = true;
			removeCls(this.recurringContainer, "hidden");

			this.applyRruleTypeToForm(preset.rruleType);

			// Trigger change to show/hide weekday selector and custom container
			const rruleChangeEvent = new Event("change", { bubbles: true });
			this.rruleSelect.dispatchEvent(rruleChangeEvent);

			// Apply weekdays if set
			if (preset.rruleSpec && isWeekdaySupported(preset.rruleType)) {
				const weekdays = preset.rruleSpec.split(",").map((day) => day.trim().toLowerCase());
				for (const weekday of weekdays) {
					const checkbox = this.weekdayCheckboxes.get(weekday as Weekday);
					if (checkbox) {
						checkbox.checked = true;
					}
				}
			}

			if (preset.futureInstancesCount !== undefined && this.futureInstancesCountInput) {
				this.futureInstancesCountInput.value = preset.futureInstancesCount.toString();
			}
		}

		if (preset.customProperties) {
			this.displayPropertiesContainer.empty();
			this.otherPropertiesContainer.empty();

			// Get display properties list to categorize based on preset's allDay setting
			// Check both lists to handle presets that might be used for either event type
			const timedDisplayProps = new Set(settings.frontmatterDisplayProperties || []);
			const allDayDisplayProps = new Set(settings.frontmatterDisplayPropertiesAllDay || []);
			const displayPropsSet = new Set([...timedDisplayProps, ...allDayDisplayProps]);

			for (const [key, value] of Object.entries(preset.customProperties)) {
				const stringValue = serializeFrontmatterValue(value);
				const section = displayPropsSet.has(key) ? "display" : "other";
				this.addCustomProperty(key, stringValue, section);
			}
		}
	}

	private applyFormData(formData: FormData): void {
		this.applyPresetData(formData);

		if (formData.date) {
			this.dateInput.value = formData.date;
		}
		if (formData.startDate) {
			this.startInput.value = formatDateTimeForInput(formData.startDate);
		}
		if (formData.endDate) {
			this.endInput.value = formatDateTimeForInput(formData.endDate);
		}

		if (formData.startDate && formData.endDate && this.durationInput) {
			const durationMinutes = calculateDurationMinutes(formData.startDate, formData.endDate);
			this.durationInput.value = durationMinutes.toString();
		}
	}

	private refreshPresetSelector(presets: EventPreset[]): void {
		if (!this.presetSelector) return;

		const currentValue = this.presetSelector.value;

		// Clear existing options except "None"
		while (this.presetSelector.options.length > 0) {
			this.presetSelector.remove(0);
		}

		// Add all preset options
		for (const preset of presets) {
			const option = this.presetSelector.createEl("option", {
				value: preset.id,
				text: preset.name,
			});
			option.value = preset.id;
		}

		if (currentValue && presets.some((p) => p.id === currentValue)) {
			this.presetSelector.value = currentValue;
		} else {
			this.presetSelector.value = "";
		}
	}

	private openSavePresetModal(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const existingPresets = settings.eventPresets || [];
		const atFreeLimit = !this.bundle.plugin.isProEnabled && existingPresets.length >= FREE_MAX_EVENT_PRESETS;

		showSavePresetModal(this.app, existingPresets, atFreeLimit, (presetName, overridePresetId) => {
			this.saveCurrentAsPreset(presetName, overridePresetId);
		});
	}

	private saveCurrentAsPreset(presetName: string, overridePresetId: string | null): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const now = Date.now();

		const formData = this.extractPresetData();

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

	// ─── Minimize & State ─────────────────────────────────────────

	/**
	 * Minimize the modal - saves state and closes the modal.
	 * Time tracking continues via MinimizedModalManager.
	 * The modal can be restored later using the "Restore minimized modal" command.
	 */
	minimize(): void {
		// Set flag to prevent double-saving in onClose
		this.isMinimizing = true;

		const state = this.extractMinimizedState();
		MinimizedModalManager.saveState(state, this.bundle);
		new Notice("Modal minimized. Run command: restore minimized event modal");
		this.close();
	}

	private extractMinimizedState(): MinimizedModalState {
		const formData = this.extractFormData();
		const stopwatchState = this.stopwatch?.exportState() ?? {
			state: "idle" as const,
			startTime: null,
			breakStartTime: null,
			sessionStartTime: null,
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

	protected extractFormData(): FormData {
		const formData: FormData = { ...this.extractPresetData() };

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

		return formData;
	}

	private extractPresetData(): PresetFormData {
		const presetData: PresetFormData = {};

		if (this.titleInput.value) {
			presetData.title = this.titleInput.value;
		}

		presetData.allDay = this.allDayCheckbox.checked;

		if (this.selectedCategories.length > 0) {
			presetData.categories = this.selectedCategories.join(", ");
		}

		if (this.locationInput?.value.trim()) {
			presetData.location = this.locationInput.value.trim();
		}

		if (this.iconInput?.value.trim()) {
			presetData.icon = this.iconInput.value.trim();
		}

		if (this.participantsInput?.value.trim()) {
			presetData.participants = this.participantsInput.value.trim();
		}

		if (this.breakInput?.value) {
			const breakValue = Number.parseFloat(this.breakInput.value);
			if (!Number.isNaN(breakValue) && breakValue > 0) {
				presetData.breakMinutes = breakValue;
			}
		}

		if (this.skipCheckbox) {
			presetData.skip = this.skipCheckbox.checked;
		}

		if (this.markAsDoneCheckbox) {
			presetData.markAsDone = this.markAsDoneCheckbox.checked;
		}

		if (this.notificationInput?.value) {
			const notifyValue = Number.parseInt(this.notificationInput.value, 10);
			if (!Number.isNaN(notifyValue) && notifyValue >= 0) {
				presetData.notifyBefore = notifyValue;
			}
		}

		if (this.recurringCheckbox.checked) {
			presetData.rruleType = this.getEffectiveRruleType();

			if (isWeekdaySupported(presetData.rruleType)) {
				const selectedWeekdays: Weekday[] = [];
				for (const [weekday, checkbox] of this.weekdayCheckboxes.entries()) {
					if (checkbox.checked) {
						selectedWeekdays.push(weekday);
					}
				}
				if (selectedWeekdays.length > 0) {
					presetData.rruleSpec = selectedWeekdays.join(", ");
				}
			}

			if (this.futureInstancesCountInput?.value) {
				const futureCount = Number.parseInt(this.futureInstancesCountInput.value, 10);
				if (!Number.isNaN(futureCount) && futureCount > 0) {
					presetData.futureInstancesCount = futureCount;
				}
			}
		}

		const customProps = this.getCustomProperties();
		if (Object.keys(customProps).length > 0) {
			presetData.customProperties = customProps;
		}

		return presetData;
	}

	private restoreFromState(state: MinimizedModalState): void {
		this.applyPreset(state);
		this.originalFrontmatter = state.originalFrontmatter;

		if (this.stopwatch) {
			this.stopwatch.importState(state.stopwatch);
		}
	}

	// ─── Save ─────────────────────────────────────────────────────

	protected saveWithAutoCategories(): void {
		const eventName = this.titleInput.value.trim();
		if (!eventName) {
			this.saveEvent();
			return;
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const availableCategories = this.bundle.categoryTracker.getCategories();

		if (!this.suppressAutoCategories) {
			if (
				settings.autoAssignCategoryByName ||
				(settings.categoryAssignmentPresets && settings.categoryAssignmentPresets.length > 0)
			) {
				const autoAssigned = autoAssignCategories(
					eventName,
					settings,
					availableCategories,
					this.bundle.plugin.isProEnabled
				);
				if (autoAssigned.length > 0) {
					this.selectedCategories = autoAssigned;
					this.renderCategories();
				}
			}
		}

		this.saveEvent();
	}

	protected buildEventData(): EventSaveData {
		const settings = this.bundle.settingsStore.currentSettings;

		// Start with original frontmatter to preserve all existing properties
		const preservedFrontmatter = { ...this.originalFrontmatter };

		// Update title if titleProp is configured and value is provided
		if (this.titleInput.value && settings.titleProp) {
			preservedFrontmatter[settings.titleProp] = this.titleInput.value;
		}

		let start = "";
		let end: string | null = null;
		let isUntracked = false;

		if (this.allDayCheckbox.checked) {
			if (this.dateInput.value) {
				// For FullCalendar compatibility, we still return ISO strings
				start = `${this.dateInput.value}T00:00:00`;
				end = `${this.dateInput.value}T23:59:59`;
			} else {
				isUntracked = true;
			}
		} else if (this.startInput.value) {
			start = inputValueToISOString(this.startInput.value);
			end = this.endInput.value ? inputValueToISOString(this.endInput.value) : null;
		} else {
			isUntracked = true;
		}

		if (isUntracked) {
			setUntrackedEventBasics(preservedFrontmatter, settings);
		} else {
			setEventBasics(preservedFrontmatter, settings, {
				title: this.titleInput.value,
				start: start,
				end: end ?? undefined,
				allDay: this.allDayCheckbox.checked,
			});
		}

		if (settings.categoryProp) {
			assignListToFrontmatter(preservedFrontmatter, settings.categoryProp, this.selectedCategories);
		}

		if (settings.locationProp && this.locationInput) {
			const locationValue = this.locationInput.value.trim();
			if (locationValue) {
				preservedFrontmatter[settings.locationProp] = locationValue;
			} else {
				delete preservedFrontmatter[settings.locationProp];
			}
		}

		if (settings.iconProp && this.iconInput) {
			const iconValue = this.iconInput.value.trim();
			if (iconValue) {
				preservedFrontmatter[settings.iconProp] = iconValue;
			} else {
				delete preservedFrontmatter[settings.iconProp];
			}
		}

		if (settings.participantsProp && this.participantsInput) {
			const participantsList = parseIntoList(this.participantsInput.value).filter((p) => p.trim());
			assignListToFrontmatter(preservedFrontmatter, settings.participantsProp, participantsList);
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

		if (settings.statusProperty && this.markAsDoneCheckbox) {
			const wasInitiallyChecked = this.initialMarkAsDoneState;
			const isNowChecked = this.markAsDoneCheckbox.checked;

			// Only update if state changed
			if (wasInitiallyChecked !== isNowChecked) {
				const customDoneProp = parseCustomDoneProperty(settings.customDoneProperty);

				if (customDoneProp) {
					// Custom done property configured: use it instead of status property
					if (isNowChecked) {
						preservedFrontmatter[customDoneProp.key] = customDoneProp.value;
					} else {
						const customUndoneProp = parseCustomDoneProperty(settings.customUndoneProperty);
						if (customUndoneProp) {
							preservedFrontmatter[customUndoneProp.key] = customUndoneProp.value;
						} else {
							delete preservedFrontmatter[customDoneProp.key];
						}
					}
				} else {
					// No custom property: fall back to status property
					if (isNowChecked) {
						preservedFrontmatter[settings.statusProperty] = settings.doneValue;
					} else {
						preservedFrontmatter[settings.statusProperty] = settings.notDoneValue;
					}
				}
			}
			// If state didn't change, do nothing (don't modify statusProperty)
		}

		if (settings.skipProp && this.skipCheckbox) {
			if (this.skipCheckbox.checked) {
				preservedFrontmatter[settings.skipProp] = true;
			} else {
				delete preservedFrontmatter[settings.skipProp];
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

		if (
			!isUntracked &&
			settings.enableNotifications &&
			settings.skipNewlyCreatedNotifications &&
			settings.alreadyNotifiedProp &&
			!this.bundle.plugin.syncStore.data.readOnly
		) {
			const startDate = parseAsLocalDate(start);
			if (startDate) {
				const oneMinuteFromNow = new Date(Date.now() + 60000);
				if (startDate < oneMinuteFromNow) {
					preservedFrontmatter[settings.alreadyNotifiedProp] = true;
				}
			}
		}

		// Handle recurring event properties
		if (!isUntracked && this.recurringCheckbox.checked) {
			const rruleType = this.getEffectiveRruleType();
			preservedFrontmatter[settings.rruleProp] = rruleType;

			// Handle weekdays for weekly-based events
			if (isWeekdaySupported(rruleType)) {
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

			if (this.generatePastEventsCheckbox?.checked) {
				preservedFrontmatter[settings.generatePastEventsProp] = true;
			} else {
				delete preservedFrontmatter[settings.generatePastEventsProp];
			}
		} else {
			delete preservedFrontmatter[settings.rruleProp];
			delete preservedFrontmatter[settings.rruleSpecProp];
			delete preservedFrontmatter[settings.rruleIdProp];
			delete preservedFrontmatter[settings.futureInstancesCountProp];
			delete preservedFrontmatter[settings.generatePastEventsProp];
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

		return {
			filePath: this.event.extendedProps?.filePath || null,
			title: this.titleInput.value,
			start,
			end,
			allDay: isUntracked ? false : this.allDayCheckbox.checked,
			preservedFrontmatter,
		};
	}

	/**
	 * Applies an rrule type string to the form controls.
	 * Handles both preset values and custom DSL strings.
	 */
	protected applyRruleTypeToForm(rruleType: string): void {
		if (isPresetType(rruleType)) {
			this.rruleSelect.value = rruleType;
			return;
		}
		// Custom DSL string — set to custom mode and populate fields
		const parsed = parseRecurrenceType(rruleType);
		if (parsed) {
			this.rruleSelect.value = "custom";
			this.customFreqSelect.value = parsed.freq;
			this.customIntervalInput.value = String(parsed.interval);
		}
	}

	/**
	 * Returns the effective rrule type string. For custom intervals, constructs
	 * the DSL string from freq select and interval input. For presets, returns the select value.
	 */
	protected getEffectiveRruleType(): string {
		if (this.rruleSelect.value === "custom") {
			return buildCustomIntervalDSL(
				this.customFreqSelect.value,
				Number.parseInt(this.customIntervalInput.value, 10) || 1
			);
		}
		return this.rruleSelect.value;
	}

	protected loadExistingFrontmatter(): void {
		try {
			const filePath = this.event.extendedProps?.filePath;
			if (!filePath) return;

			const { frontmatter } = getFileAndFrontmatter(this.app, filePath);
			this.originalFrontmatter = { ...frontmatter };

			const settings = this.bundle.settingsStore.currentSettings;
			this.selectedCategories = getCategoriesFromFilePath(this.app, filePath, settings.categoryProp);
		} catch (error) {
			console.error("[EventModal] Error loading existing frontmatter:", error);
		}
	}

	// ─── Utilities & Query API ────────────────────────────────────

	shouldStartStopwatchAndMinimize(): boolean {
		return this.startStopwatchAndMinimize;
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

	public getCustomProperties(): Frontmatter {
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

	protected setEventExtendedProp(name: string, value: unknown): void {
		if (typeof this.event.setExtendedProp === "function") {
			this.event.setExtendedProp(name, value);
			return;
		}

		// Avoid assigning to `extendedProps` directly because it can be a getter-only property
		// (FullCalendar EventApi). Mutating the returned object is safe for plain objects and
		// also works if the getter returns a mutable object.
		const existing = this.event.extendedProps;
		if (existing && typeof existing === "object") {
			existing[name] = value;
			return;
		}

		// Fallback for plain object events that don't have any extended props yet.
		// (If `extendedProps` is getter-only, this assignment would throw, but that case should
		// be handled by `setExtendedProp` above.)
		this.event.extendedProps = { [name]: value };
	}
}
