import { buildChipListStyles } from "@real1ty-obsidian-plugins";
import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import { useScoped } from "../contexts/theme-context";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { Chip } from "./chip";
import { EmptyHint } from "./empty-hint";

export interface ChipListProps {
	value: string[];
	onChange: (next: string[]) => void;
	emptyText?: string;
	getDisplayName?: (item: string) => string;
	getTooltip?: (item: string) => string;
	/** Optional slot rendered before each chip label (e.g. a color dot). */
	renderPrefix?: (item: string) => ReactNode;
	/** Click handler for the label. Omit to make labels non-interactive. */
	onItemClick?: (item: string) => void;
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
	const { cls, cssPrefix } = useScoped("chip");
	useInjectedStyles(`${cssPrefix}chip-list-styles`, buildChipListStyles(cssPrefix));

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
