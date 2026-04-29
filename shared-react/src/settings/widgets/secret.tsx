import { SecretField } from "../../components/secret-field";
import { stringValue, type WidgetProps } from "./common";

export function SecretWidget({ binding, testId }: WidgetProps) {
	return <SecretField value={stringValue(binding.value)} onChange={binding.onChange} {...(testId ? { testId } : {})} />;
}
