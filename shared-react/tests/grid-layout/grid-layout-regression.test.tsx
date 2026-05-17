import type { CellPlacement } from "@real1ty-obsidian-plugins-react";
import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GridLayout } from "../../src/grid-layout/grid-layout";
import { renderWithProviders } from "../harness/render-with-providers";

/**
 * Regression tests for the React-into-React-owned-div crash that surfaced as
 * `NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be
 * removed is not a child of this node` in the Prisma-Calendar dashboard.
 *
 * Root cause: <GridLayout> previously called `createRoot()` inside its own
 * useEffect on a div the outer React tree owned. The inner root and the outer
 * root both believed they owned the same DOM, and mount/unmount races during
 * reconciliation produced `removeChild: not a child` crashes.
 *
 * The fix: <GridLayout> renders <GridEngineView> as direct JSX. Only the
 * imperative `createGridLayout(container, config)` API uses createRoot, and
 * that path is reserved for non-React consumers whose container isn't managed
 * by an outer React tree.
 *
 * These tests use the REAL engine (no mocks) so the crash repros if the bug
 * regresses.
 */
describe("GridLayout — runtime DOM safety", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
	const errors: unknown[][] = [];
	const warnings: unknown[][] = [];

	beforeEach(() => {
		errors.length = 0;
		warnings.length = 0;
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
			errors.push(args);
		});
		consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
			warnings.push(args);
		});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
	});

	function expectNoDomCrash(): void {
		const offending = errors.filter((args) => {
			const msg = args.join(" ");
			return (
				msg.includes("removeChild") ||
				msg.includes("not a child of this node") ||
				msg.includes("createRoot") ||
				msg.includes("hydrateRoot")
			);
		});
		expect(offending, `unexpected DOM/React errors:\n${offending.map((a) => a.join(" ")).join("\n")}`).toHaveLength(0);
	}

	function makeImperativeCell(id: string, row: number, col: number): CellPlacement {
		// Mirrors the consumer pattern: render() appends DOM imperatively.
		return {
			id,
			label: id,
			row,
			col,
			render: (cellEl) => {
				const inner = document.createElement("div");
				inner.className = `inner-${id}`;
				inner.textContent = `Cell ${id}`;
				cellEl.appendChild(inner);
			},
		};
	}

	function makeReactMountingCell(id: string, row: number, col: number, label = `Content ${id}`): CellPlacement {
		// Mirrors the Prisma-Calendar dashboard pattern: render() spawns an
		// inner createRoot inside the cell div (renderReactInline-style).
		// Matches shared-react/src/react-inline.tsx exactly — no flushSync in cleanup.
		let inner: Root | null = null;
		return {
			id,
			label: id,
			row,
			col,
			render: (cellEl) => {
				inner = createRoot(cellEl);
				inner.render(<div data-testid={`inner-${id}`}>{label}</div>);
			},
			cleanup: () => {
				inner?.unmount();
				inner = null;
			},
		};
	}

	it("mounts and unmounts a multi-cell grid without DOM removal errors", () => {
		const cells = [
			makeImperativeCell("a", 0, 0),
			makeImperativeCell("b", 0, 1),
			makeImperativeCell("c", 1, 0),
			makeImperativeCell("d", 1, 1),
		];
		const { unmount } = renderWithProviders(
			<GridLayout cssPrefix="test-" columns={2} rows={2} cells={cells} dividers />
		);

		unmount();
		expectNoDomCrash();
	});

	it("mount → unmount → mount on the same container does not collide React roots", () => {
		const cells = [makeImperativeCell("a", 0, 0), makeImperativeCell("b", 0, 1)];

		const first = renderWithProviders(<GridLayout cssPrefix="test-" columns={2} rows={1} cells={cells} />);
		first.unmount();

		const second = renderWithProviders(<GridLayout cssPrefix="test-" columns={2} rows={1} cells={cells} />);
		second.unmount();

		expectNoDomCrash();
	});

	it("multi-cell grid whose cells mount nested React subtrees (Prisma-Calendar dashboard repro)", () => {
		// This is the exact pattern that crashed: each cell's render() does
		// createRoot(cellEl).render(<Component />). Without the fix, the outer
		// <GridLayout>'s inner createRoot collides with these per-cell inner
		// createRoots when the dashboard's bundle changes trigger reconciliation.
		const cells = [
			makeReactMountingCell("chart", 0, 0, "Chart"),
			makeReactMountingCell("ranking", 0, 1, "Ranking"),
			makeReactMountingCell("table", 1, 0, "Table"),
		];
		const { unmount } = renderWithProviders(
			<GridLayout cssPrefix="dash-" columns={2} rows={2} cells={cells} dividers resizable="track" />
		);

		unmount();
		expectNoDomCrash();
	});

	it("re-renders with changed cells reference do not tear down the engine", () => {
		// Mirrors what happens in dashboard when useBundleChanges fires:
		// the parent re-renders with a fresh cells array (new closures over new data).
		// Engine must survive; cells must refresh their render closures.
		function Harness({ tick }: { tick: number }) {
			const cells: CellPlacement[] = [
				{
					id: "a",
					label: "A",
					row: 0,
					col: 0,
					render: (cellEl) => {
						cellEl.textContent = `tick=${tick}`;
					},
				},
				{
					id: "b",
					label: "B",
					row: 0,
					col: 1,
					render: (cellEl) => {
						cellEl.textContent = `tick=${tick}`;
					},
				},
			];
			return <GridLayout cssPrefix="t-" columns={2} rows={1} cells={cells} />;
		}

		const { rerender, unmount } = renderWithProviders(<Harness tick={0} />);
		for (let i = 1; i <= 5; i++) {
			rerender(<Harness tick={i} />);
		}
		unmount();
		expectNoDomCrash();
	});

	it("parent state churn around a stable GridLayout does not crash", () => {
		// Reproduces the React reconciliation pressure where the outer tree
		// re-renders due to an unrelated state change. Pre-fix, this combined
		// with the inner createRoot to produce removeChild crashes.
		function Wrapper() {
			const [, setTick] = useState(0);
			useEffect(() => {
				let count = 0;
				const id = window.setInterval(() => {
					setTick(++count);
					if (count >= 3) window.clearInterval(id);
				}, 0);
				return () => window.clearInterval(id);
			}, []);

			const cells = [
				makeReactMountingCell("x", 0, 0, "X"),
				makeReactMountingCell("y", 0, 1, "Y"),
				makeReactMountingCell("z", 0, 2, "Z"),
			];

			return <GridLayout cssPrefix="ws-" columns={3} rows={1} cells={cells} />;
		}

		const { unmount } = renderWithProviders(<Wrapper />);
		unmount();
		expectNoDomCrash();
	});
});
