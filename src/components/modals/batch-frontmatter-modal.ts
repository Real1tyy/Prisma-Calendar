import { addCls, cls } from "@real1ty-obsidian-plugins/utils";
import { type App, Modal } from "obsidian";
import type { SingleCalendarConfig } from "../../types/settings";

interface FrontmatterProperty {
	key: string;
	value: string;
	deleteMode: boolean;
}

export class BatchFrontmatterModal extends Modal {
	private properties: FrontmatterProperty[] = [];
	private propertiesContainer!: HTMLElement;
	private onSubmit: (properties: Map<string, string | null>) => void;

	constructor(app: App, _settings: SingleCalendarConfig, onSubmit: (properties: Map<string, string | null>) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Batch Frontmatter Management" });

		const description = contentEl.createEl("p", {
			text: "Add, update, or delete frontmatter properties across all selected events. Leave value empty and check Delete to remove a property.",
		});
		addCls(description, "setting-item-description");

		this.createPropertiesSection(contentEl);
		this.createButtons(contentEl);

		this.addProperty("", "", false);
	}

	private createPropertiesSection(container: HTMLElement): void {
		const headerContainer = container.createDiv("setting-item");
		const headerDiv = headerContainer.createDiv("setting-item-name");
		headerDiv.createEl("div", { text: "Properties", cls: "setting-item-heading" });

		const addButton = headerContainer.createEl("button", {
			text: "Add property",
			cls: "mod-cta",
		});
		addButton.addEventListener("click", () => {
			this.addProperty("", "", false);
		});

		this.propertiesContainer = container.createDiv(cls("batch-frontmatter-container"));
	}

	private addProperty(key = "", value = "", deleteMode = false): void {
		const propertyRow = this.propertiesContainer.createDiv(cls("batch-frontmatter-row"));

		const keyInput = propertyRow.createEl("input", {
			type: "text",
			placeholder: "Property name",
			value: key,
			cls: "setting-item-control",
		});
		addCls(keyInput, "batch-frontmatter-key");

		const valueInput = propertyRow.createEl("input", {
			type: "text",
			placeholder: "Value (leave empty to delete if Delete is checked)",
			value: value,
			cls: "setting-item-control",
		});
		addCls(valueInput, "batch-frontmatter-value");

		const checkboxContainer = propertyRow.createDiv(cls("batch-frontmatter-delete-container"));
		const deleteCheckbox = checkboxContainer.createEl("input", {
			type: "checkbox",
			attr: { id: `delete-${Date.now()}-${Math.random()}` },
		});
		deleteCheckbox.checked = deleteMode;
		addCls(deleteCheckbox, "batch-frontmatter-delete-checkbox");

		const deleteLabel = checkboxContainer.createEl("label", {
			text: "Delete",
			attr: { for: deleteCheckbox.id },
		});
		addCls(deleteLabel, "batch-frontmatter-delete-label");

		deleteCheckbox.addEventListener("change", () => {
			if (deleteCheckbox.checked) {
				valueInput.disabled = true;
				valueInput.value = "";
				addCls(valueInput, "batch-frontmatter-disabled");
			} else {
				valueInput.disabled = false;
				valueInput.classList.remove(cls("batch-frontmatter-disabled"));
			}
		});

		if (deleteMode) {
			valueInput.disabled = true;
			addCls(valueInput, "batch-frontmatter-disabled");
		}

		const removeButton = propertyRow.createEl("button", {
			text: "Remove",
		});
		addCls(removeButton, "batch-frontmatter-remove-button");
		removeButton.addEventListener("click", () => {
			const index = this.properties.indexOf(property);
			if (index !== -1) {
				this.properties.splice(index, 1);
			}
			propertyRow.remove();
		});

		const property: FrontmatterProperty = {
			key,
			value,
			deleteMode,
		};

		this.properties.push(property);

		keyInput.addEventListener("input", () => {
			property.key = keyInput.value;
		});
		valueInput.addEventListener("input", () => {
			property.value = valueInput.value;
		});
		deleteCheckbox.addEventListener("change", () => {
			property.deleteMode = deleteCheckbox.checked;
		});
	}

	private createButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv("modal-button-container");

		const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
		cancelBtn.onclick = () => this.close();

		const applyButton = buttonContainer.createEl("button", {
			text: "Apply changes",
			cls: "mod-cta",
		});
		applyButton.onclick = () => {
			const propertyMap = this.buildPropertyMap();
			this.onSubmit(propertyMap);
			this.close();
		};
	}

	private buildPropertyMap(): Map<string, string | null> {
		const propertyMap = new Map<string, string | null>();

		for (const property of this.properties) {
			const key = property.key.trim();
			if (!key) continue;

			if (property.deleteMode) {
				propertyMap.set(key, null);
			} else {
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
