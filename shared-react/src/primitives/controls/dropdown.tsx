import { memo } from "react";

import { testIdAttr } from "../../utils/test-id";

interface DropdownProps {
	value: string;
	options: Record<string, string>;
	onChange: (value: string) => void;
	testId?: string | undefined;
}

export const Dropdown = memo(function Dropdown({ value, options, onChange, testId }: DropdownProps) {
	// A controlled <select> whose value matches no <option> does NOT render blank: the browser
	// deselects everything, then resets a size-1 select to its FIRST option. The user then sees a
	// value the caller never held, and picking it fires no change event — so the state is both
	// wrong and uncorrectable. Giving the unrepresented value an option of its own keeps the
	// display honest and every option reachable. See [[knowledge-controlled-value-domain]].
	const unrepresented = !Object.hasOwn(options, value);

	return (
		<select className="dropdown" value={value} onChange={(e) => onChange(e.target.value)} {...testIdAttr(testId)}>
			{unrepresented && <option value={value} />}
			{Object.entries(options).map(([optValue, label]) => (
				<option key={optValue} value={optValue}>
					{label}
				</option>
			))}
		</select>
	);
});
