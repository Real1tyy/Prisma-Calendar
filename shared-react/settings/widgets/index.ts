import type { ComponentType } from "react";

import { ArrayCsvWidget } from "./array-csv";
import { ColorWidget } from "./color";
import type { WidgetProps } from "./common";
import { DatetimeWidget, DateWidget } from "./date";
import { DropdownWidget } from "./dropdown";
import { NumberWidget, SliderWidget } from "./number";
import { SecretWidget } from "./secret";
import { TextareaWidget, TextWidget } from "./text";
import { ToggleWidget } from "./toggle";

export { ArrayCsvWidget } from "./array-csv";
export { ColorWidget } from "./color";
export type { WidgetProps } from "./common";
export { DatetimeWidget, DateWidget } from "./date";
export { DropdownWidget } from "./dropdown";
export { NumberWidget, SliderWidget } from "./number";
export { SecretWidget } from "./secret";
export { TextareaWidget, TextWidget } from "./text";
export { ToggleWidget } from "./toggle";

/**
 * Built-in widget registry, keyed by `WidgetKind` string. Resolved by
 * `<SchemaField>` after `resolveWidget()` picks a name. Unknown names fall
 * back to `TextWidget`.
 */
export const BUILTIN_WIDGETS: Record<string, ComponentType<WidgetProps>> = {
	toggle: ToggleWidget,
	dropdown: DropdownWidget,
	number: NumberWidget,
	slider: SliderWidget,
	text: TextWidget,
	textarea: TextareaWidget,
	secret: SecretWidget,
	date: DateWidget,
	datetime: DatetimeWidget,
	color: ColorWidget,
	"array-csv": ArrayCsvWidget,
};
