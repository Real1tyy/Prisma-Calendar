import type { App } from "obsidian";
import type { ZodObject, ZodRawShape } from "zod";

import type { SettingsFooterLink } from "../components/settings-navigation";
import type { SettingsStore } from "./settings-store";

interface BaseFieldOverride {
	label?: string;
	desc?: string;
	hidden?: boolean;
	render?: (el: HTMLElement, value: unknown, onChange: (v: unknown) => void) => void;
	onChanged?: () => void;
}

export interface ToggleFieldOverride extends BaseFieldOverride {
	type: "toggle";
}

export interface TextFieldOverride extends BaseFieldOverride {
	type: "text";
	placeholder?: string;
	commitOnChange?: boolean;
}

export interface NumberFieldOverride extends BaseFieldOverride {
	type: "number";
	min?: number;
	max?: number;
	step?: number;
}

export interface DropdownFieldOverride extends BaseFieldOverride {
	type: "dropdown";
	options: Record<string, string>;
}

export interface ArrayFieldOverride extends BaseFieldOverride {
	type: "array";
	placeholder?: string;
}

export interface CustomFieldOverride extends BaseFieldOverride {
	type: "custom";
	render: (el: HTMLElement, value: unknown, onChange: (v: unknown) => void) => void;
}

export type SchemaSettingsFieldOverride =
	| ToggleFieldOverride
	| TextFieldOverride
	| NumberFieldOverride
	| DropdownFieldOverride
	| ArrayFieldOverride
	| CustomFieldOverride
	| BaseFieldOverride;

export interface SchemaSettingsGroup {
	heading: string;
	desc?: string;
	fields: string[];
}

export interface SchemaSettingsSection {
	id: string;
	label: string;
	schema: string;
	overrides?: Record<string, SchemaSettingsFieldOverride>;
	groups?: SchemaSettingsGroup[];
	fieldOrder?: string[];
	before?: (el: HTMLElement) => void;
	after?: (el: HTMLElement) => void;
	hide?: () => void;
}

export type SchemaSettingsSectionOverride = Partial<
	Pick<SchemaSettingsSection, "overrides" | "groups" | "fieldOrder" | "before" | "after" | "hide" | "label">
>;

export interface SchemaSettingsConfig<TSchema extends ZodObject<ZodRawShape>> {
	containerEl: HTMLElement;
	settingsStore: SettingsStore<TSchema>;
	cssPrefix: string;
	app?: App;
	sections?: SchemaSettingsSection[];
	sectionOverrides?: Record<string, SchemaSettingsSectionOverride>;
	exclude?: string[];
	footerLinks?: SettingsFooterLink[];
}
