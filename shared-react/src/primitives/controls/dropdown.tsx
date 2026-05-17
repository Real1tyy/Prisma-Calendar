import { memo } from "react";

import { testIdAttr } from "../../utils/test-id";

interface DropdownProps {
	value: string;
	options: Record<string, string>;
	onChange: (value: string) => void;
	testId?: string | undefined;
}

export const Dropdown = memo(function Dropdown({ value, options, onChange, testId }: DropdownProps) {
	return (
		<select className="dropdown" value={value} onChange={(e) => onChange(e.target.value)} {...testIdAttr(testId)}>
			{Object.entries(options).map(([optValue, label]) => (
				<option key={optValue} value={optValue}>
					{label}
				</option>
			))}
		</select>
	);
});
