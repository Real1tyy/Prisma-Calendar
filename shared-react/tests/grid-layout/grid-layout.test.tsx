import type { GridLayoutHandle, GridLayoutState } from "@real1ty-obsidian-plugins";
import { waitFor } from "@testing-library/react";
import type { Plugin } from "obsidian";
import { createRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const registerGridCommandsMock = vi.fn();
vi.mock("../../src/grid-layout/commands", () => ({
	registerGridCommands: registerGridCommandsMock,
}));

const { GridLayout } = await import("../../src/grid-layout/grid-layout");
const { Cell } = await import("../../src/grid-layout/cell");
const { renderWithProviders } = await import("../harness/render-with-providers");

const STABLE_APP = {} as never;

beforeEach(() => {
	registerGridCommandsMock.mockReset();
});

afterEach(() => {
	registerGridCommandsMock.mockReset();
});

describe("GridLayout (React-native engine)", () => {
	it("renders an empty grid container with the configured cssPrefix", () => {
		const { container } = renderWithProviders(
			<GridLayout cssPrefix="test-" columns={2} rows={2} data-testid="my-grid" />
		);
		const grid = container.querySelector(".test-grid") as HTMLElement | null;
		expect(grid).not.toBeNull();
		const root = container.querySelector('[data-testid="my-grid"]') as HTMLElement | null;
		expect(root).toBe(grid);
	});

	it("forwards passthrough HTML attributes to the root", () => {
		const { container } = renderWithProviders(
			<GridLayout
				cssPrefix="test-"
				columns={1}
				rows={1}
				data-testid="grid"
				className="my-class"
				style={{ flex: "1 1 auto" }}
			/>
		);
		const el = container.querySelector('[data-testid="grid"]') as HTMLElement | null;
		expect(el).not.toBeNull();
		expect(el?.classList.contains("my-class")).toBe(true);
		expect(el?.style.flex).toBe("1 1 auto");
	});

	// Regression: consumer `style` was being spread via {...rest} AFTER the engine
	// applied `style={gridStyle}`. React's last-write-wins meant the consumer's
	// style object replaced the engine's, dropping --grid-columns / --grid-rows.
	// Every consumer passes `style={{ flex: '1 1 auto', minHeight: 0 }}`, so the
	// CSS variables never made it to the DOM — the grid silently fell back to
	// `repeat(2, 1fr)` regardless of `columns` / `rows` props. dual-daily/1-row
	// layouts rendered as 2×2 grids, and saved rowSizes were ignored.
	it("merges consumer style with internal CSS vars (does not let style override --grid-columns/--grid-rows)", () => {
		const { container } = renderWithProviders(
			<GridLayout cssPrefix="t-" columns={2} rows={1} data-testid="grid" style={{ flex: "1 1 auto", minHeight: 0 }}>
				<Cell label="A">a</Cell>
				<Cell label="B">b</Cell>
			</GridLayout>
		);
		const el = container.querySelector('[data-testid="grid"]') as HTMLElement | null;
		expect(el).not.toBeNull();
		expect(el?.style.flex).toBe("1 1 auto");
		expect(el?.style.minHeight).toBe("0");
		expect(el?.style.getPropertyValue("--grid-columns")).toBe("repeat(2, 1fr)");
		expect(el?.style.getPropertyValue("--grid-rows")).toBe("repeat(1, auto)");
	});

	it("preserves rowSizes from initialState in --grid-rows (track mode)", () => {
		const initialState: GridLayoutState = {
			columns: 2,
			rows: 2,
			cells: [],
			rowSizes: [0.65, 0.35],
		};
		const { container } = renderWithProviders(
			<GridLayout
				cssPrefix="t-"
				columns={2}
				rows={2}
				resizable="track"
				initialState={initialState}
				data-testid="grid"
				style={{ flex: "1 1 auto", minHeight: 0 }}
			>
				<Cell label="A">a</Cell>
				<Cell label="B">b</Cell>
			</GridLayout>
		);
		const el = container.querySelector('[data-testid="grid"]') as HTMLElement | null;
		expect(el?.style.getPropertyValue("--grid-rows")).toBe("0.65fr 0.35fr");
	});

	it("renders <Cell> children directly as React subtrees — no createRoot, no render(cellEl) shim", () => {
		const { container } = renderWithProviders(
			<GridLayout cssPrefix="t-" columns={2} rows={1}>
				<Cell label="Alpha">
					<span data-testid="alpha-content">Alpha content</span>
				</Cell>
				<Cell label="Beta">
					<span data-testid="beta-content">Beta content</span>
				</Cell>
			</GridLayout>
		);
		expect(container.querySelector('[data-testid="alpha-content"]')?.textContent).toBe("Alpha content");
		expect(container.querySelector('[data-testid="beta-content"]')?.textContent).toBe("Beta content");
	});

	it("invokes onStateChange when the layout mutates", async () => {
		const onStateChange = vi.fn();
		const ref = createRef<GridLayoutHandle>();
		renderWithProviders(
			<GridLayout cssPrefix="t-" columns={2} rows={1} onStateChange={onStateChange} handleRef={ref}>
				<Cell label="A">x</Cell>
			</GridLayout>
		);
		ref.current?.resize(3, 2);
		await waitFor(() => expect(onStateChange).toHaveBeenCalled());
		const state = onStateChange.mock.calls.at(-1)?.[0] as GridLayoutState;
		expect(state.columns).toBe(3);
		expect(state.rows).toBe(2);
	});

	it("uses the latest onStateChange ref without rebuilding the engine", async () => {
		const first = vi.fn();
		const second = vi.fn();
		const ref = createRef<GridLayoutHandle>();
		const { rerender } = renderWithProviders(
			<GridLayout cssPrefix="t-" columns={1} rows={1} onStateChange={first} handleRef={ref} />
		);
		rerender(<GridLayout cssPrefix="t-" columns={1} rows={1} onStateChange={second} handleRef={ref} />);
		ref.current?.resize(2, 2);
		await waitFor(() => expect(second).toHaveBeenCalled());
		expect(first).not.toHaveBeenCalled();
	});

	it("registers grid commands when the `commands` prop is provided", () => {
		const plugin = { addCommand: vi.fn() } as unknown as Plugin;
		renderWithProviders(
			<GridLayout cssPrefix="t-" columns={1} rows={1} commands={{ plugin, id: "my-grid", label: "My Grid" }} />
		);
		expect(registerGridCommandsMock).toHaveBeenCalledTimes(1);
		expect(registerGridCommandsMock).toHaveBeenCalledWith(plugin, "my-grid", "My Grid", expect.any(Object));
	});

	it("does NOT register commands when the prop is omitted", () => {
		renderWithProviders(<GridLayout cssPrefix="t-" columns={1} rows={1} />);
		expect(registerGridCommandsMock).not.toHaveBeenCalled();
	});

	it("passes the handle to onReady and runs the returned cleanup on unmount", () => {
		const customCleanup = vi.fn();
		const onReady = vi.fn(() => customCleanup);
		const { unmount } = renderWithProviders(<GridLayout cssPrefix="t-" columns={1} rows={1} onReady={onReady} />);
		expect(onReady).toHaveBeenCalled();
		const handle = onReady.mock.calls[0]?.[0] as GridLayoutHandle;
		expect(handle.columns).toBe(1);
		unmount();
		expect(customCleanup).toHaveBeenCalledTimes(1);
	});

	it("exposes the imperative handle via the handleRef prop", () => {
		const ref = createRef<GridLayoutHandle>();
		renderWithProviders(<GridLayout cssPrefix="t-" columns={3} rows={2} handleRef={ref} />);
		expect(ref.current?.columns).toBe(3);
		expect(ref.current?.rows).toBe(2);
	});

	it("auto-wires React modal openers when `app` is provided", () => {
		const ref = createRef<GridLayoutHandle>();
		renderWithProviders(
			<GridLayout app={STABLE_APP} cssPrefix="t-" columns={1} rows={1} handleRef={ref}>
				<Cell label="X">x</Cell>
			</GridLayout>
		);
		expect(() => ref.current?.showLayoutEditor()).not.toThrow();
	});

	it("does not tear down the engine on unrelated parent re-renders", () => {
		const ref = createRef<GridLayoutHandle>();
		function Wrapper() {
			const [tick, setTick] = useState(0);
			return (
				<>
					<button type="button" onClick={() => setTick(tick + 1)}>
						bump-{tick}
					</button>
					<GridLayout cssPrefix="t-" columns={2} rows={1} handleRef={ref} />
				</>
			);
		}
		const { container } = renderWithProviders(<Wrapper />);
		const initialHandle = ref.current;
		expect(initialHandle).toBeTruthy();
		(container.querySelector("button") as HTMLButtonElement).click();
		expect(ref.current).toBe(initialHandle);
	});
});
