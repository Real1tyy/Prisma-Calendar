import { toSafeString } from "@real1ty-obsidian-plugins";

import { NumberInput, Slider, TextInput } from "../../primitives/controls";
import { testIdProp } from "../../utils/test-id";
import { numericMax, numericMin, resolvePlaceholder, type WidgetProps } from "./common";

export function NumberWidget({ descriptor, override, binding, testId }: WidgetProps) {
	if (descriptor.optional) {
		return <OptionalNumberInput descriptor={descriptor} override={override} binding={binding} testId={testId} />;
	}

	const min = override?.min ?? numericMin(descriptor);
	const max = override?.max ?? numericMax(descriptor);
	return (
		<NumberInput
			value={Number(binding.value ?? 0)}
			onChange={binding.onChange}
			{...(min !== undefined ? { min } : {})}
			{...(max !== undefined ? { max } : {})}
			{...(override?.step !== undefined ? { step: override.step } : {})}
			{...testIdProp(testId)}
		/>
	);
}

function OptionalNumberInput({ descriptor, override, binding, testId }: WidgetProps) {
	const placeholder = resolvePlaceholder(descriptor, override);
	const min = override?.min ?? numericMin(descriptor);
	const display = toSafeString(binding.value) ?? "";

	return (
		<TextInput
			value={display}
			placeholder={placeholder}
			onChange={(raw) => {
				const trimmed = raw.trim();
				if (trimmed === "") {
					binding.onChange(undefined);
					return;
				}
				const num = Number(trimmed);
				if (!Number.isNaN(num) && Number.isInteger(num) && (min === undefined || num >= min)) {
					binding.onChange(num);
				}
			}}
			{...testIdProp(testId)}
		/>
	);
}

export function SliderWidget(props: WidgetProps) {
	const { descriptor, override, binding, testId } = props;
	const min = override?.min ?? numericMin(descriptor);
	const max = override?.max ?? numericMax(descriptor);

	if (min === undefined || max === undefined) {
		return <NumberWidget {...props} />;
	}

	return (
		<Slider
			value={Number(binding.value ?? min)}
			min={min}
			max={max}
			{...(override?.step !== undefined ? { step: override.step } : {})}
			onChange={binding.onChange}
			{...testIdProp(testId)}
		/>
	);
}
