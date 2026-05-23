import { describe, expect, it } from "vitest";

import type { ProfileTreeNode } from "../../src/testing/stress/profile-tree";
import { renderHtmlReport } from "../../src/testing/stress/reporters/html";
import { makeRunReport, summary } from "./stress-fixtures";

describe("renderHtmlReport", () => {
	it("renders a self-contained document with header, status and stage timings", () => {
		const html = renderHtmlReport(
			makeRunReport({
				status: "fail",
				timings: { "scenario.navigateStep": summary(144, { count: 24 }) },
			})
		);
		expect(html.startsWith("<!doctype html>")).toBe(true);
		expect(html).toContain("Stress Report — calendar-navigation");
		expect(html).toContain("FAIL");
		expect(html).toContain("scenario.navigateStep");
	});

	it("omits the flame chart when no profile tree is supplied", () => {
		const html = renderHtmlReport(makeRunReport());
		expect(html).not.toContain('id="flame"');
		expect(html).toContain("window.__STRESS__ = null");
	});

	it("embeds the flame chart and inlines the call tree when a tree is supplied", () => {
		const tree: ProfileTreeNode = {
			name: "(root)",
			location: "(root)",
			selfMs: 0,
			totalMs: 10,
			children: [
				{ name: "getNextOccurrence", location: "recurring-event-manager.ts:611", selfMs: 8, totalMs: 8, children: [] },
			],
		};
		const html = renderHtmlReport(makeRunReport(), { profileTree: tree });
		expect(html).toContain('id="flame"');
		expect(html).toContain("getNextOccurrence");
		expect(html).toContain('"totalMs":10');
	});

	it("escapes angle brackets in inlined tree JSON so a name can't break out of the script tag", () => {
		const tree: ProfileTreeNode = {
			name: "</script><x>",
			location: "x",
			selfMs: 1,
			totalMs: 1,
			children: [],
		};
		const html = renderHtmlReport(makeRunReport(), { profileTree: tree });
		expect(html).not.toContain("</script><x>");
		expect(html).toContain("\\u003c/script>\\u003cx>");
	});
});
