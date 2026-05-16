import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import { useScoped } from "../contexts/theme-context";
import { useActivatable } from "../hooks/interaction/use-activatable";

export interface ChipProps {
	/** Arbitrary value this chip represents — passed back to callbacks. */
	value: string;
	/** Text displayed inside the chip. Defaults to `value` when omitted. */
	label?: string | undefined;
	/** Tooltip shown on hover over the label span. */
	tooltip?: string | undefined;
	/** Optional slot rendered before the label (e.g. a color dot). */
	prefix?: ReactNode | undefined;
	/** Handler invoked when the label is clicked. Omit to make the label non-interactive. */
	onClick?: ((value: string) => void) | undefined;
	/** Handler invoked when the ✕ remove button is clicked. Omit to hide the button entirely. */
	onRemove?: ((value: string) => void) | undefined;
}

/**
 * One visual chip. Fully controlled — all state lives in the parent.
 */
export const Chip = memo(function Chip({ value, label, tooltip, prefix, onClick, onRemove }: ChipProps) {
	const { cls, tid } = useScoped("chip");
	const displayLabel = label ?? value;

	const clickBound = useCallback(() => onClick?.(value), [onClick, value]);
	const removeBound = useCallback(() => onRemove?.(value), [onRemove, value]);

	const labelActivate = useActivatable(onClick ? clickBound : undefined);
	const removeActivate = useActivatable(onRemove ? removeBound : undefined);

	return (
		<div className={cls("item")} data-testid={tid("item")} data-chip-value={value}>
			{prefix}
			<span {...labelActivate} className={cls("name")} title={tooltip} role={onClick ? "button" : undefined}>
				{displayLabel}
			</span>
			{onRemove && (
				<span
					{...removeActivate}
					className={cls("remove")}
					role="button"
					aria-label={`Remove ${displayLabel}`}
					data-testid={tid("remove")}
				>
					{"×"}
				</span>
			)}
		</div>
	);
});
