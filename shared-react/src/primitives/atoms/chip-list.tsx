import { buildChipListStyles } from "@real1ty-obsidian-plugins";
import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import { useScopedStyles } from "../../hooks/styles/use-styles";
import { Chip } from "./chip";
import { EmptyHint } from "./empty-hint";

export interface ChipCollection {
	value: string[];
	onChange: (next: string[]) => void;
}

export interface ChipDisplay {
	getDisplayName?: ((item: string) => string) | undefined;
	getTooltip?: ((item: string) => string) | undefined;
	/** Optional slot rendered before each chip label (e.g. a color dot). */
	renderPrefix?: ((item: string) => ReactNode) | undefined;
}

export interface ChipInteraction {
	/** Click handler for the label. Omit to make labels non-interactive. */
	onItemClick?: ((item: string) => void) | undefined;
}

export interface ChipListProps extends ChipCollection, ChipDisplay, ChipInteraction {
	emptyText?: string | undefined;
}

const DEFAULT_EMPTY_TEXT = "No items";

/**
 * Controlled list of removable chips. Parent owns `value`; `onChange` fires
 * when the user removes a chip. Adding chips is the parent's responsibility —
 * the component deliberately exposes no "add" UI because real consumers need
 * different input widgets (dropdown, typeahead, inline editor).
 */
export const ChipList = memo(function ChipList({
	value,
	onChange,
	emptyText = DEFAULT_EMPTY_TEXT,
	getDisplayName,
	getTooltip,
	renderPrefix,
	onItemClick,
}: ChipListProps) {
	const { cls } = useScopedStyles("chip", buildChipListStyles);

	const handleRemove = useCallback(
		(item: string) => {
			onChange(value.filter((v) => v !== item));
		},
		[value, onChange]
	);

	if (value.length === 0) {
		return (
			<div className={cls("list")}>
				<EmptyHint text={emptyText} className={cls("empty")} />
			</div>
		);
	}

	return (
		<div className={cls("list")}>
			{value.map((item) => (
				<Chip
					key={item}
					value={item}
					label={getDisplayName?.(item) ?? item}
					tooltip={getTooltip?.(item)}
					prefix={renderPrefix?.(item)}
					onClick={onItemClick}
					onRemove={handleRemove}
				/>
			))}
		</div>
	);
});
