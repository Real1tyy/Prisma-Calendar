import { memo } from "react";

import { testIdAttr } from "../../utils/test-id";

interface DatetimeLocalInputProps {
	value: string;
	onChange: (value: string) => void;
	testId?: string | undefined;
}

export const DatetimeLocalInput = memo(function DatetimeLocalInput({
	value,
	onChange,
	testId,
}: DatetimeLocalInputProps) {
	return (
		<input
			type="datetime-local"
			className="setting-input"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			{...testIdAttr(testId)}
		/>
	);
});
