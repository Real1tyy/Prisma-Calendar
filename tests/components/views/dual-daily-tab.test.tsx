import "@testing-library/jest-dom/vitest";

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DualDailyTab } from "../../../src/react/views/dual-daily-tab";
import { renderWithContexts } from "../../fixtures/react-view-fixtures";

let createCount = 0;

vi.mock("@real1ty-obsidian-plugins", async (importOriginal) => {
	const actual: Record<string, unknown> = await importOriginal();
	return {
		...actual,
		createGridLayout: vi.fn((el: HTMLElement, opts: any) => {
			for (const cell of opts.cells) {
				const cellEl = document.createElement("div");
				cellEl.dataset["cellId"] = cell.id;
				el.appendChild(cellEl);
				cell.render?.(cellEl);
			}
			return { destroy: vi.fn() };
		}),
	};
});

vi.mock("../../../src/components/views/daily-calendar", () => ({
	createDailyCalendar: vi.fn(() => {
		createCount++;
		return {
			destroy: vi.fn(),
			prev: vi.fn(),
			next: vi.fn(),
			getDate: vi.fn().mockReturnValue(new Date()),
		};
	}),
}));

describe("DualDailyTab", () => {
	it("creates two daily calendars (left + right) inside the grid", () => {
		createCount = 0;
		renderWithContexts(<DualDailyTab />);
		const container = screen.getByTestId("prisma-dual-daily");
		expect(container.querySelector('[data-cell-id="left-calendar"]')).toBeTruthy();
		expect(container.querySelector('[data-cell-id="right-calendar"]')).toBeTruthy();
		expect(createCount).toBe(2);
	});
});
