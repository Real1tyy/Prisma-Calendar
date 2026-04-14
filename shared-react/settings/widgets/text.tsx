import { TextareaInput, TextInput } from "../../components/setting-controls";
import { commitString, resolvePlaceholder, stringValue, type WidgetProps } from "./common";

export function TextWidget({ descriptor, override, binding }: WidgetProps) {
	return (
		<TextInput
			value={stringValue(binding.value)}
			placeholder={resolvePlaceholder(descriptor, override)}
			onChange={(v) => commitString(v, descriptor, binding.onChange)}
		/>
	);
}

export function TextareaWidget({ descriptor, override, binding }: WidgetProps) {
	return (
		<TextareaInput
			value={stringValue(binding.value)}
			placeholder={resolvePlaceholder(descriptor, override)}
			{...(override?.rows !== undefined ? { rows: override.rows } : {})}
			onChange={(v) => commitString(v, descriptor, binding.onChange)}
		/>
	);
}
