import type { CellOption, CellPlacement, GridLayoutConfig, GridLayoutHandle } from "@real1ty-obsidian-plugins";
import type { Plugin } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createImperativeGridLayoutMock = vi.fn();
const registerGridCommandsMock = vi.fn();

vi.mock("@real1ty-obsidian-plugins", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return {
		...actual,
		createGridLayout: createImperativeGridLayoutMock,
		registerGridCommands: registerGridCommandsMock,
	};
});

const { GridLayout } = await import("../../src/grid-layout/grid-layout");
const { renderWithProviders } = await import("../harness/render-with-providers");

const STABLE_APP = {} as never;

interface CapturedRun {
	container: HTMLElement;
	config: GridLayoutConfig;
	handle: { destroy: ReturnType<typeof vi.fn> };
}

let runs: CapturedRun[] = [];

beforeEach(() => {
	runs = [];
	createImperativeGridLayoutMock.mockReset();
	registerGridCommandsMock.mockReset();
	createImperativeGridLayoutMock.mockImplementation((container: HTMLElement, config: GridLayoutConfig) => {
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
			getState: vi.fn(() => ({
				columns: config.columns,
				rows: config.rows,
				cells: [],
				columnSizes: undefined,
				rowSizes: undefined,
				cellColumnSizes: undefined,
				cellRowSizes: undefined,
			})),
		};
		runs.push({ container, config, handle });
		return handle as unknown as GridLayoutHandle;
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
	it("creates the imperative engine on mount with forwarded config", () => {
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
		expect(runs[0].container).toBeInstanceOf(HTMLDivElement);
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

	it("destroys the imperative handle on unmount", () => {
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

	it("re-creates the engine when structural props change by reference", () => {
		const palette: CellOption[] = [{ id: "x", label: "X", render: vi.fn() }];
		const { rerender } = renderWithProviders(
			<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} cellPalette={palette} />
		);
		expect(runs).toHaveLength(1);

		const newPalette: CellOption[] = [{ id: "y", label: "Y", render: vi.fn() }];
		rerender(<GridLayout app={STABLE_APP} cssPrefix="test-" columns={1} rows={1} cellPalette={newPalette} />);
		expect(runs).toHaveLength(2);
		expect(runs[0].handle.destroy).toHaveBeenCalled();
	});

	it("auto-wires the React modal openers via createGridLayout wrapper", () => {
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
});
