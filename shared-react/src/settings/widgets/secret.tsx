import { SecretField } from "../../components/secret-field";
import { stringValue, type WidgetProps } from "./common";

export function SecretWidget({ binding }: WidgetProps) {
	return <SecretField value={stringValue(binding.value)} onChange={binding.onChange} />;
}
