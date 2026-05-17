import { memo } from "react";

import { testIdAttr } from "../../utils/test-id";

interface DateInputProps {
	value: string;
	onChange: (value: string) => void;
	testId?: string | undefined;
}

export const DateInput = memo(function DateInput({ value, onChange, testId }: DateInputProps) {
	return (
		<input
			type="date"
			className="setting-input"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			{...testIdAttr(testId)}
		/>
	);
});
