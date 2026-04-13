import { DateInput, DatetimeLocalInput } from "../../components/setting-controls";
import { stringValue, type WidgetProps } from "./common";

export function DateWidget({ binding }: WidgetProps) {
	return <DateInput value={stringValue(binding.value)} onChange={binding.onChange} />;
}

export function DatetimeWidget({ binding }: WidgetProps) {
	return <DatetimeLocalInput value={stringValue(binding.value)} onChange={binding.onChange} />;
}
