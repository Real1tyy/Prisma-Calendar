import type { SchemaFieldDescriptor } from "../../../components/schema-modal/types";
import type { SchemaFieldBinding } from "../../hooks/use-schema-field";
import type { SchemaFieldOverride } from "../override";

/**
 * Contract every widget-adapter receives. Adapters translate
 * (descriptor + override + binding) into concrete control props and render a
 * primitive from `react/components/setting-controls`.
 */
export interface WidgetProps {
	descriptor: SchemaFieldDescriptor;
	override?: SchemaFieldOverride | undefined;
	binding: SchemaFieldBinding<unknown>;
}

export function stringValue(raw: unknown): string {
	return typeof raw === "string" ? raw : "";
}

/**
 * Commit a string value; treat empty string as `undefined` for optional fields
 * so clearing the input removes the key from the settings object rather than
 * persisting an empty string.
 */
export function commitString(
	value: string,
	descriptor: SchemaFieldDescriptor,
	onChange: (next: unknown) => void
): void {
	onChange(descriptor.optional && value === "" ? undefined : value);
}

/**
 * Resolve the placeholder shown when the input is empty. Priority:
 * render-site override → schema `.meta({ placeholder })` → `.catch()` default.
 */
export function resolvePlaceholder(
	descriptor: SchemaFieldDescriptor,
	override?: SchemaFieldOverride
): string | undefined {
	return (
		override?.placeholder ??
		descriptor.placeholder ??
		(typeof descriptor.defaultValue === "string" ? descriptor.defaultValue : undefined)
	);
}

export function numericMin(descriptor: SchemaFieldDescriptor): number | undefined {
	return descriptor.type === "number" ? descriptor.min : undefined;
}

export function numericMax(descriptor: SchemaFieldDescriptor): number | undefined {
	return descriptor.type === "number" ? descriptor.max : undefined;
}
