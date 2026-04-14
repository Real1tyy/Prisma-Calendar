/**
 * Approval snapshots for `renderHeatmapSVG` and `renderHeatmapLegend`.
 *
 * The heatmap renderer builds an SVG with month/day labels and one cell per
 * day of a year or month. Cell fill comes from a quantile bucket of the day's
 * event count; these tests pin the exact SVG output so layout, label placement,
 * class names, and aria/title metadata regressions surface in the diff.
 */
import { renderToApprovalString } from "@real1ty-obsidian-plugins/testing";
import { describe, expect, it } from "vitest";

import { buildHeatmapDataset } from "../../src/components/heatmap/heatmap-data";
import { renderHeatmapLegend, renderHeatmapSVG } from "../../src/components/heatmap/heatmap-renderer";
import { createMockTimedEvent } from "../fixtures/event-fixtures";

function container(): HTMLElement {
	return document.createElement("div");
}

describe("renderHeatmapSVG — approval snapshots", () => {
	it("yearly mode with no events — all cells show the empty bucket", async () => {
		const el = container();
		renderHeatmapSVG(el, buildHeatmapDataset([]), {
			mode: "yearly",
			year: 2026,
			firstDayOfWeek: 0,
		});

		await expect(renderToApprovalString(el, { keepStyles: true })).toMatchFileSnapshot(
			"__snapshots__/heatmap-yearly-empty.approved.html"
		);
	});

	it("yearly mode with a scattered activity pattern", async () => {
		const events = [
			createMockTimedEvent({ id: "a", start: "2026-01-15T10:00:00" }),
			createMockTimedEvent({ id: "b", start: "2026-01-15T14:00:00" }),
			createMockTimedEvent({ id: "c", start: "2026-03-10T09:00:00" }),
			createMockTimedEvent({ id: "d", start: "2026-06-01T10:00:00" }),
			createMockTimedEvent({ id: "e", start: "2026-06-01T12:00:00" }),
			createMockTimedEvent({ id: "f", start: "2026-06-01T15:00:00" }),
			createMockTimedEvent({ id: "g", start: "2026-12-25T10:00:00" }),
		];
		const el = container();
		renderHeatmapSVG(el, buildHeatmapDataset(events), {
			mode: "yearly",
			year: 2026,
			firstDayOfWeek: 0,
		});

		await expect(renderToApprovalString(el, { keepStyles: true })).toMatchFileSnapshot(
			"__snapshots__/heatmap-yearly-scattered.approved.html"
		);
	});

	it("monthly mode renders a week-of-month grid with day numbers", async () => {
		const events = [
			createMockTimedEvent({ id: "a", start: "2026-04-10T10:00:00" }),
			createMockTimedEvent({ id: "b", start: "2026-04-15T10:00:00" }),
			createMockTimedEvent({ id: "c", start: "2026-04-15T11:00:00" }),
			createMockTimedEvent({ id: "d", start: "2026-04-20T10:00:00" }),
		];
		const el = container();
		renderHeatmapSVG(el, buildHeatmapDataset(events), {
			mode: "monthly",
			year: 2026,
			month: 4,
			firstDayOfWeek: 0,
		});

		await expect(renderToApprovalString(el, { keepStyles: true })).toMatchFileSnapshot(
			"__snapshots__/heatmap-monthly.approved.html"
		);
	});

	it("applies category color via rgba opacity when provided", async () => {
		const events = [
			createMockTimedEvent({ id: "a", start: "2026-04-15T10:00:00" }),
			createMockTimedEvent({ id: "b", start: "2026-04-15T11:00:00" }),
			createMockTimedEvent({ id: "c", start: "2026-04-20T10:00:00" }),
		];
		const el = container();
		renderHeatmapSVG(el, buildHeatmapDataset(events), {
			mode: "monthly",
			year: 2026,
			month: 4,
			firstDayOfWeek: 0,
			categoryColor: "#ff6600",
		});

		await expect(renderToApprovalString(el, { keepStyles: true })).toMatchFileSnapshot(
			"__snapshots__/heatmap-monthly-category-color.approved.html"
		);
	});

	it("shifts day labels when firstDayOfWeek is Monday", async () => {
		const el = container();
		renderHeatmapSVG(el, buildHeatmapDataset([]), {
			mode: "monthly",
			year: 2026,
			month: 4,
			firstDayOfWeek: 1,
		});

		await expect(renderToApprovalString(el, { keepStyles: true })).toMatchFileSnapshot(
			"__snapshots__/heatmap-monthly-monday-start.approved.html"
		);
	});

	it("returns an empty grid when monthly mode is missing a month", () => {
		const el = container();
		const grid = renderHeatmapSVG(el, buildHeatmapDataset([]), {
			mode: "monthly",
			year: 2026,
			firstDayOfWeek: 0,
		});

		expect(grid.cells).toEqual([]);
		// Renderer short-circuits before creating any SVG — container stays empty.
		expect(el.children).toHaveLength(0);
	});
});

describe("renderHeatmapLegend — approval snapshots", () => {
	it("renders legend swatches with correct bucket labels", async () => {
		const el = container();
		renderHeatmapLegend(el, [2, 4, 6]);

		await expect(renderToApprovalString(el, { keepStyles: true })).toMatchFileSnapshot(
			"__snapshots__/heatmap-legend-default.approved.html"
		);
	});

	it("renders legend swatches tinted by the category color", async () => {
		const el = container();
		renderHeatmapLegend(el, [1, 3, 5], "#4488ff");

		await expect(renderToApprovalString(el, { keepStyles: true })).toMatchFileSnapshot(
			"__snapshots__/heatmap-legend-category.approved.html"
		);
	});
});
