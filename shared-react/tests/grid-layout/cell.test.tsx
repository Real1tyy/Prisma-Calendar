import type { GridLayoutHandle } from "@real1ty-obsidian-plugins-react";
import { screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { Cell, walkCellChildren } from "../../src/grid-layout/cell";
import { GridLayout } from "../../src/grid-layout/grid-layout";
import { renderWithProviders } from "../harness/render-with-providers";

describe("walkCellChildren", () => {
	it("extracts label, id, and inherits id from kebab(label) when omitted", () => {
		const specs = walkCellChildren(
			<>
				<Cell label="Chart">x</Cell>
				<Cell label="Top Items">y</Cell>
				<Cell id="custom" label="Other">
					z
				</Cell>
			</>
		);
		expect(specs).toHaveLength(3);
		expect(specs[0].id).toBe("chart");
		expect(specs[1].id).toBe("top-items");
		expect(specs[2].id).toBe("custom");
	});

	it("ignores non-<Cell> children", () => {
		const specs = walkCellChildren(
			<>
				<Cell label="A">x</Cell>
				<div>not a cell</div>
				<Cell label="B">y</Cell>
				{null}
				{false}
				{"string"}
			</>
		);
		expect(specs.map((s) => s.id)).toEqual(["a", "b"]);
	});

	it("supports conditional rendering — falsy children skipped without error", () => {
		const condition = false;
		const specs = walkCellChildren(
			<>
				<Cell label="A">x</Cell>
				{condition && <Cell label="B">y</Cell>}
				<Cell label="C">z</Cell>
			</>
		);
		expect(specs.map((s) => s.id)).toEqual(["a", "c"]);
	});

	it("throws on duplicate ids (label collision)", () => {
		expect(() =>
			walkCellChildren(
				<>
					<Cell label="Same">x</Cell>
					<Cell label="Same">y</Cell>
				</>
			)
		).toThrow(/appears more than once/);
	});

	it("captures paletteOnly", () => {
		const specs = walkCellChildren(
			<>
				<Cell label="Placed">x</Cell>
				<Cell label="Pool" paletteOnly>
					y
				</Cell>
			</>
		);
		expect(specs[0].paletteOnly).toBe(false);
		expect(specs[1].paletteOnly).toBe(true);
	});

	it("forwards row, col, rowSpan, colSpan overrides", () => {
		const specs = walkCellChildren(
			<>
				<Cell label="A" row={1} col={2} rowSpan={2} colSpan={3}>
					x
				</Cell>
			</>
		);
		expect(specs[0]).toMatchObject({ row: 1, col: 2, rowSpan: 2, colSpan: 3 });
	});
});

describe("<Cell> children API in <GridLayout>", () => {
	it("infers row-major positions for children that omit row/col", () => {
		renderWithProviders(
			<GridLayout cssPrefix="t-" columns={2} rows={2}>
				<Cell label="A">
					<span data-testid="a">A</span>
				</Cell>
				<Cell label="B">
					<span data-testid="b">B</span>
				</Cell>
				<Cell label="C">
					<span data-testid="c">C</span>
				</Cell>
				<Cell label="D">
					<span data-testid="d">D</span>
				</Cell>
			</GridLayout>
		);
		// Cell <div>s carry data-row/data-col.
		const cellA = screen.getByTestId("a").closest("[data-row]") as HTMLElement;
		const cellD = screen.getByTestId("d").closest("[data-row]") as HTMLElement;
		expect(cellA.dataset.row).toBe("0");
		expect(cellA.dataset.col).toBe("0");
		expect(cellD.dataset.row).toBe("1");
		expect(cellD.dataset.col).toBe("1");
	});

	it("respects explicit row/col overrides on a <Cell>", () => {
		renderWithProviders(
			<GridLayout cssPrefix="t-" columns={2} rows={2}>
				<Cell label="A" row={1} col={1}>
					<span data-testid="a">A</span>
				</Cell>
			</GridLayout>
		);
		const cellA = screen.getByTestId("a").closest("[data-row]") as HTMLElement;
		expect(cellA.dataset.row).toBe("1");
		expect(cellA.dataset.col).toBe("1");
	});

	it("paletteOnly cell isn't placed initially", () => {
		const ref = createRef<GridLayoutHandle>();
		renderWithProviders(
			<GridLayout cssPrefix="t-" columns={2} rows={1} handleRef={ref}>
				<Cell label="Visible">
					<span data-testid="visible">V</span>
				</Cell>
				<Cell label="Hidden" paletteOnly>
					<span data-testid="hidden">H</span>
				</Cell>
			</GridLayout>
		);
		expect(screen.getByTestId("visible")).toBeInTheDocument();
		expect(screen.queryByTestId("hidden")).toBeNull();
		// Placement count via state: only Visible is placed.
		const state = ref.current?.getState();
		expect(state?.cells.map((c) => c.optionId)).toEqual(["visible"]);
	});

	it("updates the React subtree natively when the parent re-renders new content (no remount)", () => {
		const render = vi.fn();
		function ChildCounter({ tick }: { tick: number }) {
			render();
			return <span data-testid="counter">tick={tick}</span>;
		}
		function Harness({ tick }: { tick: number }) {
			return (
				<GridLayout cssPrefix="t-" columns={1} rows={1}>
					<Cell label="A">
						<ChildCounter tick={tick} />
					</Cell>
				</GridLayout>
			);
		}
		const { rerender } = renderWithProviders(<Harness tick={0} />);
		expect(screen.getByTestId("counter").textContent).toBe("tick=0");
		rerender(<Harness tick={1} />);
		expect(screen.getByTestId("counter").textContent).toBe("tick=1");
		rerender(<Harness tick={2} />);
		expect(screen.getByTestId("counter").textContent).toBe("tick=2");
		// React reconciled the child in place — no unmount-and-remount of the React tree
		// happens between renders, so the render count grows by 1 per tick (no double-mount).
		expect(render).toHaveBeenCalledTimes(3);
	});
});
