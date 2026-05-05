import { ColorInput } from "../../components/setting-controls";
import { testIdProp } from "../../utils/test-id";
import { stringValue, type WidgetProps } from "./common";

export function ColorWidget({ binding, testId }: WidgetProps) {
	return <ColorInput value={stringValue(binding.value)} onChange={binding.onChange} {...testIdProp(testId)} />;
}
