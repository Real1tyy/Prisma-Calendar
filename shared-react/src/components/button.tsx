import type { MouseEventHandler, ReactNode } from "react";
import { memo } from "react";

export type ButtonVariant = "default" | "primary" | "warning";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
	default: "",
	primary: "mod-cta",
	warning: "mod-warning",
};

export interface ButtonProps {
	testId: string;
	onClick: MouseEventHandler<HTMLButtonElement>;
	children: ReactNode;
	variant?: ButtonVariant | undefined;
	disabled?: boolean | undefined;
	className?: string | undefined;
}

export const Button = memo(function Button({
	testId,
	onClick,
	children,
	variant = "default",
	disabled,
	className,
}: ButtonProps) {
	const variantCls = VARIANT_CLASS[variant];
	const cls = [variantCls, className].filter(Boolean).join(" ") || undefined;

	return (
		<button type="button" className={cls} onClick={onClick} disabled={disabled} data-testid={testId}>
			{children}
		</button>
	);
});
