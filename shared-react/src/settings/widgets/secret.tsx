import { SecretField } from "../../primitives/atoms/secret-field";
import { testIdProp } from "../../utils/test-id";
import { stringValue, type WidgetProps } from "./common";

export function SecretWidget({ binding, testId }: WidgetProps) {
	return <SecretField value={stringValue(binding.value)} onChange={binding.onChange} {...testIdProp(testId)} />;
}
