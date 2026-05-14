import { useVirtualizer } from "@tanstack/react-virtual";
import { getIconIds, setIcon } from "obsidian";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { useInjectedStyles } from "../hooks/use-injected-styles";

const GRID_COLUMNS = 8;
const ROW_HEIGHT = 52;
const GRID_MAX_HEIGHT = 360;
const OVERSCAN = 3;

const ICON_PICKER_CSS = `
.mod-shared-icon-picker { width: 500px; }
.shared-icon-picker-content { display: flex; flex-direction: column; gap: 10px; padding-bottom: 8px; }
.shared-icon-picker-search-row { display: flex; gap: 8px; align-items: center; }
.shared-icon-picker-search-input {
	flex: 1; padding: 6px 10px; font-size: var(--font-ui-medium);
	border: 1px solid var(--background-modifier-border); border-radius: 6px;
	background: var(--background-secondary); color: var(--text-normal);
}
.shared-icon-picker-search-input:focus { border-color: var(--interactive-accent); outline: none; }
.shared-icon-picker-no-icon-btn {
	padding: 4px 12px; font-size: var(--font-ui-small);
	border: 1px solid var(--background-modifier-border); border-radius: 6px;
	background: var(--background-secondary); color: var(--text-muted);
	cursor: pointer; box-shadow: none; white-space: nowrap;
}
.shared-icon-picker-no-icon-btn:hover { color: var(--text-normal); border-color: var(--interactive-accent); }
.shared-icon-picker-grid { max-height: ${GRID_MAX_HEIGHT}px; overflow-y: auto; padding: 4px; }
.shared-icon-picker-row {
	display: grid; grid-template-columns: repeat(${GRID_COLUMNS}, 1fr);
	gap: 4px; justify-items: center;
}
.shared-icon-picker-item {
	display: flex; align-items: center; justify-content: center;
	width: 44px; height: 44px; border-radius: 6px; cursor: pointer;
	color: var(--text-muted); transition: color 100ms ease, background 100ms ease;
	border: 1px solid transparent;
}
.shared-icon-picker-item:hover {
	color: var(--text-normal); background: var(--background-modifier-hover);
	border-color: var(--background-modifier-border);
}
.shared-icon-picker-item-preview { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; }
.shared-icon-picker-item-preview svg { width: 18px; height: 18px; }
.shared-icon-picker-empty { padding: 24px; text-align: center; color: var(--text-faint); font-size: var(--font-ui-small); }
`;

interface IconItemProps {
	iconId: string;
	onClick: (iconId: string) => void;
}

const IconItem = memo(function IconItem({ iconId, onClick }: IconItemProps) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!ref.current) return;
		ref.current.textContent = "";
		setIcon(ref.current, iconId);
	}, [iconId]);

	return (
		<div
			className="shared-icon-picker-item"
			title={iconId}
			aria-label={iconId}
			data-testid={`shared-icon-picker-item-${iconId}`}
			onClick={() => onClick(iconId)}
		>
			<div ref={ref} className="shared-icon-picker-item-preview" />
		</div>
	);
});

export interface IconPickerGridProps {
	onSelect: (icon: string | null) => void;
	/** When false, hides the "No icon" button. Defaults to true. */
	allowNoIcon?: boolean;
}

export const IconPickerGrid = memo(function IconPickerGrid({ onSelect, allowNoIcon = true }: IconPickerGridProps) {
	useInjectedStyles("shared-icon-picker-styles", ICON_PICKER_CSS);
	const allIcons = useMemo(() => getIconIds(), []);
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);
	const gridRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	const filteredIcons = useMemo(() => {
		const q = deferredQuery.toLowerCase().trim();
		return q ? allIcons.filter((id) => id.toLowerCase().includes(q)) : allIcons;
	}, [allIcons, deferredQuery]);

	const rowCount = Math.ceil(filteredIcons.length / GRID_COLUMNS);

	const virtualizer = useVirtualizer({
		count: rowCount,
		getScrollElement: () => gridRef.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: OVERSCAN,
	});

	useEffect(() => {
		virtualizer.scrollToOffset(0);
	}, [deferredQuery, virtualizer]);

	const handleClick = useCallback((iconId: string) => onSelect(iconId), [onSelect]);

	return (
		<div className="shared-icon-picker-content">
			<div className="shared-icon-picker-search-row">
				<input
					ref={searchRef}
					type="text"
					placeholder="Search icons..."
					data-testid="shared-icon-picker-search"
					className="shared-icon-picker-search-input"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
				{allowNoIcon && (
					<button
						type="button"
						className="shared-icon-picker-no-icon-btn"
						data-testid="shared-icon-picker-no-icon"
						onClick={() => onSelect(null)}
					>
						No icon
					</button>
				)}
			</div>
			<div ref={gridRef} className="shared-icon-picker-grid" data-testid="shared-icon-picker-grid">
				{filteredIcons.length === 0 ? (
					<div className="shared-icon-picker-empty">No icons found</div>
				) : (
					<div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
						{virtualizer.getVirtualItems().map((virtualRow) => {
							const startIdx = virtualRow.index * GRID_COLUMNS;
							const rowIcons = filteredIcons.slice(startIdx, startIdx + GRID_COLUMNS);
							return (
								<div
									key={virtualRow.key}
									className="shared-icon-picker-row"
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										height: virtualRow.size,
										transform: `translateY(${virtualRow.start}px)`,
									}}
								>
									{rowIcons.map((iconId) => (
										<IconItem key={iconId} iconId={iconId} onClick={handleClick} />
									))}
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
});
