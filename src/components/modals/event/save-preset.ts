import { addCls, cls, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Notice } from "obsidian";

import type { EventPreset } from "../../../types/settings";
import { createModalButtons, registerSubmitHotkey } from "../../../utils/dom-utils";

function renderSavePresetForm(
	el: HTMLElement,
	existingPresets: EventPreset[],
	blockCreateNew: boolean,
	onSave: (name: string, overridePresetId: string | null) => void,
	close: () => void
): void {
	el.createEl("h3", { text: "Save as preset" });

	const overrideContainer = el.createDiv(cls("setting-item"));
	overrideContainer.createEl("div", { text: "Save to", cls: "setting-item-name" });
	const overrideSelect = overrideContainer.createEl("select", { cls: cls("setting-item-dropdown") });

	const newOption = overrideSelect.createEl("option", {
		value: "",
		text: blockCreateNew ? "Create new preset (Pro)" : "Create new preset",
	});
	newOption.value = "";
	if (blockCreateNew) {
		newOption.disabled = true;
	}

	for (const preset of existingPresets) {
		const option = overrideSelect.createEl("option", {
			value: preset.id,
			text: `Override: ${preset.name}`,
		});
		option.value = preset.id;
	}

	if (blockCreateNew && existingPresets.length > 0) {
		overrideSelect.value = existingPresets[0].id;
	}

	const inputContainer = el.createDiv(cls("setting-item"));
	inputContainer.createEl("div", { text: "Preset name", cls: "setting-item-name" });
	const nameInput = inputContainer.createEl("input", {
		type: "text",
		placeholder: "e.g., 30 min meeting, All-day event",
		cls: cls("setting-item-control"),
	});

	if (blockCreateNew && existingPresets.length > 0) {
		nameInput.value = existingPresets[0].name;
	}

	overrideSelect.addEventListener("change", () => {
		const selectedId = overrideSelect.value;
		if (selectedId) {
			const preset = existingPresets.find((p) => p.id === selectedId);
			if (preset) {
				nameInput.value = preset.name;
			}
		}
	});

	function handleSave(): void {
		const name = nameInput.value.trim();
		if (!name) {
			new Notice("Please enter a preset name");
			return;
		}
		const overridePresetId = overrideSelect.value || null;
		onSave(name, overridePresetId);
		close();
	}

	createModalButtons(el, {
		submitText: "Save",
		onSubmit: handleSave,
		onCancel: close,
	});

	nameInput.focus();
}

export function showSavePresetModal(
	app: App,
	existingPresets: EventPreset[],
	blockCreateNew: boolean,
	onSave: (name: string, overridePresetId: string | null) => void
): void {
	showModal({
		app,
		cls: cls("save-preset-modal"),
		render: (el, ctx) => {
			renderSavePresetForm(el, existingPresets, blockCreateNew, onSave, ctx.close);
			if (ctx.type === "modal") {
				addCls(ctx.modalEl, "save-preset-modal");
				registerSubmitHotkey(ctx.scope, () => {
					const nameInput = el.querySelector<HTMLInputElement>("input[type='text']");
					const name = nameInput?.value.trim();
					if (!name) {
						new Notice("Please enter a preset name");
						return;
					}
					const overrideSelect = el.querySelector<HTMLSelectElement>("select");
					const overridePresetId = overrideSelect?.value || null;
					onSave(name, overridePresetId);
					ctx.close();
				});
			}
		},
	});
}
