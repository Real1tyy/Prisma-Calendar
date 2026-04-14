import { memo, useCallback, useMemo, useState } from "react";

export interface CsvInputProps {
	value: string[] | number[] | null | undefined;
	itemType: "string" | "number";
	placeholder?: string | undefined;
	onChange: (next: string[] | number[]) => void;
}

/**
 * Editable comma-separated list. The canonical store value is the parsed
 * array, but round-tripping `["a"].join(", ")` would strip trailing commas
 * and break mid-edit typing — so we keep the raw text in local state and
 * only commit the parsed array on blur or Enter.
 *
 * External store updates resync via the "adjust state during render" pattern
 * (React docs: *You Might Not Need an Effect*), avoiding `useEffect`.
 */
export const CsvInput = memo(function CsvInput({ value, itemType, placeholder, onChange }: CsvInputProps) {
	const canonical = useMemo(() => (Array.isArray(value) ? value.join(", ") : ""), [value]);

	const [draft, setDraft] = useState(canonical);
	const [lastCanonical, setLastCanonical] = useState(canonical);
	if (canonical !== lastCanonical) {
		setLastCanonical(canonical);
		setDraft(canonical);
	}

	const commit = useCallback(
		(raw: string) => {
			const parts = raw
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);

			if (itemType === "number") {
				onChange(parts.map((s) => Number(s)).filter((n) => Number.isFinite(n)));
				return;
			}

			onChange(parts);
		},
		[itemType, onChange]
	);

	return (
		<input
			type="text"
			className="setting-input"
			placeholder={placeholder}
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={() => commit(draft)}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					commit(draft);
				}
			}}
		/>
	);
});
