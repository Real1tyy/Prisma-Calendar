import {
	addCls,
	afterRender,
	calculateDurationMinutes,
	cls,
	ensureISOSuffix,
	extractDisplayName,
	parseAsLocalDate,
	parseFrontmatterRecord,
	registerSubmitHotkey,
	removeCls,
	renderSchemaForm,
	type SchemaFormHandle,
	serializeFrontmatterValue,
	toggleCls,
	toLocalISOString,
} from "@real1ty-obsidian-plugins";
import { type App, Modal, Notice } from "obsidian";
import type { Subscription } from "rxjs";
import type { z } from "zod";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { FREE_MAX_EVENT_PRESETS } from "../../../core/license";
import {
	END_TIME_SYNC_INTERVAL_MS,
	MinimizedModalManager,
	type MinimizedModalState,
} from "../../../core/minimized-modal-manager";
import type { Frontmatter } from "../../../types";
import { isTimedEvent } from "../../../types/calendar";
import { FormToFieldsSchema, PositiveFloat } from "../../../types/event-fields";
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
import { autoAssignCategories, findAdjacentEvent } from "../../../utils/event-matching";
import { cleanupTitle } from "../../../utils/event-naming";
import { formatDateOnly, formatDateTimeForInput } from "../../../utils/format";
import { writeMetadataToFrontmatter } from "../../../utils/frontmatter-writer";
import { getCategoriesFromFilePath, getFileAndFrontmatter } from "../../../utils/obsidian";
import { Stopwatch } from "../../stopwatch";
import { TitleInputSuggest } from "../../title-input-suggest";
import { openCategoryAssignModal, openPrerequisiteAssignModal } from "../category/assignment";
import { showCategoryEventsModal } from "../series/bases-view";
import { renderChipList } from "./chip-list-renderer";
import {
	applyPresetToState,
	createDefaultState,
	type EventFormState,
	extractPresetFromState,
	SimpleEditableFieldsSchema,
} from "./event-form-state";
import {
	applyDateFieldsToFrontmatter,
	applyNotificationToFrontmatter,
	applyRecurringFieldsToFrontmatter,
} from "./event-frontmatter-mapper";
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
	protected simpleFieldsHandle: SchemaFormHandle<Record<string, unknown>> | null = null;
	protected prerequisitesContainer?: HTMLElement;
	protected selectedPrerequisites: string[] = [];
	protected initialMarkAsDoneState: boolean = false;
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
		this.createPrerequisiteField(contentEl);
		this.renderSimpleFields(contentEl);
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
					this.initialBreakMinutes =
						PositiveFloat.parse(String(this.getSimpleFieldValues()["breakMinutes"] ?? "")) ?? 0;
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
					this.initialBreakMinutes =
						PositiveFloat.parse(String(this.getSimpleFieldValues()["breakMinutes"] ?? "")) ?? 0;
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
					const totalBreak = this.initialBreakMinutes + breakMinutes;
					this.setSimpleFieldValues({ breakMinutes: totalBreak.toString() });
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

	private createPrerequisiteField(contentEl: HTMLElement): void {
		if (!this.bundle.settingsStore.currentSettings.prerequisiteProp) return;

		const container = contentEl.createDiv(cls("setting-item"));
		container.createEl("div", {
			text: "Prerequisites",
			cls: cls("setting-item-name"),
		});

		const content = container.createDiv(cls("category-display-content"));
		this.prerequisitesContainer = content.createDiv(cls("categories-list"));

		const assignButton = content.createEl("button", {
			text: "Assign prerequisites",
			cls: cls("assign-categories-button"),
		});
		assignButton.addEventListener("click", () => {
			this.openAssignPrerequisitesModal();
		});

		this.renderPrerequisites();
	}

	protected renderPrerequisites(): void {
		if (!this.prerequisitesContainer) return;

		renderChipList({
			container: this.prerequisitesContainer,
			items: this.selectedPrerequisites,
			emptyText: "No prerequisites",
			getDisplayName: (link) => cleanupTitle(extractDisplayName(link)),
			getTooltip: (link) => link,
			onRemove: (link) => {
				this.selectedPrerequisites = this.selectedPrerequisites.filter((p) => p !== link);
				this.renderPrerequisites();
			},
		});
	}

	private openAssignPrerequisitesModal(): void {
		openPrerequisiteAssignModal(this.app, this.bundle, this.selectedPrerequisites, (selected) => {
			this.selectedPrerequisites = selected;
			this.renderPrerequisites();
		});
	}

	private renderSimpleFields(contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const fullShape = SimpleEditableFieldsSchema.shape;

		const settingsGuards: Record<string, string> = {
			location: "locationProp",
			icon: "iconProp",
			participants: "participantsProp",
			breakMinutes: "breakProp",
			markAsDone: "statusProperty",
			skip: "skipProp",
		};

		const shape: Record<string, z.ZodTypeAny> = {};
		for (const [key, guard] of Object.entries(settingsGuards)) {
			if (settings[guard as keyof typeof settings]) {
				shape[key] = fullShape[key as keyof typeof fullShape];
			}
		}

		if (Object.keys(shape).length === 0) return;

		const container = contentEl.createDiv(cls("simple-fields-container"));
		this.simpleFieldsHandle = renderSchemaForm(container, { shape, prefix: "prisma-" });
	}

	protected getSimpleFieldValues(): Record<string, unknown> {
		return this.simpleFieldsHandle?.getValues() ?? {};
	}

	protected setSimpleFieldValues(values: Partial<Record<string, unknown>>): void {
		this.simpleFieldsHandle?.setValues(values);
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

	private syncDateModeUI(): void {
		const isAllDay = this.allDayCheckbox.checked;
		toggleCls(this.timedContainer, "hidden", isAllDay);
		toggleCls(this.allDayContainer, "hidden", !isAllDay);
		if (this.stopwatchContainer) {
			toggleCls(this.stopwatchContainer, "hidden", isAllDay);
		}
		if (this.notificationLabel) {
			this.notificationLabel.setText(isAllDay ? "Notify days before" : "Notify minutes before");
		}
	}

	private syncDateValuesOnModeChange(): void {
		if (this.allDayCheckbox.checked) {
			if (this.startInput.value) {
				this.dateInput.value = formatDateOnly(this.startInput.value);
			}
		} else {
			if (this.dateInput.value) {
				this.startInput.value = `${this.dateInput.value}T09:00`;
				this.endInput.value = `${this.dateInput.value}T10:00`;
				this.updateDurationFromDates();
			}
		}
	}

	private syncRecurrenceUI(): void {
		toggleCls(this.recurringContainer, "hidden", !this.recurringCheckbox.checked);
		const selectedValue = this.rruleSelect.value;
		toggleCls(this.customIntervalContainer, "hidden", selectedValue !== "custom");
		toggleCls(this.weekdayContainer, "hidden", selectedValue === "custom" || !isWeekdaySupported(selectedValue));
	}

	private setupEventHandlers(_contentEl: HTMLElement): void {
		const settings = this.bundle.settingsStore.currentSettings;

		this.allDayCheckbox.addEventListener("change", () => {
			this.syncDateModeUI();
			this.syncDateValuesOnModeChange();
		});

		if (settings.showDurationField && this.durationInput) {
			this.startInput.addEventListener("change", () => this.updateDurationFromDates());
			this.endInput.addEventListener("change", () => this.updateDurationFromDates());
			this.durationInput.addEventListener("input", () => this.updateEndFromDuration());
		}

		this.recurringCheckbox.addEventListener("change", () => this.syncRecurrenceUI());
		this.rruleSelect.addEventListener("change", () => this.syncRecurrenceUI());

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
		const currentTimeISO = this.allDayCheckbox.checked ? null : toLocalISOString(new Date(this.startInput.value));

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

		const categoriesWithColors = this.bundle.categoryTracker.getCategoriesWithColors();
		const colorMap = new Map(categoriesWithColors.map((c) => [c.name, c.color]));
		const defaultColor = this.bundle.settingsStore.currentSettings.defaultNodeColor;

		renderChipList({
			container: this.categoriesContainer,
			items: this.selectedCategories,
			emptyText: "No categories",
			renderPrefix: (chipEl, item) => {
				const dot = chipEl.createEl("span", { cls: cls("category-color-dot") });
				dot.style.setProperty("--category-color", colorMap.get(item) || defaultColor);
			},
			onNameClick: (item) => this.openCategoryEventsModal(item),
			onRemove: (item) => {
				this.selectedCategories = this.selectedCategories.filter((c) => c !== item);
				this.renderCategories();
			},
		});
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
		const defaults = createDefaultState();
		this.startInput.value = "";
		this.endInput.value = "";
		this.dateInput.value = "";
		if (this.durationInput) this.durationInput.value = "";
		this.rruleSelect.value = Object.keys(RECURRENCE_TYPE_OPTIONS)[0]!;
		for (const checkbox of this.weekdayCheckboxes.values()) checkbox.checked = false;
		this.futureInstancesCountInput.value = "";
		this.suppressAutoCategories = false;
		this.stopwatch?.reset();
		this.displayPropertiesContainer.empty();
		this.otherPropertiesContainer.empty();
		addCls(this.displayPropertiesContainer, "hidden");
		addCls(this.otherPropertiesContainer, "hidden");
		this.customProperties = [];
		this.presetSelector.value = "";

		this.applyStateToDom(defaults);
		this.syncDateModeUI();
		this.syncRecurrenceUI();
		this.titleInput.focus();
	}

	protected applyPreset(preset: EventPreset): void {
		const state = applyPresetToState(this.readStateFromDOM(), preset);
		this.applyStateToDom(state);

		if (preset.categories !== undefined) {
			this.suppressAutoCategories = true;
		}

		if (preset.customProperties) {
			this.restoreCustomProperties(preset.customProperties);
		}
	}

	private restoreCustomProperties(customProperties: Record<string, unknown>): void {
		const settings = this.bundle.settingsStore.currentSettings;
		this.displayPropertiesContainer.empty();
		this.otherPropertiesContainer.empty();

		const displayPropsSet = new Set([
			...(settings.frontmatterDisplayProperties || []),
			...(settings.frontmatterDisplayPropertiesAllDay || []),
		]);

		for (const [key, value] of Object.entries(customProperties)) {
			this.addCustomProperty(key, serializeFrontmatterValue(value), displayPropsSet.has(key) ? "display" : "other");
		}
	}

	private readStateFromDOM(): EventFormState {
		const fv = this.getSimpleFieldValues();
		return {
			title: this.titleInput.value,
			allDay: this.allDayCheckbox.checked,
			start: this.startInput.value,
			end: this.endInput.value,
			date: this.dateInput.value,
			categories: [...this.selectedCategories],
			prerequisites: [...this.selectedPrerequisites],
			location: String(fv["location"] ?? ""),
			icon: String(fv["icon"] ?? ""),
			participants: String(fv["participants"] ?? ""),
			breakMinutes: String(fv["breakMinutes"] ?? ""),
			markAsDone: fv["markAsDone"] === true,
			skip: fv["skip"] === true,
			notifyBefore: this.notificationInput?.value ?? "",
			recurring: {
				enabled: this.recurringCheckbox.checked,
				rruleType: this.getEffectiveRruleType(),
				weekdays: [...this.weekdayCheckboxes.entries()].filter(([, cb]) => cb.checked).map(([day]) => day),
				customFreq: this.customFreqSelect?.value ?? "DAILY",
				customInterval: this.customIntervalInput?.value ?? "1",
				futureInstancesCount: this.futureInstancesCountInput?.value ?? "",
				generatePastEvents: this.generatePastEventsCheckbox?.checked ?? false,
			},
		};
	}

	private applyStateToDom(state: EventFormState): void {
		if (state.title !== undefined) {
			this.titleInput.value = state.title;
		}

		if (this.allDayCheckbox.checked !== state.allDay) {
			this.allDayCheckbox.checked = state.allDay;
			this.allDayCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
		}

		this.selectedCategories = [...state.categories];
		this.renderCategories();
		this.selectedPrerequisites = [...state.prerequisites];
		this.renderPrerequisites();

		this.setSimpleFieldValues({
			location: state.location,
			icon: state.icon,
			participants: state.participants,
			breakMinutes: state.breakMinutes,
			markAsDone: state.markAsDone,
			skip: state.skip,
		});

		this.initialMarkAsDoneState = state.markAsDone;

		if (this.notificationInput) {
			this.notificationInput.value = state.notifyBefore;
		}

		if (state.recurring.enabled) {
			this.recurringCheckbox.checked = true;
			removeCls(this.recurringContainer, "hidden");
			this.applyRruleTypeToForm(state.recurring.rruleType);
			this.rruleSelect.dispatchEvent(new Event("change", { bubbles: true }));

			if (isWeekdaySupported(state.recurring.rruleType)) {
				for (const weekday of state.recurring.weekdays) {
					const cb = this.weekdayCheckboxes.get(weekday as Weekday);
					if (cb) cb.checked = true;
				}
			}

			if (state.recurring.futureInstancesCount && this.futureInstancesCountInput) {
				this.futureInstancesCountInput.value = state.recurring.futureInstancesCount;
			}
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

		const presetFields = extractPresetFromState(this.readStateFromDOM());
		const customProps = this.getCustomProperties();

		const preset: EventPreset = {
			...presetFields,
			...(Object.keys(customProps).length > 0 && { customProperties: customProps }),
			id: overridePresetId || `preset-${now}`,
			name: presetName,
			createdAt: now,
		} as EventPreset;

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
		const stopwatchState = this.stopwatch?.exportState() ?? {
			state: "idle" as const,
			startTime: null,
			breakStartTime: null,
			sessionStartTime: null,
			totalBreakMs: 0,
		};

		const customProps = this.getCustomProperties();

		return {
			formState: this.readStateFromDOM(),
			...(Object.keys(customProps).length > 0 && { customProperties: customProps }),
			stopwatch: stopwatchState,
			modalType: this.getModalType(),
			filePath: this.event.extendedProps?.filePath ?? null,
			originalFrontmatter: this.originalFrontmatter,
			calendarId: this.bundle.calendarId,
		};
	}

	private restoreFromState(state: MinimizedModalState): void {
		this.applyStateToDom(state.formState);
		this.originalFrontmatter = state.originalFrontmatter;

		if (state.formState.categories.length > 0) {
			this.suppressAutoCategories = true;
		}

		if (state.customProperties) {
			this.restoreCustomProperties(state.customProperties);
		}

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
		const fm = { ...this.originalFrontmatter };
		const original = this.originalFrontmatter;

		if (this.titleInput.value && settings.titleProp) {
			fm[settings.titleProp] = this.titleInput.value;
		}

		let start = "";
		let end: string | null = null;
		let isUntracked = false;

		if (this.allDayCheckbox.checked) {
			if (this.dateInput.value) {
				start = `${this.dateInput.value}T00:00:00`;
				end = `${this.dateInput.value}T23:59:59`;
			} else {
				isUntracked = true;
			}
		} else if (this.startInput.value) {
			start = ensureISOSuffix(this.startInput.value);
			end = this.endInput.value ? ensureISOSuffix(this.endInput.value) : null;
		} else {
			isUntracked = true;
		}

		const dateData: { title: string; start: string; end?: string; allDay: boolean; isUntracked: boolean } = {
			title: this.titleInput.value,
			start,
			allDay: this.allDayCheckbox.checked,
			isUntracked,
		};
		if (end !== null) {
			dateData.end = end;
		}

		applyDateFieldsToFrontmatter(fm, settings, dateData);

		const fv = this.getSimpleFieldValues();
		const parsed = FormToFieldsSchema.parse(fv);

		writeMetadataToFrontmatter(
			fm,
			settings,
			{
				...parsed,
				categories: this.selectedCategories,
			},
			{
				initialMarkAsDone: this.initialMarkAsDoneState,
				prerequisites: this.selectedPrerequisites,
				originalFrontmatter: original,
			}
		);

		applyNotificationToFrontmatter(
			fm,
			settings,
			this.notificationInput?.value,
			this.allDayCheckbox.checked,
			!isUntracked && settings.skipNewlyCreatedNotifications && !this.bundle.plugin.syncStore.data.readOnly,
			start
		);

		const selectedWeekdays: string[] = [];
		if (this.recurringCheckbox.checked && isWeekdaySupported(this.getEffectiveRruleType())) {
			for (const [weekday, checkbox] of this.weekdayCheckboxes.entries()) {
				if (checkbox.checked) selectedWeekdays.push(weekday);
			}
		}

		applyRecurringFieldsToFrontmatter(
			fm,
			original,
			settings,
			{
				enabled: this.recurringCheckbox.checked,
				rruleType: this.getEffectiveRruleType(),
				weekdays: selectedWeekdays,
				futureInstancesCount: this.futureInstancesCountInput?.value,
				generatePastEvents: this.generatePastEventsCheckbox?.checked ?? false,
			},
			isUntracked
		);

		const preservedFrontmatter = fm;

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
		// Tests sometimes instantiate the modal without rendering all form controls.
		// Guard against missing elements to keep save/build logic safe.
		const rruleSelect = (this as unknown as { rruleSelect?: HTMLSelectElement }).rruleSelect;
		if (!rruleSelect) return;

		if (isPresetType(rruleType)) {
			rruleSelect.value = rruleType;
			return;
		}
		// Custom DSL string — set to custom mode and populate fields
		const parsed = parseRecurrenceType(rruleType);
		if (parsed) {
			const customFreqSelect = (this as unknown as { customFreqSelect?: HTMLSelectElement }).customFreqSelect;
			const customIntervalInput = (this as unknown as { customIntervalInput?: HTMLInputElement }).customIntervalInput;
			if (!customFreqSelect || !customIntervalInput) return;

			rruleSelect.value = "custom";
			customFreqSelect.value = parsed.freq;
			customIntervalInput.value = String(parsed.interval);
		}
	}

	/**
	 * Returns the effective rrule type string. For custom intervals, constructs
	 * the DSL string from freq select and interval input. For presets, returns the select value.
	 */
	protected getEffectiveRruleType(): string {
		// Tests sometimes instantiate the modal without rendering all recurrence form controls.
		const rruleSelect = (this as unknown as { rruleSelect?: HTMLSelectElement }).rruleSelect;
		if (!rruleSelect) return "";

		if (rruleSelect.value === "custom") {
			const customFreqSelect = (this as unknown as { customFreqSelect?: HTMLSelectElement }).customFreqSelect;
			const customIntervalInput = (this as unknown as { customIntervalInput?: HTMLInputElement }).customIntervalInput;
			if (!customFreqSelect || !customIntervalInput) return "custom";

			return buildCustomIntervalDSL(customFreqSelect.value, Number.parseInt(customIntervalInput.value, 10) || 1);
		}

		return rruleSelect.value;
	}

	protected loadExistingFrontmatter(): void {
		try {
			const filePath = this.event.extendedProps?.filePath;
			if (!filePath) return;

			const { frontmatter } = getFileAndFrontmatter(this.app, filePath);
			this.originalFrontmatter = { ...frontmatter };

			const settings = this.bundle.settingsStore.currentSettings;
			this.selectedCategories = getCategoriesFromFilePath(this.app, filePath, settings.categoryProp);

			if (this.selectedCategories.length > 0) {
				this.suppressAutoCategories = true;
			}
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
