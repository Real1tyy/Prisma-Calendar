import type { KeyboardEvent, Ref } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 150;

// ─── useFilteredItems hook ───

export function useFilteredItems<T>(items: readonly T[], query: string, fields: (keyof T & string)[]): readonly T[] {
	return useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed) return items;
		return items.filter((item) =>
			fields.some((field) => {
				const value = item[field];
				return typeof value === "string" && value.toLowerCase().includes(trimmed);
			})
		);
	}, [items, query, fields]);
}

// ─── FilterInput component ───

export interface FilterInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string | undefined;
	className?: string | undefined;
	debounceMs?: number | undefined;
	autoFocus?: boolean | undefined;
	testId?: string | undefined;
	onEscape?: (() => void) | undefined;
	/**
	 * When true, any pending debounced change is committed synchronously when the
	 * input loses focus. Default false (debounce / Enter / unmount only) — opt in
	 * for parity with toolbar filter inputs that historically committed on blur.
	 */
	flushOnBlur?: boolean | undefined;
	/**
	 * Forwarded ref to the underlying `<input>` element. Lets imperative callers
	 * query focus state or move the caret without re-implementing the input.
	 */
	inputRef?: Ref<HTMLInputElement> | undefined;
}

export const FilterInput = memo(function FilterInput({
	value,
	onChange,
	placeholder = "Filter...",
	className,
	debounceMs = DEFAULT_DEBOUNCE_MS,
	autoFocus = false,
	testId,
	onEscape,
	flushOnBlur = false,
	inputRef,
}: FilterInputProps) {
	const [localValue, setLocalValue] = useState(value);
	const [lastExternalValue, setLastExternalValue] = useState(value);
	const timerRef = useRef<number | null>(null);
	// Last trimmed value handed to onChange — used to skip redundant commits so
	// consumers never see the same value twice in a row (e.g. Enter on an
	// already-committed value, blur after debounce, preset re-selection).
	// Updated synchronously inside flushChange, and re-synced via the effect
	// below when the parent commits a new external value.
	const lastEmittedRef = useRef(value.trim());

	// Adopt new external value into local draft when prop changes.
	if (value !== lastExternalValue) {
		setLastExternalValue(value);
		setLocalValue(value);
	}

	// Refs cannot be mutated during render (react-hooks/refs); sync the
	// committed-baseline outside render. Microsecond gap vs the next
	// flushChange is fine — typing can't fire inside an effect frame.
	useEffect(() => {
		lastEmittedRef.current = lastExternalValue.trim();
	}, [lastExternalValue]);

	const flushChange = useCallback(
		(newValue: string) => {
			if (timerRef.current) window.clearTimeout(timerRef.current);
			timerRef.current = null;
			const trimmed = newValue.trim();
			if (trimmed === lastEmittedRef.current) return;
			lastEmittedRef.current = trimmed;
			onChange(trimmed);
		},
		[onChange]
	);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;
			setLocalValue(newValue);
			if (timerRef.current) window.clearTimeout(timerRef.current);
			timerRef.current = window.setTimeout(() => flushChange(newValue), debounceMs);
		},
		[debounceMs, flushChange]
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				flushChange(localValue);
			} else if (e.key === "Escape") {
				onEscape?.();
			}
		},
		[flushChange, localValue, onEscape]
	);

	const handleBlur = useCallback(() => {
		if (!flushOnBlur) return;
		if (!timerRef.current) return;
		flushChange(localValue);
	}, [flushOnBlur, flushChange, localValue]);

	useEffect(() => {
		return () => {
			if (timerRef.current) window.clearTimeout(timerRef.current);
		};
	}, []);

	return (
		<input
			ref={inputRef}
			type="text"
			className={className}
			placeholder={placeholder}
			value={localValue}
			onChange={handleChange}
			onKeyDown={handleKeyDown}
			onBlur={handleBlur}
			autoFocus={autoFocus}
			data-testid={testId}
		/>
	);
});
