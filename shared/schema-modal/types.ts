import type { App } from "obsidian";
import type { z, ZodRawShape } from "zod";

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

export type FieldOptions =
	| Record<string, string>
	| [value: string, label: string][]
	| { value: string; label: string }[];

export interface FieldOverride {
	label?: string;
	hidden?: boolean;
	placeholder?: string;
	options?: FieldOptions;
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

// ─── Schema Form Renderer (container-agnostic) ──────────────

export type SchemaFormMode = "edit" | "readonly";

export interface SchemaFormConfig<T> {
	shape: ZodRawShape;
	prefix: string;
	mode?: SchemaFormMode | undefined;
	fieldOverrides?: Record<string, FieldOverride> | undefined;
	existing?: Partial<T> | undefined;
	extraFields?: ((el: HTMLElement, values: Record<string, unknown>) => void) | undefined;
}

export interface SchemaFormValidationSuccess<T> {
	success: true;
	data: T;
}

export interface SchemaFormValidationFailure {
	success: false;
	errors: string[];
}

export type SchemaFormValidationResult<T> = SchemaFormValidationSuccess<T> | SchemaFormValidationFailure;

export interface SchemaFormHandle<T> {
	getValues: () => Record<string, unknown>;
	validate: () => SchemaFormValidationResult<T>;
	setMode: (mode: SchemaFormMode) => void;
	setValues: (partial: Partial<Record<string, unknown>>) => void;
	destroy: () => void;
}

// ─── Schema Form Modal (modal wrapper) ──────────────────────

export interface SchemaFormModalConfig<S extends ZodRawShape = ZodRawShape> {
	app: App;
	prefix: string;
	title?: string | undefined;
	cls?: string | undefined;
	shape: S;
	mode?: SchemaFormMode | undefined;
	fieldOverrides?: Record<string, FieldOverride> | undefined;
	existing?: Partial<z.infer<z.ZodObject<S>>> | undefined;
	extraFields?: ((el: HTMLElement, values: Record<string, unknown>) => void) | undefined;
	submitText?: string | undefined;
	onSubmit: (values: z.infer<z.ZodObject<S>>) => void | Promise<void>;
	nameField?: boolean | { placeholder?: string } | undefined;
}

// ─── Modal Helpers ──────────────────────────────────────────

export interface ModalButtonOptions {
	prefix: string;
	submitText: string;
	submitCls?: string;
	onSubmit: () => void;
	onCancel: () => void;
}
