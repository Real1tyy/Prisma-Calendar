import { memo, useCallback, type ChangeEvent, type KeyboardEvent } from "react";

export type PrismaCheckboxStyle = "plain" | "labeled-toggle";

interface BaseProps {
	value: boolean;
	onChange: (value: boolean) => void;
	testId?: string | undefined;
	disabled?: boolean | undefined;
}

interface PlainProps extends BaseProps {
	style?: "plain";
}

interface LabeledToggleProps extends BaseProps {
	style: "labeled-toggle";
	label: string;
}

export type PrismaCheckboxProps = PlainProps | LabeledToggleProps;

export const PrismaCheckbox = memo(function PrismaCheckbox(props: PrismaCheckboxProps) {
	const { value, onChange, testId, disabled } = props;
	const style = props.style ?? "plain";

	const handleChange = useCallback(
		(e: ChangeEvent<HTMLInputElement>) => {
			onChange(e.target.checked);
		},
		[onChange]
	);

	const toggle = useCallback(() => {
		if (!disabled) onChange(!value);
	}, [disabled, onChange, value]);

	const handleKey = useCallback(
		(e: KeyboardEvent<HTMLElement>) => {
			if (e.key === " " || e.key === "Enter") {
				e.preventDefault();
				toggle();
			}
		},
		[toggle]
	);

	if (style === "labeled-toggle") {
		const { label } = props as LabeledToggleProps;
		return (
			<div className="prisma-virtual-toggle">
				<span className="prisma-virtual-toggle-label" role="presentation" onClick={toggle} onKeyDown={handleKey}>
					{label}
				</span>
				<input
					type="checkbox"
					className="prisma-virtual-toggle-checkbox"
					checked={value}
					onChange={handleChange}
					disabled={disabled}
					{...(testId ? { "data-testid": testId } : {})}
				/>
			</div>
		);
	}

	return (
		<input
			type="checkbox"
			className="prisma-setting-item-control"
			checked={value}
			onChange={handleChange}
			disabled={disabled}
			{...(testId ? { "data-testid": testId } : {})}
		/>
	);
});
