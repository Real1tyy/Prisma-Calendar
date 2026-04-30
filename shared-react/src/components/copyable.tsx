import type { ReactNode } from "react";
import { memo } from "react";

import { useCopyToClipboard } from "../hooks/use-copy-to-clipboard";

export interface CopyableProps {
	/** The text copied to the clipboard on click. */
	text: string;
	/** Visual content rendered inside the button. Defaults to `text`. */
	children?: ReactNode | undefined;
	/** CSS class applied to the outer button element. */
	className?: string | undefined;
	/** Obsidian Notice message on copy. Defaults to `"Copied!"`. */
	successMessage?: string | undefined;
}

export const Copyable = memo(function Copyable({ text, children, className, successMessage }: CopyableProps) {
	const options = successMessage !== undefined ? { successMessage } : undefined;
	const { copy, copied } = useCopyToClipboard(text, options);

	return (
		<button
			type="button"
			className={`copyable${copied ? " is-copied" : ""}${className ? ` ${className}` : ""}`}
			onClick={copy}
			title="Click to copy"
			aria-label={`Copy ${text}`}
		>
			{children ?? text}
		</button>
	);
});
