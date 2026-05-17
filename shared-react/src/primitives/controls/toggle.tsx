import { memo, useCallback } from "react";

import { useActivatable } from "../../hooks/interaction/use-activatable";
import { testIdAttr } from "../../utils/test-id";

interface ToggleProps {
	value: boolean;
	onChange: (value: boolean) => void;
	testId?: string | undefined;
}

export const Toggle = memo(function Toggle({ value, onChange, testId }: ToggleProps) {
	const handleToggle = useCallback(() => onChange(!value), [value, onChange]);
	const activate = useActivatable(handleToggle);

	return (
		<div
			{...activate}
			className={`checkbox-container${value ? " is-enabled" : ""}`}
			role="switch"
			aria-checked={value}
			{...testIdAttr(testId)}
		/>
	);
});
