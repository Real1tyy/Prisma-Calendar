import type { ReactNode } from "react";
import { memo, useCallback } from "react";

import { buildChipListStyles } from "../../components/primitives/chip-list";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { Chip } from "./chip";
import { EmptyHint } from "./empty-hint";

export interface ChipListProps {
	value: string[];
	onChange: (next: string[]) => void;
	cssPrefix: string;
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
	cssPrefix,
	emptyText = DEFAULT_EMPTY_TEXT,
	getDisplayName,
	getTooltip,
	renderPrefix,
	onItemClick,
}: ChipListProps) {
	useInjectedStyles(`${cssPrefix}chip-list-styles`, buildChipListStyles(cssPrefix));

	const handleRemove = useCallback(
		(item: string) => {
			onChange(value.filter((v) => v !== item));
		},
		[value, onChange]
	);

	if (value.length === 0) {
		return (
			<div className={`${cssPrefix}chip-list`}>
				<EmptyHint text={emptyText} className={`${cssPrefix}chip-empty`} />
			</div>
		);
	}

	return (
		<div className={`${cssPrefix}chip-list`}>
			{value.map((item) => (
				<Chip
					key={item}
					value={item}
					label={getDisplayName?.(item) ?? item}
					tooltip={getTooltip?.(item)}
					prefix={renderPrefix?.(item)}
					onClick={onItemClick}
					onRemove={handleRemove}
					cssPrefix={cssPrefix}
				/>
			))}
		</div>
	);
});
