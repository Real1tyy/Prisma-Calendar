import type { App } from "obsidian";
import type { ZodRawShape } from "zod";

import type { ComponentContext } from "../component-renderer/types";

interface BaseFieldDescriptor {
	key: string;
	label: string;
	optional: boolean;
	defaultValue?: unknown;
}

export interface StringFieldDescriptor extends BaseFieldDescriptor {
	type: "string";
}

export interface NumberFieldDescriptor extends BaseFieldDescriptor {
	type: "number";
	min?: number;
	max?: number;
}

export interface BooleanFieldDescriptor extends BaseFieldDescriptor {
	type: "boolean";
}

export interface DateFieldDescriptor extends BaseFieldDescriptor {
	type: "date";
}

export interface DatetimeFieldDescriptor extends BaseFieldDescriptor {
	type: "datetime";
}

export interface EnumFieldDescriptor extends BaseFieldDescriptor {
	type: "enum";
	enumValues: string[];
}

export interface ToggleFieldDescriptor extends BaseFieldDescriptor {
	type: "toggle";
}

export interface ArrayFieldDescriptor extends BaseFieldDescriptor {
	type: "array";
	itemType: "string" | "number";
}

export type SchemaFieldDescriptor =
	| StringFieldDescriptor
	| NumberFieldDescriptor
	| BooleanFieldDescriptor
	| DateFieldDescriptor
	| DatetimeFieldDescriptor
	| EnumFieldDescriptor
	| ToggleFieldDescriptor
	| ArrayFieldDescriptor;

export type SchemaFieldType = SchemaFieldDescriptor["type"];

export interface FieldOverride {
	label?: string;
	hidden?: boolean;
	placeholder?: string;
	options?: Record<string, string>;
	render?: (el: HTMLElement, value: unknown, onChange: (v: unknown) => void) => void;
	defaultValue?: unknown;
}

export interface UpsertHandler<T> {
	create: (name: string, values: T) => unknown | Promise<unknown>;
	update: (name: string, values: T) => unknown | Promise<unknown>;
	entityName: string;
}

interface SchemaModalConfigBase<T> {
	app: App;
	cls: string;
	title: string;
	shape: ZodRawShape;
	fieldOverrides?: Record<string, FieldOverride>;
	extraFields?: (el: HTMLElement, values: Record<string, unknown>, ctx: ComponentContext) => void;
	existing?: { id: string; data: Partial<T> };
	nameField?: boolean | { placeholder?: string };
}

interface SchemaModalWithSubmit<T> extends SchemaModalConfigBase<T> {
	onSubmit: (name: string, values: T) => void | Promise<void>;
	upsert?: never;
}

interface SchemaModalWithUpsert<T> extends SchemaModalConfigBase<T> {
	upsert: UpsertHandler<T>;
	onSubmit?: never;
}

export type SchemaModalConfig<T> = SchemaModalWithSubmit<T> | SchemaModalWithUpsert<T>;
