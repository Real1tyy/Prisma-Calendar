import { memo } from "react";

import { testIdAttr } from "../../utils/test-id";

interface DatetimeLocalInputProps {
	value: string;
	onChange: (value: string) => void;
	/** Seconds per step. The browser default is 60 (minute precision); `0.001` allows milliseconds. */
	step?: number | undefined;
	testId?: string | undefined;
}

export const DatetimeLocalInput = memo(function DatetimeLocalInput({
	value,
	onChange,
	step,
	testId,
}: DatetimeLocalInputProps) {
	return (
		<input
			type="datetime-local"
			className="setting-input"
			value={value}
			step={step}
			onChange={(e) => onChange(e.target.value)}
			{...testIdAttr(testId)}
		/>
	);
});
