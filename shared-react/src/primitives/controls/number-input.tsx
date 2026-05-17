import { memo } from "react";

import { useDebouncedCommit } from "../../hooks/interaction/use-debounced-commit";
import { testIdAttr } from "../../utils/test-id";

interface NumberInputProps {
	value: number;
	min?: number;
	max?: number;
	step?: number;
	onChange: (value: number) => void;
	/** Override the default 300ms commit delay. Pass `0` to commit synchronously. */
	debounceMs?: number;
	testId?: string | undefined;
}

export const NumberInput = memo(function NumberInput({
	value,
	min,
	max,
	step,
	onChange,
	debounceMs,
	testId,
}: NumberInputProps) {
	const { draft, setDraft, flush } = useDebouncedCommit<number>({
		value,
		onCommit: onChange,
		...(debounceMs !== undefined ? { debounceMs } : {}),
	});
	return (
		<input
			type="number"
			className="setting-input"
			value={draft}
			min={min}
			max={max}
			step={step}
			onChange={(e) => {
				const parsed = e.target.valueAsNumber;
				if (Number.isNaN(parsed)) return;
				setDraft(parsed);
			}}
			onBlur={flush}
			onKeyDown={(e) => {
				if (e.key === "Enter") flush();
			}}
			{...testIdAttr(testId)}
		/>
	);
});
