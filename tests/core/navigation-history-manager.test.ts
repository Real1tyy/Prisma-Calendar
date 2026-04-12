import { describe, expect, it } from "vitest";

import { createNavigationHistory, type NavigationEntry } from "../../src/core/navigation-history-manager";

function entry(viewType: string, isoDate: string): NavigationEntry {
	return { viewType, date: new Date(isoDate) };
}

describe("createNavigationHistory", () => {
	it("returns an empty history", () => {
		const history = createNavigationHistory();

		expect(history.current()).toBeNull();
		expect(history.size).toBe(0);
		expect(history.canGoBack()).toBe(false);
		expect(history.canGoForward()).toBe(false);
	});

	describe("equals semantics", () => {
		it("dedupes consecutive pushes with the same viewType and date", () => {
			const history = createNavigationHistory();

			history.push(entry("dayGridMonth", "2026-04-15T00:00:00Z"));
			history.push(entry("dayGridMonth", "2026-04-15T00:00:00Z"));

			expect(history.size).toBe(1);
		});

		it("dedupes even when date is a distinct Date instance with the same timestamp", () => {
			const history = createNavigationHistory();
			const iso = "2026-04-15T00:00:00Z";

			history.push({ viewType: "timeGridWeek", date: new Date(iso) });
			history.push({ viewType: "timeGridWeek", date: new Date(iso) });

			expect(history.size).toBe(1);
		});

		it("pushes when viewType differs (same date)", () => {
			const history = createNavigationHistory();

			history.push(entry("dayGridMonth", "2026-04-15T00:00:00Z"));
			history.push(entry("timeGridWeek", "2026-04-15T00:00:00Z"));

			expect(history.size).toBe(2);
		});

		it("pushes when date differs (same viewType)", () => {
			const history = createNavigationHistory();

			history.push(entry("dayGridMonth", "2026-04-15T00:00:00Z"));
			history.push(entry("dayGridMonth", "2026-04-16T00:00:00Z"));

			expect(history.size).toBe(2);
		});
	});

	describe("navigation", () => {
		it("supports back/forward after multiple pushes", () => {
			const history = createNavigationHistory();
			const a = entry("dayGridMonth", "2026-04-01T00:00:00Z");
			const b = entry("timeGridWeek", "2026-04-08T00:00:00Z");
			const c = entry("timeGridDay", "2026-04-15T00:00:00Z");

			history.push(a);
			history.push(b);
			history.push(c);

			expect(history.current()).toEqual(c);
			expect(history.back()).toEqual(b);
			expect(history.back()).toEqual(a);
			expect(history.back()).toBeNull();
			expect(history.forward()).toEqual(b);
		});
	});
});
