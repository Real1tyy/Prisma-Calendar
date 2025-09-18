import {
	formatDateTimeForInput,
	inputValueToISOString,
} from "@real1ty-obsidian-plugins/utils/date-utils";
import { type App, Modal, TFile } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";

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
	protected allDayCheckbox!: HTMLInputElement;
	protected originalFrontmatter: Record<string, unknown> = {};

	constructor(
		app: App,
		bundle: CalendarBundle,
		event: EventModalData,
		onSave: (eventData: EventSaveData) => void
	) {
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

		// Start date/time field
		const startContainer = contentEl.createDiv("setting-item");
		startContainer.createEl("div", { text: "Start", cls: "setting-item-name" });
		this.startInput = startContainer.createEl("input", {
			type: "datetime-local",
			value: this.event.start ? formatDateTimeForInput(this.event.start.toString()) : "",
			cls: "setting-item-control",
		});

		// End date/time field
		const endContainer = contentEl.createDiv("setting-item");
		endContainer.createEl("div", { text: "End", cls: "setting-item-name" });
		this.endInput = endContainer.createEl("input", {
			type: "datetime-local",
			value: this.event.end ? formatDateTimeForInput(this.event.end.toString()) : "",
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
	}

	private setupEventHandlers(contentEl: HTMLElement): void {
		// Handle all-day toggle
		this.allDayCheckbox.addEventListener("change", () => {
			if (this.allDayCheckbox.checked) {
				this.startInput.type = "date";
				this.endInput.type = "date";
			} else {
				this.startInput.type = "datetime-local";
				this.endInput.type = "datetime-local";
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

		// Update only the changed properties
		if (this.titleInput.value && settings.titleProp) {
			preservedFrontmatter[settings.titleProp] = this.titleInput.value;
		}

		preservedFrontmatter[settings.startProp] = this.allDayCheckbox.checked
			? this.startInput.value
			: inputValueToISOString(this.startInput.value);

		if (this.endInput.value) {
			preservedFrontmatter[settings.endProp] = this.allDayCheckbox.checked
				? this.endInput.value
				: inputValueToISOString(this.endInput.value);
		}

		if (settings.allDayProp) {
			preservedFrontmatter[settings.allDayProp] = this.allDayCheckbox.checked;
		}

		const eventData: EventSaveData = {
			filePath: this.event.extendedProps?.filePath || null,
			title: this.titleInput.value,
			start: this.allDayCheckbox.checked
				? this.startInput.value
				: inputValueToISOString(this.startInput.value),
			end: this.endInput.value
				? this.allDayCheckbox.checked
					? this.endInput.value
					: inputValueToISOString(this.endInput.value)
				: null,
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
