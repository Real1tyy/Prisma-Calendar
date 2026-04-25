import type { KeyboardEvent } from "react";
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
	placeholder?: string;
	className?: string;
	debounceMs?: number;
	autoFocus?: boolean;
	testId?: string;
	onEscape?: () => void;
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
}: FilterInputProps) {
	const [localValue, setLocalValue] = useState(value);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	const flushChange = useCallback(
		(newValue: string) => {
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = null;
			onChange(newValue.trim());
		},
		[onChange]
	);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;
			setLocalValue(newValue);
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => flushChange(newValue), debounceMs);
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
		[localValue, flushChange, onEscape]
	);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
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
			autoFocus={autoFocus}
			data-testid={testId}
		/>
	);
});
