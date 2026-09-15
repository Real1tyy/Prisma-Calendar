import { memo, type Ref } from "react";

import { useDebouncedCommit } from "../../hooks/interaction/use-debounced-commit";
import { testIdAttr } from "../../utils/test-id";

interface TextInputProps {
	value: string;
	placeholder?: string | undefined;
	onChange: (value: string) => void;
	/** Override the default 300ms commit delay. Pass `0` to commit synchronously. */
	debounceMs?: number;
	testId?: string | undefined;
	/** For callers that move focus into the field, e.g. a Ctrl/Cmd+F shortcut. */
	inputRef?: Ref<HTMLInputElement> | undefined;
}

export const TextInput = memo(function TextInput({
	value,
	placeholder,
	onChange,
	debounceMs,
	testId,
	inputRef,
}: TextInputProps) {
	const { draft, setDraft, flush } = useDebouncedCommit<string>({
		value,
		onCommit: onChange,
		...(debounceMs !== undefined ? { debounceMs } : {}),
	});
	return (
		<input
			ref={inputRef}
			type="text"
			className="setting-input"
			placeholder={placeholder}
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={flush}
			onKeyDown={(e) => {
				if (e.key === "Enter") flush();
			}}
			{...testIdAttr(testId)}
		/>
	);
});
