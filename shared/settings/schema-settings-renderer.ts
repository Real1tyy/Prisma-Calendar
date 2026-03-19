import type { App } from "obsidian";
import { Setting } from "obsidian";
import type { z, ZodObject, ZodRawShape } from "zod";

import { SettingsNavigation } from "../components/settings-navigation";
import { camelCaseToLabel, introspectShape } from "../schema-modal/introspect";
import type {
	ArrayFieldDescriptor,
	EnumFieldDescriptor,
	NumberFieldDescriptor,
	SchemaFieldDescriptor,
} from "../schema-modal/types";
import type {
	ArrayFieldOverride,
	DropdownFieldOverride,
	NumberFieldOverride,
	SchemaSettingsConfig,
	SchemaSettingsFieldOverride,
	SchemaSettingsGroup,
	SchemaSettingsSection,
	SchemaSettingsSectionOverride,
	TextFieldOverride,
} from "./schema-settings-types";
import type { SettingsStore } from "./settings-store";
import { SettingsUIBuilder } from "./settings-ui-builder";

function buildFieldKey(keyPrefix: string, fieldKey: string): string {
	return `${keyPrefix}.${fieldKey}`;
}

function resolveFieldName(descriptor: SchemaFieldDescriptor, override?: SchemaSettingsFieldOverride): string {
	return override?.name ?? camelCaseToLabel(descriptor.key);
}

function resolveFieldDesc(descriptor: SchemaFieldDescriptor, override?: SchemaSettingsFieldOverride): string {
	return override?.desc ?? descriptor.description ?? "";
}

function getNestedValue(settings: Record<string, unknown>, key: string): unknown {
	const keys = key.split(".");
	let value: unknown = settings;
	for (const k of keys) {
		if (value === undefined || value === null) return undefined;
		value = (value as Record<string, unknown>)[k];
	}
	return value;
}

function isOverrideType<T extends SchemaSettingsFieldOverride>(
	override: SchemaSettingsFieldOverride | undefined,
	type: string
): override is T {
	return override !== undefined && "type" in override && override.type === type;
}

function renderFieldFromDescriptor(
	containerEl: HTMLElement,
	descriptor: SchemaFieldDescriptor,
	prefixedKey: string,
	override: SchemaSettingsFieldOverride | undefined,
	uiBuilder: SettingsUIBuilder<ZodObject<ZodRawShape>>,
	settingsStore?: SettingsStore<ZodObject<ZodRawShape>>
): void {
	if (override?.render && settingsStore) {
		const value = getNestedValue(settingsStore.currentSettings, prefixedKey);
		override.render(containerEl, value, (v) => {
			void settingsStore.updateSettings((current) => {
				const clone = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;
				const keys = prefixedKey.split(".");
				let target: Record<string, unknown> = clone;
				for (let i = 0; i < keys.length - 1; i++) {
					target = target[keys[i]] as Record<string, unknown>;
				}
				target[keys[keys.length - 1]] = v;
				return clone;
			});
		});
		return;
	}

	const name = resolveFieldName(descriptor, override);
	const desc = resolveFieldDesc(descriptor, override);
	const baseConfig = {
		key: prefixedKey,
		name,
		desc,
		...(override?.onChanged !== undefined ? { onChanged: override.onChanged } : {}),
	};

	if (isOverrideType<DropdownFieldOverride>(override, "dropdown")) {
		uiBuilder.addDropdown(containerEl, { ...baseConfig, options: override.options });
		return;
	}

	switch (descriptor.type) {
		case "boolean":
		case "toggle":
			uiBuilder.addToggle(containerEl, baseConfig);
			break;
		case "number":
			renderNumberSetting(containerEl, descriptor, baseConfig, override, uiBuilder);
			break;
		case "enum":
			renderEnumSetting(containerEl, descriptor, baseConfig, override, uiBuilder);
			break;
		case "string":
			renderStringSetting(containerEl, baseConfig, override, uiBuilder);
			break;
		case "array":
			renderArraySetting(containerEl, descriptor, baseConfig, override, uiBuilder);
			break;
		case "date":
		case "datetime": {
			const textOverride = isOverrideType<TextFieldOverride>(override, "text") ? override : undefined;
			uiBuilder.addText(containerEl, {
				...baseConfig,
				placeholder: textOverride?.placeholder ?? (descriptor.type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DDTHH:mm"),
			});
			break;
		}
	}
}

function renderStringSetting(
	containerEl: HTMLElement,
	baseConfig: { key: string; name: string; desc: string },
	override: SchemaSettingsFieldOverride | undefined,
	uiBuilder: SettingsUIBuilder<ZodObject<ZodRawShape>>
): void {
	const textOverride = isOverrideType<TextFieldOverride>(override, "text") ? override : undefined;
	uiBuilder.addText(containerEl, {
		...baseConfig,
		...(textOverride?.placeholder !== undefined ? { placeholder: textOverride.placeholder } : {}),
		...(textOverride?.commitOnChange !== undefined ? { commitOnChange: textOverride.commitOnChange } : {}),
	});
}

function renderNumberSetting(
	containerEl: HTMLElement,
	descriptor: NumberFieldDescriptor,
	baseConfig: { key: string; name: string; desc: string },
	override: SchemaSettingsFieldOverride | undefined,
	uiBuilder: SettingsUIBuilder<ZodObject<ZodRawShape>>
): void {
	const numberOverride = isOverrideType<NumberFieldOverride>(override, "number") ? override : undefined;
	const min = numberOverride?.min ?? descriptor.min;
	const max = numberOverride?.max ?? descriptor.max;
	const step = numberOverride?.step;
	const hasBounds = min !== undefined && max !== undefined;

	if (hasBounds) {
		uiBuilder.addSlider(containerEl, {
			...baseConfig,
			min,
			max,
			...(step !== undefined ? { step } : {}),
		});
	} else {
		uiBuilder.addNumberInput(containerEl, {
			...baseConfig,
			...(min !== undefined ? { min } : {}),
			...(max !== undefined ? { max } : {}),
			...(step !== undefined ? { step } : {}),
		});
	}
}

function renderEnumSetting(
	containerEl: HTMLElement,
	descriptor: EnumFieldDescriptor,
	baseConfig: { key: string; name: string; desc: string },
	override: SchemaSettingsFieldOverride | undefined,
	uiBuilder: SettingsUIBuilder<ZodObject<ZodRawShape>>
): void {
	const dropdownOverride = isOverrideType<DropdownFieldOverride>(override, "dropdown") ? override : undefined;
	const options =
		dropdownOverride?.options ?? Object.fromEntries(descriptor.enumValues.map((v) => [v, camelCaseToLabel(v)]));
	uiBuilder.addDropdown(containerEl, { ...baseConfig, options });
}

function renderArraySetting(
	containerEl: HTMLElement,
	descriptor: ArrayFieldDescriptor,
	baseConfig: { key: string; name: string; desc: string },
	override: SchemaSettingsFieldOverride | undefined,
	uiBuilder: SettingsUIBuilder<ZodObject<ZodRawShape>>
): void {
	const arrayOverride = isOverrideType<ArrayFieldOverride>(override, "array") ? override : undefined;
	uiBuilder.addTextArray(containerEl, {
		...baseConfig,
		...(arrayOverride?.placeholder !== undefined ? { placeholder: arrayOverride.placeholder } : {}),
		itemType: descriptor.itemType,
	});
}

function orderDescriptors(descriptors: SchemaFieldDescriptor[], fieldOrder?: string[]): SchemaFieldDescriptor[] {
	if (!fieldOrder) return descriptors;

	const descriptorMap = new Map(descriptors.map((d) => [d.key, d]));
	const ordered: SchemaFieldDescriptor[] = [];

	for (const key of fieldOrder) {
		const desc = descriptorMap.get(key);
		if (desc) {
			ordered.push(desc);
			descriptorMap.delete(key);
		}
	}

	for (const desc of descriptorMap.values()) {
		ordered.push(desc);
	}

	return ordered;
}

function renderGroupedFields(
	containerEl: HTMLElement,
	descriptors: SchemaFieldDescriptor[],
	groups: SchemaSettingsGroup[],
	keyPrefix: string,
	overrides: Record<string, SchemaSettingsFieldOverride>,
	uiBuilder: SettingsUIBuilder<ZodObject<ZodRawShape>>,
	settingsStore: SettingsStore<ZodObject<ZodRawShape>>
): void {
	const assignedFields = new Set(groups.flatMap((g) => g.fields));
	const descriptorMap = new Map(descriptors.map((d) => [d.key, d]));

	for (const group of groups) {
		new Setting(containerEl).setName(group.heading).setHeading();
		if (group.desc) {
			containerEl.createEl("p", { text: group.desc, cls: "setting-item-description" });
		}

		for (const fieldKey of group.fields) {
			const descriptor = descriptorMap.get(fieldKey);
			if (!descriptor) continue;
			const override = overrides[fieldKey];
			if (override?.hidden) continue;
			renderFieldFromDescriptor(
				containerEl,
				descriptor,
				buildFieldKey(keyPrefix, fieldKey),
				override,
				uiBuilder,
				settingsStore
			);
		}
	}

	const ungrouped = descriptors.filter((d) => !assignedFields.has(d.key));
	for (const descriptor of ungrouped) {
		const override = overrides[descriptor.key];
		if (override?.hidden) continue;
		renderFieldFromDescriptor(
			containerEl,
			descriptor,
			buildFieldKey(keyPrefix, descriptor.key),
			override,
			uiBuilder,
			settingsStore
		);
	}
}

function renderFlatFields(
	containerEl: HTMLElement,
	descriptors: SchemaFieldDescriptor[],
	keyPrefix: string,
	overrides: Record<string, SchemaSettingsFieldOverride>,
	uiBuilder: SettingsUIBuilder<ZodObject<ZodRawShape>>,
	settingsStore: SettingsStore<ZodObject<ZodRawShape>>
): void {
	for (const descriptor of descriptors) {
		const override = overrides[descriptor.key];
		if (override?.hidden) continue;
		renderFieldFromDescriptor(
			containerEl,
			descriptor,
			buildFieldKey(keyPrefix, descriptor.key),
			override,
			uiBuilder,
			settingsStore
		);
	}
}

export function renderSchemaSection<TSchema extends ZodObject<ZodRawShape>>(
	containerEl: HTMLElement,
	sectionSchema: ZodObject<ZodRawShape> | z.ZodTypeAny,
	settingsStore: SettingsStore<TSchema>,
	keyPrefix: string,
	sectionConfig: SchemaSettingsSection,
	app?: App
): void {
	const unwrapped = "shape" in sectionSchema ? sectionSchema : unwrapToObject(sectionSchema);
	if (!unwrapped) return;

	const store = settingsStore as unknown as SettingsStore<ZodObject<ZodRawShape>>;
	const uiBuilder = new SettingsUIBuilder(store, app);
	const descriptors = introspectShape(unwrapped.shape);
	const overrides = sectionConfig.overrides ?? {};

	sectionConfig.before?.(containerEl);

	const ordered = orderDescriptors(descriptors, sectionConfig.fieldOrder);

	if (sectionConfig.groups) {
		renderGroupedFields(containerEl, ordered, sectionConfig.groups, keyPrefix, overrides, uiBuilder, store);
	} else {
		renderFlatFields(containerEl, ordered, keyPrefix, overrides, uiBuilder, store);
	}

	sectionConfig.after?.(containerEl);
}

function deriveAutoSections(
	rootShape: ZodRawShape,
	exclude: string[],
	sectionOverrides: Record<string, SchemaSettingsSectionOverride>
): SchemaSettingsSection[] {
	const excludeSet = new Set(exclude);

	return Object.entries(rootShape)
		.filter(([key, schema]) => !excludeSet.has(key) && unwrapToObject(schema as z.ZodTypeAny) !== undefined)
		.map(([key]) => {
			const override = sectionOverrides[key];
			return {
				id: key,
				label: override?.label ?? camelCaseToLabel(key),
				schema: key,
				...override,
			};
		});
}

export function renderSchemaSettings<TSchema extends ZodObject<ZodRawShape>>(
	config: SchemaSettingsConfig<TSchema>
): SettingsNavigation {
	const { containerEl, settingsStore, cssPrefix, app, footerLinks } = config;
	const rootShape = settingsStore.validationSchema.shape;

	const sections =
		config.sections ?? deriveAutoSections(rootShape, config.exclude ?? [], config.sectionOverrides ?? {});

	const navSections = sections.map((sectionConfig) => {
		const sectionSchema = rootShape[sectionConfig.schema] as z.ZodTypeAny | undefined;

		return {
			id: sectionConfig.id,
			label: sectionConfig.label,
			display(el: HTMLElement) {
				if (!sectionSchema) return;
				renderSchemaSection(el, sectionSchema, settingsStore, sectionConfig.schema, sectionConfig, app);
			},
			...(sectionConfig.hide !== undefined ? { hide: sectionConfig.hide } : {}),
		};
	});

	const navigation = new SettingsNavigation({
		cssPrefix,
		sections: navSections,
		...(footerLinks !== undefined ? { footerLinks } : {}),
	});
	navigation.display(containerEl);
	return navigation;
}

function unwrapToObject(schema: z.ZodTypeAny): ZodObject<ZodRawShape> | undefined {
	if ("shape" in schema) {
		return schema as ZodObject<ZodRawShape>;
	}

	const def = schema._def as unknown as Record<string, unknown>;
	if ("innerType" in def && def["innerType"]) {
		return unwrapToObject(def["innerType"] as z.ZodTypeAny);
	}

	return undefined;
}
