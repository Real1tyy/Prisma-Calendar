import { addCls, cls } from "@real1ty-obsidian-plugins";
import { type App, Modal, Notice } from "obsidian";
import type { EventPreset } from "../../types/settings";

export class SavePresetModal extends Modal {
	private onSave: (name: string, overridePresetId: string | null) => void;
	private existingPresets: EventPreset[];
	private nameInput!: HTMLInputElement;
	private overrideSelect!: HTMLSelectElement;

	constructor(
		app: App,
		existingPresets: EventPreset[],
		onSave: (name: string, overridePresetId: string | null) => void
	) {
		super(app);
		this.existingPresets = existingPresets;
		this.onSave = onSave;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		addCls(this.modalEl, "save-preset-modal");

		contentEl.createEl("h3", { text: "Save as preset" });

		// Override existing preset selector
		const overrideContainer = contentEl.createDiv(cls("setting-item"));
		overrideContainer.createEl("div", {
			text: "Save to",
			cls: "setting-item-name",
		});
		this.overrideSelect = overrideContainer.createEl("select", {
			cls: cls("setting-item-dropdown"),
		});

		// Add "Create new" option
		const newOption = this.overrideSelect.createEl("option", {
			value: "",
			text: "Create new preset",
		});
		newOption.value = "";

		// Add existing presets
		for (const preset of this.existingPresets) {
			const option = this.overrideSelect.createEl("option", {
				value: preset.id,
				text: `Override: ${preset.name}`,
			});
			option.value = preset.id;
		}

		// Update name field when override selection changes
		this.overrideSelect.addEventListener("change", () => {
			const selectedId = this.overrideSelect.value;
			if (selectedId) {
				const preset = this.existingPresets.find((p) => p.id === selectedId);
				if (preset) {
					this.nameInput.value = preset.name;
				}
			}
		});

		// Preset name input
		const inputContainer = contentEl.createDiv(cls("setting-item"));
		inputContainer.createEl("div", {
			text: "Preset name",
			cls: "setting-item-name",
		});
		this.nameInput = inputContainer.createEl("input", {
			type: "text",
			placeholder: "e.g., 30 min meeting, All-day event",
			cls: cls("setting-item-control"),
		});

		const buttonContainer = contentEl.createDiv(cls("modal-button-container"));

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const saveButton = buttonContainer.createEl("button", {
			text: "Save",
			cls: cls("mod-cta"),
		});
		saveButton.addEventListener("click", () => {
			this.handleSave();
		});

		// Handle Enter key
		contentEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.handleSave();
			}
		});

		this.nameInput.focus();
	}

	private handleSave(): void {
		const name = this.nameInput.value.trim();
		if (!name) {
			new Notice("Please enter a preset name");
			return;
		}

		const overridePresetId = this.overrideSelect.value || null;
		this.onSave(name, overridePresetId);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
