import { Dropdown, TextInput } from "../../components/setting-controls";
import { stringValue, type WidgetProps } from "./common";

export function DropdownWidget({ descriptor, override, binding, testId }: WidgetProps) {
	// Defensive: if a non-enum field is explicitly widget-tagged as "dropdown"
	// without `options`, fall back to plain text rather than crashing.
	if (descriptor.type !== "enum") {
		if (!override?.options) {
			return (
				<TextInput value={stringValue(binding.value)} onChange={binding.onChange} {...(testId ? { testId } : {})} />
			);
		}
		return (
			<Dropdown
				value={stringValue(binding.value)}
				options={override.options}
				onChange={binding.onChange}
				{...(testId ? { testId } : {})}
			/>
		);
	}

	const options =
		override?.options ?? descriptor.enumLabels ?? Object.fromEntries(descriptor.enumValues.map((v) => [v, v]));

	return (
		<Dropdown
			value={String(binding.value ?? descriptor.enumValues[0] ?? "")}
			options={options}
			onChange={binding.onChange}
			{...(testId ? { testId } : {})}
		/>
	);
}
