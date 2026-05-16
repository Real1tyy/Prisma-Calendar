import type { CellOption, GridLayoutState } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { CSSProperties } from "react";
import { memo, useCallback, useMemo, useReducer } from "react";

import { ObsidianIcon } from "../components/obsidian-icon";
import { useApp } from "../contexts/app-context";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { showReactModal } from "../show-react-modal";
import { openCellPicker } from "./cell-picker-modal";
import { adjustSizes } from "./engine-state";
import { buildGridStyles } from "./styles";

const MIN_DIM = 1;
const MAX_DIM = 6;

export interface LayoutEditorContentProps {
	initialState: GridLayoutState;
	cellPalette: CellOption[];
	onApply: (newState: GridLayoutState) => void;
	onCancel: () => void;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function makeUnitSizes(length: number): number[] {
	return Array.from({ length }, () => 1);
}

function resizeSizes(sizes: number[] | undefined, oldLength: number, newLength: number): number[] {
	return adjustSizes(sizes, oldLength, newLength) ?? makeUnitSizes(newLength);
}

function filterNumericRecord<T>(record: Record<string, T> | undefined, limit: number): Record<string, T> | undefined {
	if (!record) return undefined;
	const filtered = Object.fromEntries(Object.entries(record).filter(([key]) => Number(key) < limit));
	return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function mapSizesRecord(
	record: Record<string, number[]> | undefined,
	oldLength: number,
	newLength: number
): Record<string, number[]> | undefined {
	if (!record) return undefined;
	return Object.fromEntries(
		Object.entries(record).map(([key, sizes]) => [key, resizeSizes(sizes, oldLength, newLength)])
	);
}

function cloneSizesRecord(record: Record<string, number[]> | undefined): Record<string, number[]> | undefined {
	if (!record) return undefined;
	return Object.fromEntries(Object.entries(record).map(([key, sizes]) => [key, [...sizes]]));
}

function cloneGridState(state: GridLayoutState): GridLayoutState {
	return {
		columns: state.columns,
		rows: state.rows,
		cells: state.cells.map((cell) => ({ ...cell })),
		columnSizes: state.columnSizes ? [...state.columnSizes] : undefined,
		rowSizes: state.rowSizes ? [...state.rowSizes] : undefined,
		cellColumnSizes: cloneSizesRecord(state.cellColumnSizes),
		cellRowSizes: cloneSizesRecord(state.cellRowSizes),
	};
}

function applyColumnsChange(state: GridLayoutState, newColumns: number): GridLayoutState {
	const oldColumns = state.columns;
	return {
		...state,
		columns: newColumns,
		cells: state.cells.filter((c) => c.col < newColumns),
		columnSizes: adjustSizes(state.columnSizes, oldColumns, newColumns),
		cellColumnSizes: mapSizesRecord(state.cellColumnSizes, oldColumns, newColumns),
		cellRowSizes: filterNumericRecord(state.cellRowSizes, newColumns),
	};
}

function applyRowsChange(state: GridLayoutState, newRows: number): GridLayoutState {
	const oldRows = state.rows;
	return {
		...state,
		rows: newRows,
		cells: state.cells.filter((c) => c.row < newRows),
		rowSizes: adjustSizes(state.rowSizes, oldRows, newRows),
		cellColumnSizes: filterNumericRecord(state.cellColumnSizes, newRows),
		cellRowSizes: mapSizesRecord(state.cellRowSizes, oldRows, newRows),
	};
}

function assignCell(state: GridLayoutState, row: number, col: number, optionId: string): GridLayoutState {
	return {
		...state,
		cells: [...state.cells.filter((c) => !(c.row === row && c.col === col)), { row, col, optionId }],
	};
}

function removeCell(state: GridLayoutState, row: number, col: number): GridLayoutState {
	return { ...state, cells: state.cells.filter((c) => !(c.row === row && c.col === col)) };
}

// ── Reducer ───────────────────────────────────────────────────────────────────

type LayoutEditorAction =
	| { type: "setColumns"; columns: number }
	| { type: "setRows"; rows: number }
	| { type: "removeCell"; row: number; col: number }
	| { type: "assignCell"; row: number; col: number; optionId: string };

function layoutEditorReducer(state: GridLayoutState, action: LayoutEditorAction): GridLayoutState {
	switch (action.type) {
		case "setColumns":
			return applyColumnsChange(state, action.columns);
		case "setRows":
			return applyRowsChange(state, action.rows);
		case "removeCell":
			return removeCell(state, action.row, action.col);
		case "assignCell":
			return assignCell(state, action.row, action.col, action.optionId);
	}
}

// ── Presentational helpers ────────────────────────────────────────────────────

function gridCellStyle(row: number, col: number): CSSProperties {
	return {
		"--editor-cell-row": String(row + 1),
		"--editor-cell-col": String(col + 1),
	} as CSSProperties;
}

interface DimRowProps {
	label: string;
	value: number;
	onChange: (v: number) => void;
	cls: (suffix?: string, ...parts: string[]) => string;
}

const DimRow = memo(function DimRow({ label, value, onChange, cls }: DimRowProps) {
	const minusDisabled = value <= MIN_DIM;
	const plusDisabled = value >= MAX_DIM;
	return (
		<div className={cls("dim-row")}>
			<span className={cls("dim-label")}>{label}</span>
			<button
				type="button"
				className={cls("dim-btn")}
				disabled={minusDisabled}
				onClick={() => {
					if (!minusDisabled) onChange(value - 1);
				}}
			>
				<ObsidianIcon icon="minus" />
			</button>
			<span className={cls("dim-value")}>{value}</span>
			<button
				type="button"
				className={cls("dim-btn")}
				disabled={plusDisabled}
				onClick={() => {
					if (!plusDisabled) onChange(value + 1);
				}}
			>
				<ObsidianIcon icon="plus" />
			</button>
		</div>
	);
});

// ── Main component ────────────────────────────────────────────────────────────

export const LayoutEditorContent = memo(function LayoutEditorContent({
	initialState,
	cellPalette,
	onApply,
	onCancel,
}: LayoutEditorContentProps) {
	const app = useApp();
	const { cls, cssPrefix } = useScopedStyles("grid-editor", buildGridStyles);

	const [staged, dispatch] = useReducer(layoutEditorReducer, initialState, cloneGridState);

	const paletteMap = useMemo(() => new Map(cellPalette.map((o) => [o.id, o])), [cellPalette]);
	const usedIds = useMemo(() => new Set(staged.cells.map((c) => c.optionId)), [staged.cells]);
	const occupiedKeys = useMemo(() => new Set(staged.cells.map((c) => `${c.row}:${c.col}`)), [staged.cells]);

	const previewStyle: CSSProperties = {
		"--editor-columns": String(staged.columns),
		"--editor-rows": String(staged.rows),
	} as CSSProperties;

	const handleColumnsChange = useCallback((columns: number) => dispatch({ type: "setColumns", columns }), []);
	const handleRowsChange = useCallback((rows: number) => dispatch({ type: "setRows", rows }), []);
	const handleRemoveCell = useCallback((row: number, col: number) => dispatch({ type: "removeCell", row, col }), []);
	const handleEmptyClick = useCallback(
		(row: number, col: number) => {
			openCellPicker(app, {
				cssPrefix,
				row,
				col,
				cellPalette,
				usedIds,
				title: `Assign cell (${row + 1}, ${col + 1})`,
				onSelect: (optionId) => dispatch({ type: "assignCell", row, col, optionId }),
			});
		},
		[app, cssPrefix, cellPalette, usedIds]
	);
	const handleApply = useCallback(() => onApply(staged), [onApply, staged]);

	const occupiedSlots = staged.cells.map((cell) => {
		const option = paletteMap.get(cell.optionId);
		return (
			<div key={`occ-${cell.row}-${cell.col}`} className={cls("cell")} style={gridCellStyle(cell.row, cell.col)}>
				<span className={cls("cell-label")}>{option?.label ?? cell.optionId}</span>
				<button type="button" className={cls("cell-remove")} onClick={() => handleRemoveCell(cell.row, cell.col)}>
					<ObsidianIcon icon="x" />
				</button>
			</div>
		);
	});

	const emptySlots = Array.from({ length: staged.rows }, (_, r) =>
		Array.from({ length: staged.columns }, (_, c) => [r, c] as const)
	)
		.flat()
		.filter(([r, c]) => !occupiedKeys.has(`${r}:${c}`))
		.map(([r, c]) => (
			<div key={`empty-${r}-${c}`} className={cls("empty")} style={gridCellStyle(r, c)}>
				<button type="button" className={cls("empty-btn")} onClick={() => handleEmptyClick(r, c)}>
					<ObsidianIcon icon="plus" />
				</button>
			</div>
		));

	return (
		<div>
			<div className={cls("controls")}>
				<DimRow label="Columns" value={staged.columns} onChange={handleColumnsChange} cls={cls} />
				<DimRow label="Rows" value={staged.rows} onChange={handleRowsChange} cls={cls} />
			</div>
			<div className={cls("preview")} style={previewStyle}>
				{occupiedSlots}
				{emptySlots}
			</div>
			<div className={cls("actions")}>
				<button type="button" className={`${cls("btn")} ${cls("btn-cancel")}`} onClick={onCancel}>
					Cancel
				</button>
				<button type="button" className={`${cls("btn")} ${cls("btn-apply")}`} onClick={handleApply}>
					Apply
				</button>
			</div>
		</div>
	);
});

// ── Public modal opener ───────────────────────────────────────────────────────

export interface OpenLayoutEditorOptions {
	initialState: GridLayoutState;
	cellPalette: CellOption[];
	cssPrefix: string;
	onApply: (newState: GridLayoutState) => void;
}

export function openLayoutEditor(app: App, options: OpenLayoutEditorOptions): void {
	const { initialState, cellPalette, cssPrefix, onApply } = options;
	showReactModal({
		app,
		cls: `${cssPrefix}grid-editor-modal`,
		title: "Layout Editor",
		cssPrefix,
		testIdPrefix: cssPrefix,
		render: (close) => (
			<LayoutEditorContent
				initialState={initialState}
				cellPalette={cellPalette}
				onApply={(state) => {
					onApply(state);
					close();
				}}
				onCancel={close}
			/>
		),
	});
}
