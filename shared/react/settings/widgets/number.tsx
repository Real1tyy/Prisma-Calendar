import { NumberInput, Slider } from "../../components/setting-controls";
import { numericMax, numericMin, type WidgetProps } from "./common";

export function NumberWidget({ descriptor, override, binding }: WidgetProps) {
	const min = override?.min ?? numericMin(descriptor);
	const max = override?.max ?? numericMax(descriptor);
	return (
		<NumberInput
			value={Number(binding.value ?? 0)}
			onChange={binding.onChange}
			{...(min !== undefined ? { min } : {})}
			{...(max !== undefined ? { max } : {})}
			{...(override?.step !== undefined ? { step: override.step } : {})}
		/>
	);
}

export function SliderWidget(props: WidgetProps) {
	const { descriptor, override, binding } = props;
	const min = override?.min ?? numericMin(descriptor);
	const max = override?.max ?? numericMax(descriptor);

	// Slider needs both bounds. Without them, fall back to a plain number input
	// rather than rendering a broken range control.
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
		/>
	);
}
