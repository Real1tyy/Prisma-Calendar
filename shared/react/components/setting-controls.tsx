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
	return (
		<input
			type="text"
			className="setting-input"
			placeholder={placeholder}
			value={value}
			onChange={(e) => onChange(e.target.value)}
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
	return (
		<input
			type="number"
			className="setting-input"
			value={value}
			min={min}
			max={max}
			step={step}
			onChange={(e) => {
				const parsed = e.target.valueAsNumber;
				if (Number.isNaN(parsed)) return;
				onChange(parsed);
			}}
		/>
	);
});

interface TextareaInputProps {
	value: string;
	placeholder?: string | undefined;
	rows?: number;
	onChange: (value: string) => void;
}

export const TextareaInput = memo(function TextareaInput({
	value,
	placeholder,
	rows = 4,
	onChange,
}: TextareaInputProps) {
	const [localValue, setLocalValue] = useState(value);
	const commitRef = useRef(onChange);
	commitRef.current = onChange;

	return (
		<textarea
			className="setting-input"
			placeholder={placeholder}
			rows={rows}
			value={localValue}
			onChange={(e) => setLocalValue(e.target.value)}
			onBlur={() => commitRef.current(localValue)}
		/>
	);
});

interface DateInputProps {
	value: string;
	onChange: (value: string) => void;
}

export const DateInput = memo(function DateInput({ value, onChange }: DateInputProps) {
	return <input type="date" className="setting-input" value={value} onChange={(e) => onChange(e.target.value)} />;
});

interface DatetimeLocalInputProps {
	value: string;
	onChange: (value: string) => void;
}

export const DatetimeLocalInput = memo(function DatetimeLocalInput({ value, onChange }: DatetimeLocalInputProps) {
	return (
		<input type="datetime-local" className="setting-input" value={value} onChange={(e) => onChange(e.target.value)} />
	);
});

interface ColorInputProps {
	value: string;
	onChange: (value: string) => void;
}

export const ColorInput = memo(function ColorInput({ value, onChange }: ColorInputProps) {
	return (
		<input
			type="color"
			className="setting-input setting-input--color"
			value={value || "#000000"}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
});

interface SliderProps {
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
}

export const Slider = memo(function Slider({ value, min, max, step, onChange }: SliderProps) {
	const clamped = Math.min(max, Math.max(min, value));
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const parsed = e.target.valueAsNumber;
			if (Number.isNaN(parsed)) return;
			onChange(Math.min(max, Math.max(min, parsed)));
		},
		[onChange, min, max]
	);

	return (
		<span className="setting-slider">
			<input type="range" className="slider" min={min} max={max} step={step} value={clamped} onChange={handleChange} />
			<input
				type="number"
				className="setting-input"
				min={min}
				max={max}
				step={step}
				value={clamped}
				onChange={handleChange}
			/>
		</span>
	);
});
