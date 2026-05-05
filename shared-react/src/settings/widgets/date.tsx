import { DateInput, DatetimeLocalInput } from "../../components/setting-controls";
import { testIdProp } from "../../utils/test-id";
import { stringValue, type WidgetProps } from "./common";

export function DateWidget({ binding, testId }: WidgetProps) {
	return <DateInput value={stringValue(binding.value)} onChange={binding.onChange} {...testIdProp(testId)} />;
}

export function DatetimeWidget({ binding, testId }: WidgetProps) {
	return <DatetimeLocalInput value={stringValue(binding.value)} onChange={binding.onChange} {...testIdProp(testId)} />;
}
