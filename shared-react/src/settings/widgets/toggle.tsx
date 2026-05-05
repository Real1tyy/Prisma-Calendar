import { Toggle } from "../../components/setting-controls";
import { testIdProp } from "../../utils/test-id";
import type { WidgetProps } from "./common";

export function ToggleWidget({ binding, testId }: WidgetProps) {
	return <Toggle value={Boolean(binding.value)} onChange={binding.onChange} {...testIdProp(testId)} />;
}
