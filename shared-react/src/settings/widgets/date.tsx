import { DateInput, DatetimeLocalInput } from "../../components/setting-controls";
import { stringValue, type WidgetProps } from "./common";

export function DateWidget({ binding, testId }: WidgetProps) {
	return <DateInput value={stringValue(binding.value)} onChange={binding.onChange} {...(testId ? { testId } : {})} />;
}

export function DatetimeWidget({ binding, testId }: WidgetProps) {
	return (
		<DatetimeLocalInput
			value={stringValue(binding.value)}
			onChange={binding.onChange}
			{...(testId ? { testId } : {})}
		/>
	);
}
