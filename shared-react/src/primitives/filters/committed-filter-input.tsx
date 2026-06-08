import { useCallback, useImperativeHandle, useRef, useState, type Ref } from "react";

import { FilterInput, type FilterInputProps } from "./filter-input";

/**
 * Imperative handle for callers that need to focus, read, or programmatically
 * seed the input without going through React's render path (e.g. preset
 * selection that has to inject an expression and trigger a commit).
 */
export interface CommittedFilterInputHandle {
	focus: () => void;
	isFocused: () => boolean;
	setValue: (value: string) => void;
	getValue: () => string;
}

/**
 * Props for `CommittedFilterInput`. Derived from `FilterInputProps` so we
 * never drift from the shared input's surface — strip out the controlled
 * fields (`value` / `onChange`) which this wrapper owns, the imperative
 * `inputRef` (replaced by `handleRef`), and the input-only `autoFocus` /
 * `onEscape` which aren't part of this primitive's contract.
 */
export type CommittedFilterInputProps = Omit<
	FilterInputProps,
	"value" | "onChange" | "inputRef" | "autoFocus" | "onEscape"
> & {
	initialValue?: string | undefined;
	onCommit: (value: string) => void;
	handleRef?: Ref<CommittedFilterInputHandle> | undefined;
};

/**
 * Controlled input that owns its committed value, debounces user typing, and
 * exposes a small imperative handle. Wraps `FilterInput` (which provides the
 * debounce + commit-dedup) and adds the committed-value state both filter
 * consumers (FullCalendar toolbar + view filter bar) need.
 *
 * The dedup of identical commits lives in `FilterInput.flushChange`, so this
 * component only needs to forward changes — no extra ref tracking required
 * outside the imperative `setValue` path (which bypasses the input entirely).
 */
export function CommittedFilterInput({
	initialValue = "",
	placeholder,
	className,
	debounceMs,
	testId,
	flushOnBlur = false,
	onCommit,
	handleRef,
}: CommittedFilterInputProps) {
	const [value, setValue] = useState(initialValue);
	const committedRef = useRef(initialValue);
	const inputRef = useRef<HTMLInputElement>(null);

	const handleChange = useCallback(
		(next: string) => {
			setValue(next);
			committedRef.current = next;
			onCommit(next);
		},
		[onCommit]
	);

	useImperativeHandle(
		handleRef,
		() => ({
			focus: () => inputRef.current?.focus(),
			isFocused: () => inputRef.current !== null && inputRef.current === activeDocument.activeElement,
			setValue: (next: string) => {
				setValue(next);
				if (next === committedRef.current) return;
				committedRef.current = next;
				onCommit(next);
			},
			getValue: () => committedRef.current,
		}),
		[onCommit]
	);

	return (
		<FilterInput
			value={value}
			onChange={handleChange}
			placeholder={placeholder}
			className={className}
			debounceMs={debounceMs}
			flushOnBlur={flushOnBlur}
			testId={testId}
			inputRef={inputRef}
		/>
	);
}
