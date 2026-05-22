import { describe, expect, it } from "vitest";

import { renderMarkdownReport } from "../../src/testing/stress/reporters/markdown";
import { makeRunReport, summary } from "./stress-fixtures";

describe("renderMarkdownReport", () => {
	it("renders the header with scenario, profile and status", () => {
		const md = renderMarkdownReport(makeRunReport({ status: "fail" }));
		expect(md).toContain("# Stress Report — calendar-navigation (small)");
		expect(md).toContain("Status: **FAIL**");
	});

	it("renders a regressed row with the marker", () => {
		const md = renderMarkdownReport(
			makeRunReport({
				regressions: [
					{
						metric: "nav",
						kind: "timing",
						baseline: 100,
						candidate: 200,
						delta: 100,
						deltaPct: 100,
						unit: "ms",
						regressed: true,
					},
				],
			})
		);
		expect(md).toContain("REGRESSED");
		expect(md).toContain("+100%");
	});

	it("shows the no-baseline message when there are no regressions", () => {
		const md = renderMarkdownReport(makeRunReport());
		expect(md).toContain("No baseline comparison");
	});

	it("shows the all-clear message when there are no budget failures", () => {
		expect(renderMarkdownReport(makeRunReport())).toContain("All budgets within limits");
	});

	it("lists timing stages and counts", () => {
		const md = renderMarkdownReport(
			makeRunReport({
				timings: { "recurrence.expand": summary(144, { count: 24 }) },
				counts: { "events.indexed": 5000 },
			})
		);
		expect(md).toContain("recurrence.expand");
		expect(md).toContain("events.indexed");
		expect(md).toContain("5000");
	});

	it("renders the top self-time digest with a function row and location", () => {
		const md = renderMarkdownReport(
			makeRunReport({
				profileDigest: {
					sampleCount: 120,
					durationMs: 350,
					totalSelfTimeMs: 350,
					topSelfTime: [
						{
							functionName: "getNextOccurrence",
							url: "file:///x/recurring-event-manager.ts",
							line: 611,
							location: "recurring-event-manager.ts:611",
							selfTimeMs: 712,
							selfPct: 38.2,
							hitCount: 712,
						},
					],
				},
			})
		);
		expect(md).toContain("Top self-time (CPU profile)");
		expect(md).toContain("getNextOccurrence");
		expect(md).toContain("recurring-event-manager.ts:611");
		expect(md).toContain("38.2%");
	});

	it("shows the no-profile message when no digest is attached", () => {
		expect(renderMarkdownReport(makeRunReport())).toContain("No CPU profile captured");
	});
});
