import { addCls, cls, registerSubmitHotkey, removeCls, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { createModalButtons } from "../../../utils/dom-utils";
import { getAllFrontmatterProperties } from "../../../utils/event-frontmatter";

interface FrontmatterProperty {
	key: string;
	value: string;
	isExisting: boolean;
	markedForDeletion: boolean;
	originalKey: string;
	originalValue: string;
}

function buildPropertyMap(properties: FrontmatterProperty[]): Map<string, string | null> {
	const propertyMap = new Map<string, string | null>();

	for (const property of properties) {
		const key = property.key.trim();
		if (!key) continue;

		if (property.markedForDeletion) {
			propertyMap.set(key, null);
		} else if (property.isExisting) {
			const value = property.value.trim();
			const keyChanged = key !== property.originalKey;
			const valueChanged = value !== property.originalValue.trim();

			if (keyChanged || valueChanged) {
				if (keyChanged && property.originalKey.trim()) {
					propertyMap.set(property.originalKey.trim(), null);
				}
				if (value) {
					propertyMap.set(key, value);
				}
			}
		} else {
			const value = property.value.trim();
			if (value) {
				propertyMap.set(key, value);
			}
		}
	}

	return propertyMap;
}

function renderBatchFrontmatterForm(
	el: HTMLElement,
	app: App,
	settings: SingleCalendarConfig,
	selectedEvents: CalendarEvent[],
	onSubmit: (properties: Map<string, string | null>) => void,
	close: () => void
): void {
	const properties: FrontmatterProperty[] = [];

	el.createEl("h2", { text: "Batch frontmatter management" });

	const description = el.createEl("p", {
		text: "Add, update, or delete frontmatter properties across all selected events.",
	});
	addCls(description, "setting-item-description");

	const headerContainer = el.createDiv(cls("setting-item"));
	const headerDiv = headerContainer.createDiv(cls("setting-item-name"));
	headerDiv.createEl("div", { text: "Properties", cls: cls("setting-item-heading") });

	const addButton = headerContainer.createEl("button", { text: "Add property", cls: cls("mod-cta") });
	addButton.addEventListener("click", () => addProperty("", "", false));

	const columnHeaderRow = el.createDiv(cls("batch-frontmatter-header-row"));
	columnHeaderRow.createEl("div", { text: "Property name", cls: cls("batch-frontmatter-header-label") });
	columnHeaderRow.createEl("div", { text: "Value", cls: cls("batch-frontmatter-header-label") });

	const propertiesContainer = el.createDiv(cls("batch-frontmatter-container"));

	function addProperty(key = "", value = "", isExisting = false): void {
		const propertyRow = propertiesContainer.createDiv(cls("batch-frontmatter-row"));
		if (isExisting) addCls(propertyRow, "batch-frontmatter-existing");

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

		const removeButton = propertyRow.createEl("button", { text: "✕" });
		addCls(removeButton, "batch-frontmatter-remove-button");

		const property: FrontmatterProperty = {
			key,
			value,
			isExisting,
			markedForDeletion: false,
			originalKey: key,
			originalValue: value,
		};

		properties.push(property);

		removeButton.addEventListener("click", () => {
			if (isExisting) {
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
				const index = properties.indexOf(property);
				if (index !== -1) properties.splice(index, 1);
				propertyRow.remove();
			}
		});

		keyInput.addEventListener("input", () => (property.key = keyInput.value));
		valueInput.addEventListener("input", () => (property.value = valueInput.value));
	}

	function applyChanges(): void {
		const propertyMap = buildPropertyMap(properties);
		onSubmit(propertyMap);
		close();
	}

	createModalButtons(el, {
		submitText: "Apply changes",
		onSubmit: applyChanges,
		onCancel: close,
	});

	const existingProperties = getAllFrontmatterProperties(app, selectedEvents, settings);
	if (existingProperties.size === 0) {
		addProperty("", "", false);
	} else {
		for (const [k, v] of existingProperties.entries()) {
			addProperty(k, v, true);
		}
		addProperty("", "", false);
	}
}

export function showBatchFrontmatterModal(
	app: App,
	settings: SingleCalendarConfig,
	selectedEvents: CalendarEvent[],
	onSubmit: (properties: Map<string, string | null>) => void
): void {
	showModal({
		app,
		cls: cls("batch-frontmatter-modal"),
		render: (el, ctx) => {
			renderBatchFrontmatterForm(el, app, settings, selectedEvents, onSubmit, ctx.close);
			if (ctx.type === "modal") {
				registerSubmitHotkey(ctx.scope, () => {
					const propertyMap = buildPropertyMap(
						Array.from(el.querySelectorAll(`.${cls("batch-frontmatter-row")}`)).map(() => ({
							key: "",
							value: "",
							isExisting: false,
							markedForDeletion: false,
							originalKey: "",
							originalValue: "",
						}))
					);
					onSubmit(propertyMap);
					ctx.close();
				});
			}
		},
	});
}
