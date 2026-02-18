import { addCls, cls, removeCls } from "@real1ty-obsidian-plugins";
import { type App, Modal } from "obsidian";
import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { getAllFrontmatterProperties } from "../../utils/calendar-events";

interface FrontmatterProperty {
	key: string;
	value: string;
	isExisting: boolean;
	markedForDeletion: boolean;
	originalKey: string;
	originalValue: string;
}

export class BatchFrontmatterModal extends Modal {
	private properties: FrontmatterProperty[] = [];
	private propertiesContainer!: HTMLElement;
	private onSubmit: (properties: Map<string, string | null>) => void;
	private selectedEvents: CalendarEvent[];
	private settings: SingleCalendarConfig;

	constructor(
		app: App,
		settings: SingleCalendarConfig,
		selectedEvents: CalendarEvent[],
		onSubmit: (properties: Map<string, string | null>) => void
	) {
		super(app);
		this.settings = settings;
		this.selectedEvents = selectedEvents;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		addCls(contentEl, "batch-frontmatter-modal");

		contentEl.createEl("h2", { text: "Batch frontmatter management" });

		const description = contentEl.createEl("p", {
			text: "Add, update, or delete frontmatter properties across all selected events.",
		});
		addCls(description, "setting-item-description");

		this.createPropertiesSection(contentEl);
		this.createButtons(contentEl);

		this.prefillExistingProperties();

		this.setupKeyboardHandlers();
	}

	private createPropertiesSection(container: HTMLElement): void {
		const headerContainer = container.createDiv(cls("setting-item"));
		const headerDiv = headerContainer.createDiv(cls("setting-item-name"));
		headerDiv.createEl("div", {
			text: "Properties",
			cls: cls("setting-item-heading"),
		});

		const addButton = headerContainer.createEl("button", {
			text: "Add property",
			cls: cls("mod-cta"),
		});
		addButton.addEventListener("click", () => {
			this.addProperty("", "", false);
		});

		// Column headers
		const columnHeaderRow = container.createDiv(cls("batch-frontmatter-header-row"));

		columnHeaderRow.createEl("div", {
			text: "Property name",
			cls: cls("batch-frontmatter-header-label"),
		});

		columnHeaderRow.createEl("div", {
			text: "Value",
			cls: cls("batch-frontmatter-header-label"),
		});

		this.propertiesContainer = container.createDiv(cls("batch-frontmatter-container"));
	}

	private addProperty(key = "", value = "", isExisting = false): void {
		const propertyRow = this.propertiesContainer.createDiv(cls("batch-frontmatter-row"));

		if (isExisting) {
			addCls(propertyRow, "batch-frontmatter-existing");
		}

		const keyInput = propertyRow.createEl("input", {
			type: "text",
			placeholder: "Property name",
			value: key,
			cls: cls("setting-item-control"),
		});
		addCls(keyInput, "batch-frontmatter-key");

		const valueInput = propertyRow.createEl("input", {
			type: "text",
			placeholder: "Value",
			value: value,
			cls: cls("setting-item-control"),
		});
		addCls(valueInput, "batch-frontmatter-value");

		const removeButton = propertyRow.createEl("button", {
			text: "✕",
		});
		addCls(removeButton, "batch-frontmatter-remove-button");

		const property: FrontmatterProperty = {
			key,
			value,
			isExisting,
			markedForDeletion: false,
			originalKey: key,
			originalValue: value,
		};

		this.properties.push(property);

		removeButton.addEventListener("click", () => {
			if (isExisting) {
				// Toggle deletion state
				property.markedForDeletion = !property.markedForDeletion;
				if (property.markedForDeletion) {
					addCls(propertyRow, "batch-frontmatter-marked-deletion");
					keyInput.disabled = true;
					valueInput.disabled = true;
				} else {
					removeCls(propertyRow, "batch-frontmatter-marked-deletion");
					keyInput.disabled = false;
					valueInput.disabled = false;
				}
			} else {
				// Remove new property immediately
				const index = this.properties.indexOf(property);
				if (index !== -1) {
					this.properties.splice(index, 1);
				}
				propertyRow.remove();
			}
		});

		keyInput.addEventListener("input", () => {
			property.key = keyInput.value;
		});
		valueInput.addEventListener("input", () => {
			property.value = valueInput.value;
		});
	}

	private createButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv(cls("modal-button-container"));

		const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
		cancelBtn.onclick = () => this.close();

		const applyButton = buttonContainer.createEl("button", {
			text: "Apply changes",
			cls: cls("mod-cta"),
		});
		applyButton.onclick = () => this.applyChanges();
	}

	private applyChanges(): void {
		const propertyMap = this.buildPropertyMap();
		this.onSubmit(propertyMap);
		this.close();
	}

	private setupKeyboardHandlers(): void {
		// scope.register works modal-wide regardless of focus
		this.scope.register([], "Enter", (e) => {
			e.preventDefault();
			this.applyChanges();
			return false;
		});
	}

	private prefillExistingProperties(): void {
		const existingProperties = getAllFrontmatterProperties(this.app, this.selectedEvents, this.settings);

		if (existingProperties.size === 0) {
			this.addProperty("", "", false);
			return;
		}

		for (const [key, value] of existingProperties.entries()) {
			this.addProperty(key, value, true);
		}

		this.addProperty("", "", false);
	}

	private buildPropertyMap(): Map<string, string | null> {
		const propertyMap = new Map<string, string | null>();

		for (const property of this.properties) {
			const key = property.key.trim();
			if (!key) continue;

			if (property.markedForDeletion) {
				propertyMap.set(key, null);
			} else if (property.isExisting) {
				// Only include existing properties if the user actually changed them
				const value = property.value.trim();
				const keyChanged = key !== property.originalKey;
				const valueChanged = value !== property.originalValue.trim();

				if (keyChanged || valueChanged) {
					if (keyChanged && property.originalKey.trim()) {
						// Key was renamed: delete old key, set new key
						propertyMap.set(property.originalKey.trim(), null);
					}
					if (value) {
						propertyMap.set(key, value);
					}
				}
			} else {
				// New property: include if it has a value
				const value = property.value.trim();
				if (value) {
					propertyMap.set(key, value);
				}
			}
		}

		return propertyMap;
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
