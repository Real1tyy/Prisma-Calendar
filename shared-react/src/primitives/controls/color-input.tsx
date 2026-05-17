import { memo, useEffect, useRef } from "react";

import { useDebouncedCommit } from "../../hooks/interaction/use-debounced-commit";
import { testIdAttr } from "../../utils/test-id";

interface ColorInputProps {
	value: string;
	onChange: (value: string) => void;
	/** Override the default 300ms commit delay. Pass `0` to commit synchronously. */
	debounceMs?: number;
	testId?: string | undefined;
}

export const ColorInput = memo(function ColorInput({ value, onChange, debounceMs, testId }: ColorInputProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const { draft, setDraft, flush } = useDebouncedCommit<string>({
		value: value || "#000000",
		onCommit: onChange,
		...(debounceMs !== undefined ? { debounceMs } : {}),
	});
	const flushRef = useRef(flush);
	flushRef.current = flush;

	// Native `change` fires when the picker is dismissed; React's `onChange` is
	// wired to `input` and fires continuously while the user drags through the
	// palette. Flushing on `change` commits the final pick immediately instead
	// of waiting for the debounce timer.
	useEffect(() => {
		const el = inputRef.current;
		if (!el) return;
		const onNativeChange = () => flushRef.current();
		el.addEventListener("change", onNativeChange);
		return () => el.removeEventListener("change", onNativeChange);
	}, []);

	return (
		<input
			ref={inputRef}
			type="color"
			className="setting-input setting-input--color"
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={flush}
			{...testIdAttr(testId)}
		/>
	);
});
