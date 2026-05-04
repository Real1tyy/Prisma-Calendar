import { getIconIds, setIcon } from "obsidian";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useInjectedStyles } from "../hooks/use-injected-styles";

const ITEM_HEIGHT = 48;
const GRID_COLUMNS = 8;
const GRID_GAP = 4;
const GRID_MAX_HEIGHT = 360;
const SEARCH_DEBOUNCE_MS = 150;

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
.shared-icon-picker-grid { position: relative; max-height: ${GRID_MAX_HEIGHT}px; overflow-y: auto; padding: 4px; }
.shared-icon-picker-grid-sizer { width: 100%; }
.shared-icon-picker-grid-viewport {
	display: grid; grid-template-columns: repeat(${GRID_COLUMNS}, 1fr);
	gap: ${GRID_GAP}px; position: absolute; left: 4px; right: 4px;
	justify-items: center;
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
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const gridRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const [scrollTop, setScrollTop] = useState(0);

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [query]);

	const filteredIcons = useMemo(() => {
		const q = debouncedQuery.toLowerCase().trim();
		return q ? allIcons.filter((id) => id.toLowerCase().includes(q)) : allIcons;
	}, [allIcons, debouncedQuery]);

	useEffect(() => {
		if (gridRef.current) gridRef.current.scrollTop = 0;
		setScrollTop(0);
	}, [debouncedQuery]);

	const onScroll = useCallback(() => {
		if (gridRef.current) setScrollTop(gridRef.current.scrollTop);
	}, []);

	const handleClick = useCallback((iconId: string) => onSelect(iconId), [onSelect]);

	const rowHeight = ITEM_HEIGHT + GRID_GAP;
	const totalRows = Math.ceil(filteredIcons.length / GRID_COLUMNS);
	const totalHeight = Math.max(totalRows * rowHeight - GRID_GAP, 0);

	const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
	const visibleRows = Math.ceil(GRID_MAX_HEIGHT / rowHeight) + 4;
	const endRow = Math.min(totalRows, startRow + visibleRows);
	const startIndex = startRow * GRID_COLUMNS;
	const endIndex = Math.min(endRow * GRID_COLUMNS, filteredIcons.length);

	const visibleSlice = filteredIcons.slice(startIndex, endIndex);

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
			<div ref={gridRef} className="shared-icon-picker-grid" data-testid="shared-icon-picker-grid" onScroll={onScroll}>
				<div className="shared-icon-picker-grid-sizer" style={{ height: totalHeight }} />
				{filteredIcons.length === 0 ? (
					<div className="shared-icon-picker-empty">No icons found</div>
				) : (
					<div className="shared-icon-picker-grid-viewport" style={{ top: startRow * rowHeight }}>
						{visibleSlice.map((iconId) => (
							<IconItem key={iconId} iconId={iconId} onClick={handleClick} />
						))}
					</div>
				)}
			</div>
		</div>
	);
});
