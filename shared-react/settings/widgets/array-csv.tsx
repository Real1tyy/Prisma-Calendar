import { CsvInput } from "../../components/csv-input";
import { resolvePlaceholder, type WidgetProps } from "./common";

/**
 * Comma-separated-values array input. Default for `z.array(z.string())` /
 * `z.array(z.number())` fields. For richer add/remove UIs, plug in a custom
 * widget via `override.render`.
 */
export function ArrayCsvWidget({ descriptor, override, binding }: WidgetProps) {
	const itemType = descriptor.type === "array" ? descriptor.itemType : "string";

	return (
		<CsvInput
			value={binding.value as string[] | number[] | null | undefined}
			itemType={itemType}
			placeholder={resolvePlaceholder(descriptor, override)}
			onChange={binding.onChange}
		/>
	);
}
