import type { CellOption, CellPlacement, GridLayoutConfig, GridLayoutHandle } from "@real1ty-obsidian-plugins";
import type { Plugin } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createGridLayoutCoreMock = vi.fn();
const registerGridCommandsMock = vi.fn();
const GridEngineViewMock = vi.fn(() => null);

vi.mock("../../src/grid-layout/engine-core", () => ({
	createGridLayoutCore: createGridLayoutCoreMock,
}));

vi.mock("../../src/grid-layout/engine", () => ({
	GridEngineView: GridEngineViewMock,
}));

vi.mock("../../src/grid-layout/commands", () => ({
	registerGridCommands: registerGridCommandsMock,
}));

const { GridLayout } = await import("../../src/grid-layout/grid-layout");
const { renderWithProviders } = await import("../harness/render-with-providers");

const STABLE_APP = {} as never;

interface CapturedRun {
	config: GridLayoutConfig;
	handle: GridLayoutHandle;
}

let runs: CapturedRun[] = [];

beforeEach(() => {
	runs = [];
	createGridLayoutCoreMock.mockReset();
	registerGridCommandsMock.mockReset();
	GridEngineViewMock.mockClear();
	createGridLayoutCoreMock.mockImplementation((config: GridLayoutConfig) => {
		const handle = {
			destroy: vi.fn(),
			columns: config.columns,
			rows: config.rows,
			setCell: vi.fn(),
			setCellById: vi.fn(),
			clearCell: vi.fn(),
			getCellElement: vi.fn(),
			resize: vi.fn(),
			showCellPicker: vi.fn(),
			showLayoutEditor: vi.fn(),
		} as unknown as GridLayoutHandle;
		runs.push({ config, handle });
		return {
			handle,
			config,
			subscribe: () => () => {},
			getSnapshot: () => ({
				cols: config.columns,
				rows: config.rows,
				cells: [],
				ghostKeys: new Set(),
				columnSizes: undefined,
				rowSizes: undefined,
				cellColumnSizes: undefined,
				cellRowSizes: undefined,
				destroyed: false,
			}),
			setCallbacks: vi.fn(),
			registerElement: vi.fn(),
			commitColumnSizes: vi.fn(),
			commitRowSizes: vi.fn(),
			commitCellColumnSizes: vi.fn(),
			commitCellRowSizes: vi.fn(),
		};
	});
});

afterEach(() => {
	runs = [];
});

function makeCell(id: string, row: number, col: number): CellPlacement {
	return {
		id,
		label: id,
		row,
		col,
		render: vi.fn(),
	};
}

describe("GridLayout", () => {
	it("creates the engine core on mount with forwarded config", () => {
		const cells = [makeCell("a", 0, 0)];
		renderWithProviders(
			<GridLayout app={STABLE_APP} cssPrefix="test-" columns={2} rows={1} cells={cells} gap="12px" dividers />
		);

		expect(runs).toHaveLength(1);
		expect(runs[0].config).toMatchObject({
			cssPrefix: "test-",
			columns: 2,
			rows: 1,
			cells,
			gap: "12px",
			dividers: true,
		});
	});

	it("forwards passthrough HTML attributes to the container div", () => {
		const { container } = renderWithProviders(
			<GridLayout
				app={STABLE_APP}
				cssPrefix="test-"
				columns={1}
				rows={1}
				data-testid="my-grid"
				className="my-class"
				style={{ flex: "1 1 auto" }}
			/>
		);
		const el = container.querySelector('[data-testid="my-grid"]') as HTMLDivElement | null;
		expect(el).not.toBeNull();
		expect(el?.classList.contains("my-class")).toBe(true);
		expect(el?.style.flex).toBe("1 1 auto");
	});

	it("destroys the engine handle on unmount", () => {
		const { unmount } = renderWithProviders(<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} />);
		const handle = runs[0].handle;
		unmount();
		expect(handle.destroy).toHaveBeenCalledTimes(1);
	});

	it("invokes the latest onStateChange callback without re-creating the engine", () => {
		const firstOnStateChange = vi.fn();
		const secondOnStateChange = vi.fn();

		const { rerender } = renderWithProviders(
			<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} onStateChange={firstOnStateChange} />
		);
		expect(runs).toHaveLength(1);

		rerender(
			<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} onStateChange={secondOnStateChange} />
		);
		expect(runs).toHaveLength(1);

		const state = {
			columns: 1,
			rows: 1,
			cells: [],
			columnSizes: undefined,
			rowSizes: undefined,
			cellColumnSizes: undefined,
			cellRowSizes: undefined,
		};
		runs[0].config.onStateChange?.(state);
		expect(firstOnStateChange).not.toHaveBeenCalled();
		expect(secondOnStateChange).toHaveBeenCalledWith(state);
	});

	it("registers grid commands when commands prop is provided", () => {
		const plugin = { addCommand: vi.fn() } as unknown as Plugin;
		renderWithProviders(
			<GridLayout
				app={STABLE_APP}
				cssPrefix="test-"
				columns={1}
				rows={1}
				commands={{ plugin, id: "my-grid", label: "My Grid" }}
			/>
		);
		expect(registerGridCommandsMock).toHaveBeenCalledTimes(1);
		expect(registerGridCommandsMock).toHaveBeenCalledWith(plugin, "my-grid", "My Grid", expect.any(Object));
	});

	it("does not call registerGridCommands when commands prop is omitted", () => {
		renderWithProviders(<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} />);
		expect(registerGridCommandsMock).not.toHaveBeenCalled();
	});

	it("passes the handle to onReady and invokes its returned cleanup on unmount", () => {
		const customCleanup = vi.fn();
		const onReady = vi.fn(() => customCleanup);
		const { unmount } = renderWithProviders(
			<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} onReady={onReady} />
		);
		const handle = runs[0].handle;
		expect(onReady).toHaveBeenCalledWith(handle);
		unmount();
		expect(customCleanup).toHaveBeenCalledTimes(1);
		expect(handle.destroy).toHaveBeenCalledTimes(1);
	});

	it("keeps the engine durable across structural prop changes (no rebuild)", () => {
		const palette: CellOption[] = [{ id: "x", label: "X", render: vi.fn() }];
		const { rerender } = renderWithProviders(
			<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} cellPalette={palette} />
		);
		expect(runs).toHaveLength(1);

		const newPalette: CellOption[] = [{ id: "y", label: "Y", render: vi.fn() }];
		rerender(<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} cellPalette={newPalette} />);
		expect(runs).toHaveLength(1);
		expect(runs[0].handle.destroy).not.toHaveBeenCalled();
	});

	it("refreshes cell render closures via setCellById when cells reference changes", () => {
		const firstRender = vi.fn();
		const firstCleanup = vi.fn();
		const cellsV1 = [{ id: "a", label: "A", row: 0, col: 0, render: firstRender, cleanup: firstCleanup }];
		const { rerender } = renderWithProviders(
			<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} cells={cellsV1} />
		);
		expect(runs).toHaveLength(1);
		const handle = runs[0].handle;
		expect(handle.setCellById).not.toHaveBeenCalled();

		const secondRender = vi.fn();
		const secondCleanup = vi.fn();
		const cellsV2 = [{ id: "a", label: "A", row: 0, col: 0, render: secondRender, cleanup: secondCleanup }];
		rerender(<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} cells={cellsV2} />);

		expect(runs).toHaveLength(1);
		expect(handle.setCellById).toHaveBeenCalledWith("a", secondRender, secondCleanup);
	});

	it("auto-wires the React modal openers in the core config", () => {
		renderWithProviders(<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} cellPalette={[]} />);
		expect(runs[0].config.onOpenLayoutEditor).toBeTypeOf("function");
		expect(runs[0].config.onOpenCellPicker).toBeTypeOf("function");
	});

	it("forwards onCellChange via a stable ref", () => {
		const firstHandler = vi.fn();
		const secondHandler = vi.fn();

		const { rerender } = renderWithProviders(
			<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} onCellChange={firstHandler} />
		);
		rerender(<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} onCellChange={secondHandler} />);

		runs[0].config.onCellChange?.(0, 0, "cell-a");
		expect(firstHandler).not.toHaveBeenCalled();
		expect(secondHandler).toHaveBeenCalledWith(0, 0, "cell-a");
	});

	it("renders <GridEngineView> as a JSX child of the container (no nested createRoot)", () => {
		const { container } = renderWithProviders(
			<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} data-testid="grid-root" />
		);
		expect(GridEngineViewMock).toHaveBeenCalled();
		// The container div is the JSX-owned element; GridEngineView mounts inside it
		// as a child, not via an inner createRoot — so the outer React tree's reconciliation
		// is the single source of truth for this DOM subtree.
		const root = container.querySelector('[data-testid="grid-root"]');
		expect(root).not.toBeNull();
	});
});
