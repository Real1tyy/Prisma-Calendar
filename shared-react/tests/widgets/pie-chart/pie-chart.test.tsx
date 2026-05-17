import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { type ChartJSCtor, ChartTitle, PieCanvas, PieChart } from "../../../src/widgets/pie-chart/pie-chart";
import { renderReact, type RenderReactResult } from "../../helpers/render-react";

const PREFIX = "prisma-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

function makeFakeChartJS(): {
	ctor: ChartJSCtor;
	destroy: ReturnType<typeof vi.fn>;
	ctorSpy: ReturnType<typeof vi.fn>;
} {
	const destroy = vi.fn();
	const ctorSpy = vi.fn();
	class FakeChart {
		constructor(canvas: HTMLCanvasElement, config: unknown) {
			ctorSpy(canvas, config);
		}
		destroy = destroy;
	}
	// biome-ignore lint/suspicious/noExplicitAny: fake constructor doesn't need to mirror the full chart.js typings
	return { ctor: FakeChart as unknown as ChartJSCtor, destroy, ctorSpy };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

describe("ChartTitle", () => {
	it("renders text inside an h3", () => {
		renderInTheme(<ChartTitle text="Daily hours" />);
		const heading = screen.getByRole("heading", { level: 3 });
		expect(heading).toHaveTextContent("Daily hours");
		expect(heading).toHaveClass(`${PREFIX}chart-title`);
	});
});

describe("PieCanvas", () => {
	it("constructs a chart.js instance on mount with the canvas + config", () => {
		const { ctor, ctorSpy } = makeFakeChartJS();
		const data = new Map([
			["A", 1],
			["B", 2],
		]);
		const { container } = renderInTheme(<PieCanvas data={data} ChartJS={ctor} />);

		expect(ctorSpy).toHaveBeenCalledTimes(1);
		expect(ctorSpy.mock.calls[0][0]).toBe(container.querySelector("canvas"));
		expect(ctorSpy.mock.calls[0][1].type).toBe("pie");
		expect(ctorSpy.mock.calls[0][1].data.labels).toEqual(["A", "B"]);
	});

	it("destroys the chart on unmount", () => {
		const { ctor, destroy } = makeFakeChartJS();
		const data = new Map([["A", 1]]);
		const { unmount } = renderInTheme(<PieCanvas data={data} ChartJS={ctor} />);

		unmount();
		expect(destroy).toHaveBeenCalledTimes(1);
	});

	it("destroys the old chart and constructs a new one when data changes", () => {
		const { ctor, ctorSpy, destroy } = makeFakeChartJS();
		const { rerender } = renderInTheme(<PieCanvas data={new Map([["A", 1]])} ChartJS={ctor} />);

		rerender(
			<PieCanvas
				data={
					new Map([
						["A", 1],
						["B", 2],
					])
				}
				ChartJS={ctor}
			/>
		);

		expect(destroy).toHaveBeenCalledTimes(1);
		expect(ctorSpy).toHaveBeenCalledTimes(2);
	});
});

// ─── Composition ─────────────────────────────────────────────────────────────

describe("PieChart (composition)", () => {
	it("renders the title + canvas when data has values", () => {
		const { ctor, ctorSpy } = makeFakeChartJS();
		const { container } = renderInTheme(<PieChart data={new Map([["A", 5]])} ChartJS={ctor} title="Hours" />);

		expect(screen.getByRole("heading", { name: "Hours" })).toBeInTheDocument();
		expect(container.querySelector("canvas")).not.toBeNull();
		expect(ctorSpy).toHaveBeenCalledTimes(1);
	});

	it("renders the empty hint and skips the canvas when data is empty", () => {
		const { ctor, ctorSpy } = makeFakeChartJS();
		const { container } = renderInTheme(<PieChart data={new Map()} ChartJS={ctor} emptyText="No hours tracked" />);

		expect(screen.getByText("No hours tracked")).toBeInTheDocument();
		expect(container.querySelector("canvas")).toBeNull();
		expect(ctorSpy).not.toHaveBeenCalled();
	});

	it("omits the title element when `title` is not provided", () => {
		const { ctor } = makeFakeChartJS();
		renderInTheme(<PieChart data={new Map([["A", 1]])} ChartJS={ctor} />);

		expect(screen.queryByRole("heading")).toBeNull();
	});

	it("collapses entries beyond maxLegendItems into an 'Other (N)' slice", () => {
		const { ctor, ctorSpy } = makeFakeChartJS();
		const data = new Map([
			["A", 1],
			["B", 1],
			["C", 1],
			["D", 1],
		]);
		renderInTheme(<PieChart data={data} ChartJS={ctor} maxLegendItems={2} />);

		const labels = ctorSpy.mock.calls[0][1].data.labels as string[];
		expect(labels).toEqual(["A", "B", "Other (2)"]);
	});
});
