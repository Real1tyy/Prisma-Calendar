import { ColorInput } from "../../components/setting-controls";
import { stringValue, type WidgetProps } from "./common";

export function ColorWidget({ binding, testId }: WidgetProps) {
	return <ColorInput value={stringValue(binding.value)} onChange={binding.onChange} {...(testId ? { testId } : {})} />;
}
