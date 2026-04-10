import { type App, SecretComponent, Setting } from "obsidian";
import { z } from "zod";

import { introspectShape } from "./introspect";
import type {
	ArrayFieldDescriptor,
	EnumFieldDescriptor,
	FieldOptions,
	FieldOverride,
	NumberFieldDescriptor,
	SchemaFieldDescriptor,
	SchemaFormConfig,
	SchemaFormHandle,
	SchemaFormMode,
	SchemaFormValidationResult,
} from "./types";

function normalizeOptions(options: FieldOptions): [string, string][] {
	if (Array.isArray(options)) {
		return options.map((item) => (Array.isArray(item) ? item : [item.value, item.label]));
	}
	return Object.entries(options);
}

// ─── Value Initialization ───────────────────────────────────

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

// ─── Value Coercion ─────────────────────────────────────────

function coerceToggleValue(val: unknown): boolean {
	if (typeof val === "boolean") return val;
	if (val === "true") return true;
	if (val === "false" || val === "") return false;
	return Boolean(val);
}

export function coerceFormValues(
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
						(desc as ArrayFieldDescriptor).itemType === "number"
							? raw.map(Number).filter((n) => !Number.isNaN(n))
							: raw.map(String);
				} else {
					result[desc.key] = [];
				}
				break;
			default:
				result[desc.key] = raw === "" && desc.optional ? undefined : raw;
		}
	}
	return result;
}

// ─── Field Metadata Resolution ──────────────────────────────

function resolveLabel(desc: SchemaFieldDescriptor, override: FieldOverride | undefined): string {
	return override?.label ?? desc.label;
}

function resolveDesc(desc: SchemaFieldDescriptor, override: FieldOverride | undefined): string {
	return override?.desc ?? desc.description ?? "";
}

function applyFieldMeta(setting: Setting, desc: SchemaFieldDescriptor, override: FieldOverride | undefined): Setting {
	setting.setName(resolveLabel(desc, override));
	const fieldDesc = resolveDesc(desc, override);
	if (fieldDesc) setting.setDesc(fieldDesc);
	return setting;
}

// ─── Edit Mode Field Renderers ──────────────────────────────

function renderStringField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	if (override?.options) {
		renderDropdownField(el, desc, normalizeOptions(override.options), values);
		return;
	}

	applyFieldMeta(new Setting(el), desc, override).addText((text) => {
		text.setPlaceholder(override?.placeholder ?? desc.placeholder ?? "").setValue(String(values[desc.key] ?? ""));
		text.onChange((v) => (values[desc.key] = v));
	});
}

function renderNumberField(
	el: HTMLElement,
	desc: NumberFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	const label = resolveLabel(desc, override);
	const parts: string[] = [label];
	if (desc.min !== undefined && desc.max !== undefined) {
		parts.push(`(${desc.min}-${desc.max})`);
	}

	const setting = new Setting(el).setName(parts.join(" "));
	const fieldDesc = resolveDesc(desc, override);
	if (fieldDesc) setting.setDesc(fieldDesc);
	setting.addText((text) => {
		text
			.setPlaceholder(override?.placeholder ?? desc.placeholder ?? "0")
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
	applyFieldMeta(new Setting(el), desc, override).addToggle((toggle) => {
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
	applyFieldMeta(new Setting(el), desc, override).addText((text) => {
		text
			.setPlaceholder(override?.placeholder ?? desc.placeholder ?? "YYYY-MM-DD")
			.setValue(String(values[desc.key] ?? ""));
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
	applyFieldMeta(new Setting(el), desc, override).addText((text) => {
		text
			.setPlaceholder(override?.placeholder ?? desc.placeholder ?? "YYYY-MM-DDTHH:mm")
			.setValue(String(values[desc.key] ?? ""));
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
		? normalizeOptions(override.options)
		: desc.enumLabels
			? Object.entries(desc.enumLabels)
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
	applyFieldMeta(new Setting(el), desc, override).addDropdown((dropdown) => {
		if (desc.optional) dropdown.addOption("", "-- None --");
		for (const [value, label] of entries) {
			dropdown.addOption(value, label);
		}
		dropdown.setValue(String(values[desc.key] ?? ""));
		dropdown.onChange((v) => (values[desc.key] = v));
	});
}

function renderSecretField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>,
	app?: App
): void {
	if (!app) return;

	applyFieldMeta(new Setting(el), desc, override).addComponent((component) =>
		new SecretComponent(app, component).setValue(String(values[desc.key] ?? "")).onChange((v) => {
			values[desc.key] = v;
		})
	);
}

function renderArrayField(
	el: HTMLElement,
	desc: ArrayFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	const current = Array.isArray(values[desc.key]) ? (values[desc.key] as unknown[]) : [];

	applyFieldMeta(new Setting(el), desc, override).addText((text) => {
		text
			.setPlaceholder(override?.placeholder ?? desc.placeholder ?? "Comma-separated values")
			.setValue(current.join(", "));
		text.onChange((v) => {
			const items = v
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			values[desc.key] = desc.itemType === "number" ? items.map(Number).filter((n) => !Number.isNaN(n)) : items;
		});
	});
}

function renderEditField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>,
	app?: App
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
		case "secret":
			renderSecretField(el, desc, override, values, app);
			break;
	}
}

// ─── Readonly Mode Field Renderer ───────────────────────────

const SECRET_MASK = "••••••••";

function formatReadonlyValue(desc: SchemaFieldDescriptor, value: unknown): string {
	if (value === undefined || value === null || value === "") return "—";

	switch (desc.type) {
		case "boolean":
		case "toggle":
			return coerceToggleValue(value) ? "Yes" : "No";
		case "secret":
			return SECRET_MASK;
		case "array":
			return Array.isArray(value) ? value.join(", ") || "—" : String(value);
		default:
			return String(value);
	}
}

function renderReadonlyField(
	el: HTMLElement,
	desc: SchemaFieldDescriptor,
	override: FieldOverride | undefined,
	values: Record<string, unknown>
): void {
	const label = resolveLabel(desc, override);
	const value = formatReadonlyValue(desc, values[desc.key]);
	const setting = new Setting(el).setName(label);
	const fieldDesc = resolveDesc(desc, override);
	if (fieldDesc) {
		setting.setDesc(`${fieldDesc} — ${value}`);
	} else {
		setting.setDesc(value);
	}
}

// ─── Core: renderSchemaForm ─────────────────────────────────

function renderFields(
	container: HTMLElement,
	descriptors: SchemaFieldDescriptor[],
	overrides: Record<string, FieldOverride>,
	values: Record<string, unknown>,
	mode: SchemaFormMode,
	app?: App,
	extraFields?: (
		el: HTMLElement,
		values: Record<string, unknown>,
		setValues: (partial: Partial<Record<string, unknown>>) => void
	) => void,
	setValuesFn?: (partial: Partial<Record<string, unknown>>) => void
): void {
	for (const desc of descriptors) {
		const override = overrides[desc.key];
		if (override?.hidden) continue;
		if (mode === "readonly") {
			renderReadonlyField(container, desc, override, values);
		} else {
			renderEditField(container, desc, override, values, app);
		}
	}

	const noopSetValues = (partial: Partial<Record<string, unknown>>) => {
		for (const [key, val] of Object.entries(partial)) {
			if (val !== undefined) values[key] = val;
		}
	};
	extraFields?.(container, values, setValuesFn ?? noopSetValues);
}

export function renderSchemaForm<T>(container: HTMLElement, config: SchemaFormConfig<T>): SchemaFormHandle<T> {
	const overrides = config.fieldOverrides ?? {};
	const descriptors = introspectShape(config.shape);
	const values = initValues<T>(descriptors, overrides, config.existing);
	let currentMode: SchemaFormMode = config.mode ?? "edit";

	const formEl = container.createDiv();

	function setValues(partial: Partial<Record<string, unknown>>): void {
		for (const [key, val] of Object.entries(partial)) {
			if (val !== undefined) values[key] = val;
		}
		formEl.empty();
		renderFields(formEl, descriptors, overrides, values, currentMode, config.app, config.extraFields, setValues);
	}

	renderFields(formEl, descriptors, overrides, values, currentMode, config.app, config.extraFields, setValues);

	function validate(): SchemaFormValidationResult<T> {
		const coerced = coerceFormValues(values, descriptors);
		const schema = z.object(config.shape);
		const result = schema.safeParse(coerced);

		if (result.success) {
			return { success: true, data: result.data as T };
		}

		return {
			success: false,
			errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
		};
	}

	function setMode(mode: SchemaFormMode): void {
		currentMode = mode;
		formEl.empty();
		renderFields(formEl, descriptors, overrides, values, currentMode, config.app, config.extraFields, setValues);
	}

	function destroy(): void {
		formEl.empty();
	}

	return {
		getValues: () => ({ ...values }),
		validate,
		setMode,
		setValues,
		destroy,
	};
}
