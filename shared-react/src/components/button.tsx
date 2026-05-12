import type { MouseEventHandler, ReactNode } from "react";
import { memo } from "react";

import { cx } from "../utils/cx";
import { testIdAttr } from "../utils/test-id";

export type ButtonVariant = "default" | "primary" | "warning";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
	default: "",
	primary: "mod-cta",
	warning: "mod-warning",
};

export interface ButtonProps {
	onClick: MouseEventHandler<HTMLButtonElement>;
	children: ReactNode;
	testId?: string | undefined;
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
	return (
		<button
			type="button"
			className={cx(VARIANT_CLASS[variant], className)}
			onClick={onClick}
			disabled={disabled}
			{...testIdAttr(testId)}
		>
			{children}
		</button>
	);
});
