import { Toggle } from "../../components/setting-controls";
import type { WidgetProps } from "./common";

export function ToggleWidget({ binding }: WidgetProps) {
	return <Toggle value={Boolean(binding.value)} onChange={binding.onChange} />;
}
