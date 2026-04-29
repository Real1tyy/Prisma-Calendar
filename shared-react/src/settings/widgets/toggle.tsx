import { Toggle } from "../../components/setting-controls";
import type { WidgetProps } from "./common";

export function ToggleWidget({ binding, testId }: WidgetProps) {
	return <Toggle value={Boolean(binding.value)} onChange={binding.onChange} {...(testId ? { testId } : {})} />;
}
