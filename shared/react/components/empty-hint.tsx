import { memo } from "react";

export interface EmptyHintProps {
	text: string;
	className?: string;
}

/**
 * Single-line muted placeholder used inside list-shaped components when there's
 * nothing to render. Tiny on purpose — every empty state looks the same.
 */
export const EmptyHint = memo(function EmptyHint({ text, className }: EmptyHintProps) {
	return <span className={className}>{text}</span>;
});
