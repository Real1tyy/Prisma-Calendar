import { injectStyleSheet } from "@real1ty-obsidian-plugins";
import { SliderComponent } from "obsidian";
import { memo, useCallback, useEffect, useRef } from "react";

import { useActivatable } from "../hooks/use-activatable";
import { useDebouncedCommit } from "../hooks/use-debounced-commit";

interface ToggleProps {
	value: boolean;
	onChange: (value: boolean) => void;
	testId?: string;
}

export const Toggle = memo(function Toggle({ value, onChange, testId }: ToggleProps) {
	const handleToggle = useCallback(() => onChange(!value), [value, onChange]);
	const activate = useActivatable(handleToggle);

	return (
		<div
			{...activate}
			className={`checkbox-container${value ? " is-enabled" : ""}`}
			role="switch"
			aria-checked={value}
			{...(testId ? { "data-testid": testId } : {})}
		/>
	);
});

interface TextInputProps {
	value: string;
	placeholder?: string | undefined;
	onChange: (value: string) => void;
	/** Override the default 300ms commit delay. Pass `0` to commit synchronously. */
	debounceMs?: number;
	testId?: string;
}

export const TextInput = memo(function TextInput({ value, placeholder, onChange, debounceMs, testId }: TextInputProps) {
	const { draft, setDraft, flush } = useDebouncedCommit<string>({
		value,
		onCommit: onChange,
		...(debounceMs !== undefined ? { debounceMs } : {}),
	});
	return (
		<input
			type="text"
			className="setting-input"
			placeholder={placeholder}
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={flush}
			onKeyDown={(e) => {
				if (e.key === "Enter") flush();
			}}
			{...(testId ? { "data-testid": testId } : {})}
		/>
	);
});

interface DropdownProps {
	value: string;
	options: Record<string, string>;
	onChange: (value: string) => void;
	testId?: string;
}

export const Dropdown = memo(function Dropdown({ value, options, onChange, testId }: DropdownProps) {
	return (
		<select
			className="dropdown"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			{...(testId ? { "data-testid": testId } : {})}
		>
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
	/** Override the default 300ms commit delay. Pass `0` to commit synchronously. */
	debounceMs?: number;
	testId?: string;
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
			{...(testId ? { "data-testid": testId } : {})}
		/>
	);
});

interface TextareaInputProps {
	value: string;
	placeholder?: string | undefined;
	rows?: number;
	onChange: (value: string) => void;
	/** Override the default 300ms commit delay. Pass `0` to commit synchronously. */
	debounceMs?: number;
	testId?: string;
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
			{...(testId ? { "data-testid": testId } : {})}
		/>
	);
});

interface DateInputProps {
	value: string;
	onChange: (value: string) => void;
	testId?: string;
}

export const DateInput = memo(function DateInput({ value, onChange, testId }: DateInputProps) {
	return (
		<input
			type="date"
			className="setting-input"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			{...(testId ? { "data-testid": testId } : {})}
		/>
	);
});

interface DatetimeLocalInputProps {
	value: string;
	onChange: (value: string) => void;
	testId?: string;
}

export const DatetimeLocalInput = memo(function DatetimeLocalInput({
	value,
	onChange,
	testId,
}: DatetimeLocalInputProps) {
	return (
		<input
			type="datetime-local"
			className="setting-input"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			{...(testId ? { "data-testid": testId } : {})}
		/>
	);
});

interface ColorInputProps {
	value: string;
	onChange: (value: string) => void;
	testId?: string;
}

export const ColorInput = memo(function ColorInput({ value, onChange, testId }: ColorInputProps) {
	return (
		<input
			type="color"
			className="setting-input setting-input--color"
			value={value || "#000000"}
			onChange={(e) => onChange(e.target.value)}
			{...(testId ? { "data-testid": testId } : {})}
		/>
	);
});

interface SliderProps {
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	/** Override the default 300ms commit delay. Pass `0` to commit synchronously. */
	debounceMs?: number;
	testId?: string;
}

export const Slider = memo(function Slider({ value, min, max, step, onChange, debounceMs, testId }: SliderProps) {
	injectStyleSheet("setting-slider-host-styles", ".setting-slider-host { display: contents; }");
	const hostRef = useRef<HTMLSpanElement>(null);
	const componentRef = useRef<SliderComponent | null>(null);
	const { draft, setDraft, flush } = useDebouncedCommit<number>({
		value,
		onCommit: onChange,
		...(debounceMs !== undefined ? { debounceMs } : {}),
	});
	const setDraftRef = useRef(setDraft);
	setDraftRef.current = setDraft;
	const flushRef = useRef(flush);
	flushRef.current = flush;

	useEffect(() => {
		const el = hostRef.current;
		if (!el) return;
		const component = new SliderComponent(el)
			.setLimits(min, max, step ?? 1)
			.setValue(draft)
			.setDynamicTooltip()
			.onChange((next) => setDraftRef.current(next));
		componentRef.current = component;
		const flushOnRelease = () => flushRef.current();
		const sliderEl = el.querySelector("input[type='range']");
		sliderEl?.addEventListener("change", flushOnRelease);
		sliderEl?.addEventListener("pointerup", flushOnRelease);
		sliderEl?.addEventListener("blur", flushOnRelease);
		return () => {
			sliderEl?.removeEventListener("change", flushOnRelease);
			sliderEl?.removeEventListener("pointerup", flushOnRelease);
			sliderEl?.removeEventListener("blur", flushOnRelease);
			el.replaceChildren();
			componentRef.current = null;
		};
		// Rebuild when bounds change; draft updates are forwarded via the
		// setValue effect below. Rebuilding on every draft change would fight
		// the user mid-drag.
	}, [min, max, step]);

	useEffect(() => {
		componentRef.current?.setValue(draft);
	}, [draft]);

	return <span ref={hostRef} className="setting-slider-host" {...(testId ? { "data-testid": testId } : {})} />;
});
