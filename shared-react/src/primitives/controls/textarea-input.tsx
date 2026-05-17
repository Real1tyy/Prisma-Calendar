import { memo } from "react";

import { useDebouncedCommit } from "../../hooks/interaction/use-debounced-commit";
import { testIdAttr } from "../../utils/test-id";

interface TextareaInputProps {
	value: string;
	placeholder?: string | undefined;
	rows?: number;
	onChange: (value: string) => void;
	/** Override the default 300ms commit delay. Pass `0` to commit synchronously. */
	debounceMs?: number;
	testId?: string | undefined;
}

export const TextareaInput = memo(function TextareaInput({
	value,
	placeholder,
	rows = 4,
	onChange,
	debounceMs,
	testId,
}: TextareaInputProps) {
	const { draft, setDraft, flush } = useDebouncedCommit<string>({
		value,
		onCommit: onChange,
		...(debounceMs !== undefined ? { debounceMs } : {}),
	});
	return (
		<textarea
			className="setting-input"
			placeholder={placeholder}
			rows={rows}
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={flush}
			onKeyDown={(e) => {
				// Multiline: only Ctrl/Cmd+Enter flushes; plain Enter inserts a newline.
				if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) flush();
			}}
			{...testIdAttr(testId)}
		/>
	);
});
