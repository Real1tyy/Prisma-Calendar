import { memo } from "react";

export interface TextareaProps {
	testId: string;
	value: string;
	onChange: (value: string) => void;
	rows?: number | undefined;
	placeholder?: string | undefined;
	spellCheck?: boolean | undefined;
	disabled?: boolean | undefined;
	className?: string | undefined;
}

export const Textarea = memo(function Textarea({
	testId,
	value,
	onChange,
	rows = 4,
	placeholder,
	spellCheck,
	disabled,
	className,
}: TextareaProps) {
	return (
		<textarea
			className={className}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			rows={rows}
			placeholder={placeholder}
			spellCheck={spellCheck}
			disabled={disabled}
			data-testid={testId}
		/>
	);
});
