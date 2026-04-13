import { memo, useCallback, useRef, useState } from "react";

interface ToggleProps {
	value: boolean;
	onChange: (value: boolean) => void;
}

export const Toggle = memo(function Toggle({ value, onChange }: ToggleProps) {
	const handleClick = useCallback(() => onChange(!value), [value, onChange]);

	return (
		<div
			className={`checkbox-container${value ? " is-enabled" : ""}`}
			onClick={handleClick}
			role="switch"
			aria-checked={value}
			tabIndex={0}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleClick();
				}
			}}
		/>
	);
});

interface TextInputProps {
	value: string;
	placeholder?: string | undefined;
	onChange: (value: string) => void;
}

export const TextInput = memo(function TextInput({ value, placeholder, onChange }: TextInputProps) {
	const [localValue, setLocalValue] = useState(value);
	const commitRef = useRef(onChange);
	commitRef.current = onChange;

	const commit = useCallback(() => {
		commitRef.current(localValue);
	}, [localValue]);

	return (
		<input
			type="text"
			className="setting-input"
			placeholder={placeholder}
			value={localValue}
			onChange={(e) => setLocalValue(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
					e.preventDefault();
					commit();
				}
			}}
		/>
	);
});

interface DropdownProps {
	value: string;
	options: Record<string, string>;
	onChange: (value: string) => void;
}

export const Dropdown = memo(function Dropdown({ value, options, onChange }: DropdownProps) {
	return (
		<select className="dropdown" value={value} onChange={(e) => onChange(e.target.value)}>
			{Object.entries(options).map(([optValue, label]) => (
				<option key={optValue} value={optValue}>
					{label}
				</option>
			))}
		</select>
	);
});

interface NumberInputProps {
	value: number;
	min?: number;
	max?: number;
	step?: number;
	onChange: (value: number) => void;
}

export const NumberInput = memo(function NumberInput({ value, min, max, step, onChange }: NumberInputProps) {
	const [localValue, setLocalValue] = useState(String(value));
	const commitRef = useRef(onChange);
	commitRef.current = onChange;

	const commit = useCallback(() => {
		const parsed = Number(localValue);
		if (Number.isNaN(parsed)) return;
		const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
		commitRef.current(clamped);
		setLocalValue(String(clamped));
	}, [localValue, min, max]);

	return (
		<input
			type="number"
			className="setting-input"
			value={localValue}
			min={min}
			max={max}
			step={step}
			onChange={(e) => setLocalValue(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					commit();
				}
			}}
		/>
	);
});
