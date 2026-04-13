import type { SchemaFieldDescriptor } from "../../components/schema-modal/types";
import type { SchemaFieldOverride } from "./override";
import type { BUILTIN_WIDGETS } from "./widgets";

/**
 * Canonical widgets the built-in `<SchemaField>` dispatch knows how to render.
 *
 * `resolveWidget` returns `string` (not `WidgetKind`) on purpose: users can
 * pass unknown widget strings through `override.widget` or `.meta({ widget })`
 * and plug them into their own registry layer without fighting the types.
 */
export type WidgetKind = keyof typeof BUILTIN_WIDGETS;

/**
 * Priority chain:
 *   1. Explicit `override.widget` at the render site (hand-written JSX)
 *   2. Schema metadata `.meta({ widget: "..." })` surfaced on the descriptor
 *   3. Type-based auto-inference (number with min+max → slider, etc.)
 */
export function resolveWidget(descriptor: SchemaFieldDescriptor, override?: SchemaFieldOverride): string {
	if (override?.widget) return override.widget;
	if (descriptor.widget) return descriptor.widget;

	switch (descriptor.type) {
		case "boolean":
		case "toggle":
			return "toggle";
		case "enum":
			return "dropdown";
		case "secret":
			return "secret";
		case "date":
			return "date";
		case "datetime":
			return "datetime";
		case "number":
			return descriptor.min !== undefined && descriptor.max !== undefined ? "slider" : "number";
		case "array":
			return "array-csv";
		case "string":
		default:
			return "text";
	}
}
