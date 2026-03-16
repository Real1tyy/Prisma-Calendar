import { Notice, Setting } from "obsidian";
import { z } from "zod";

import type { ComponentContext } from "../component-renderer/types";
import { introspectShape } from "./introspect";
import type {
	ArrayFieldDescriptor,
	EnumFieldDescriptor,
	FieldOverride,
	NumberFieldDescriptor,
	SchemaFieldDescriptor,
	SchemaModalConfig,
	UpsertHandler,
} from "./types";

function initValues<T>(
	descriptors: SchemaFieldDescriptor[],
	overrides: Record<string, FieldOverride>,
	existing?: Partial<T>
): Record<string, unknown> {
	const values: Record<string, unknown> = {};
	for (const desc of descriptors) {
		const override = overrides[desc.key];
		const existingVal = (existing as Record<string, unknown> | undefined)?.[desc.key];

		if (existingVal !== undefined) {
			values[desc.key] = existingVal;
		} else if (override?.defaultValue !== undefined) {
			values[desc.key] = override.defaultValue;
		} else if (desc.defaultValue !== undefined) {
			values[desc.key] = desc.defaultValue;
		} else {
			values[desc.key] = getFieldDefault(desc);
		}
	}
	return values;
}

function getFieldDefault(desc: SchemaFieldDescriptor): unknown {
	switch (desc.type) {
		case "boolean":
		case "toggle":
			return false;
		case "number":
			return undefined;
		case "array":
			return [];
		default:
			return "";
	}
}

function coerceToggleValue(val: unknown): boolean {
	if (typeof val === "boolean") return val;
	if (val === "true") return true;
	if (val === "false" || val === "") return false;
	return Boolean(val);
}

function renderNameField(el: HTMLElement, nameRef: { value: string }, config: SchemaModalConfig<unknown>): void {
	const placeholder = typeof config.nameField === "object" ? (config.nameField.placeholder ?? "Name") : "Name";

	new Setting(el).setName("Name").addText((text) => {
		text.setPlaceholder(placeholder).setValue(nameRef.value);
		text.onChange((v) => (nameRef.value = v.trim()));
	});
}

function renderStringField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	if (override?.options) {
		renderDropdownField(el, desc, Object.entries(override.options), values);
		return;
	}

	new Setting(el).setName(override?.label ?? desc.label).addText((text) => {
		text.setPlaceholder(override?.placeholder ?? "").setValue(String(values[desc.key] ?? ""));
		text.onChange((v) => (values[desc.key] = v));
	});
}

function renderNumberField(
	el: HTMLElement,
	desc: NumberFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	const label = override?.label ?? desc.label;
	const parts: string[] = [label];
	if (desc.min !== undefined && desc.max !== undefined) {
		parts.push(`(${desc.min}-${desc.max})`);
	}

	new Setting(el).setName(parts.join(" ")).addText((text) => {
		text
			.setPlaceholder(override?.placeholder ?? "0")
			.setValue(values[desc.key] != null ? String(values[desc.key]) : "");
		text.inputEl.type = "number";
		if (desc.min !== undefined) text.inputEl.min = String(desc.min);
		if (desc.max !== undefined) text.inputEl.max = String(desc.max);
		text.onChange((v) => (values[desc.key] = v));
	});
}

function renderBooleanField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	new Setting(el).setName(override?.label ?? desc.label).addToggle((toggle) => {
		toggle.setValue(coerceToggleValue(values[desc.key]));
		toggle.onChange((v) => (values[desc.key] = v));
	});
}

function renderDateField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	new Setting(el).setName(override?.label ?? desc.label).addText((text) => {
		text.setPlaceholder(override?.placeholder ?? "YYYY-MM-DD").setValue(String(values[desc.key] ?? ""));
		text.inputEl.type = "date";
		text.onChange((v) => (values[desc.key] = v));
	});
}

function renderDatetimeField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	new Setting(el).setName(override?.label ?? desc.label).addText((text) => {
		text.setPlaceholder(override?.placeholder ?? "YYYY-MM-DDTHH:mm").setValue(String(values[desc.key] ?? ""));
		text.inputEl.type = "datetime-local";
		text.onChange((v) => (values[desc.key] = v));
	});
}

function renderEnumField(
	el: HTMLElement,
	desc: EnumFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	const entries: [string, string][] = override?.options
		? Object.entries(override.options)
		: desc.enumValues.map((v) => [v, v]);

	renderDropdownField(el, desc, entries, values, override);
}

function renderDropdownField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	entries: [string, string][],
	values: Record<string, unknown>,
	override?: FieldOverride
): void {
	new Setting(el).setName(override?.label ?? desc.label).addDropdown((dropdown) => {
		if (desc.optional) dropdown.addOption("", "-- None --");
		for (const [value, label] of entries) {
			dropdown.addOption(value, label);
		}
		dropdown.setValue(String(values[desc.key] ?? ""));
		dropdown.onChange((v) => (values[desc.key] = v));
	});
}

function renderArrayField(
	el: HTMLElement,
	desc: ArrayFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	const label = override?.label ?? desc.label;
	const current = Array.isArray(values[desc.key]) ? (values[desc.key] as unknown[]) : [];

	new Setting(el).setName(label).addText((text) => {
		text.setPlaceholder(override?.placeholder ?? "Comma-separated values").setValue(current.join(", "));
		text.onChange((v) => {
			const items = v
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			values[desc.key] = desc.itemType === "number" ? items.map(Number).filter((n) => !Number.isNaN(n)) : items;
		});
	});
}

function renderField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	if (override?.render) {
		override.render(el, values[desc.key], (v) => (values[desc.key] = v));
		return;
	}

	switch (desc.type) {
		case "string":
			renderStringField(el, desc, override, values);
			break;
		case "number":
			renderNumberField(el, desc, override, values);
			break;
		case "boolean":
		case "toggle":
			renderBooleanField(el, desc, override, values);
			break;
		case "date":
			renderDateField(el, desc, override, values);
			break;
		case "datetime":
			renderDatetimeField(el, desc, override, values);
			break;
		case "enum":
			renderEnumField(el, desc, override, values);
			break;
		case "array":
			renderArrayField(el, desc, override, values);
			break;
	}
}

function coerceFormValues(
	values: Record<string, unknown>,
	descriptors: SchemaFieldDescriptor[]
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const desc of descriptors) {
		const raw = values[desc.key];
		switch (desc.type) {
			case "number":
				result[desc.key] = raw !== "" && raw != null ? Number(raw) : undefined;
				break;
			case "boolean":
			case "toggle":
				result[desc.key] = coerceToggleValue(raw);
				break;
			case "array":
				if (Array.isArray(raw)) {
					result[desc.key] =
						desc.itemType === "number" ? raw.map(Number).filter((n) => !Number.isNaN(n)) : raw.map(String);
				} else {
					result[desc.key] = [];
				}
				break;
			default:
				result[desc.key] = raw === "" ? undefined : raw;
		}
	}
	return result;
}

async function executeUpsert<T>(upsert: UpsertHandler<T>, isEdit: boolean, name: string, values: T): Promise<void> {
	try {
		if (isEdit) {
			await upsert.update(name, values);
			new Notice(`${upsert.entityName} "${name}" updated.`);
		} else {
			await upsert.create(name, values);
			new Notice(`${upsert.entityName} "${name}" created.`);
		}
	} catch (error) {
		new Notice(`Error: ${error}`);
	}
}

function resolveSubmitAction<T>(config: SchemaModalConfig<T>, name: string, values: T): Promise<void> {
	if (config.upsert) {
		return executeUpsert(config.upsert, !!config.existing, name, values);
	}
	return Promise.resolve(config.onSubmit!(name, values));
}

export function createSchemaFormRenderer<T>(config: SchemaModalConfig<T>) {
	const overrides = config.fieldOverrides ?? {};
	const descriptors = introspectShape(config.shape);
	const values = initValues<T>(descriptors, overrides, config.existing?.data);
	const nameRef = { value: "" };

	return (el: HTMLElement, ctx: ComponentContext): void => {
		if (config.nameField && !config.existing) {
			renderNameField(el, nameRef, config as SchemaModalConfig<unknown>);
		}

		for (const desc of descriptors) {
			const override = overrides[desc.key];
			if (override?.hidden) continue;
			renderField(el, desc, override, values);
		}

		config.extraFields?.(el, values, ctx);

		new Setting(el)
			.addButton((btn) => {
				btn
					.setButtonText("Save")
					.setCta()
					.onClick(() => {
						if (config.nameField && !config.existing && !nameRef.value) {
							new Notice("Name is required.");
							return;
						}

						const coerced = coerceFormValues(values, descriptors);
						const schema = z.object(config.shape);
						const result = schema.safeParse(coerced);

						if (!result.success) {
							const errors = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
							new Notice(`Validation failed: ${errors}`, 5000);
							return;
						}

						const name = config.existing?.id ?? nameRef.value;
						const submitAction = resolveSubmitAction(config, name, result.data as T);
						void submitAction.then(() => ctx.close());
					});
			})
			.addButton((btn) => {
				btn.setButtonText("Cancel").onClick(() => ctx.close());
			});
	};
}
