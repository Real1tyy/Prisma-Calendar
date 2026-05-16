import "@testing-library/jest-dom/vitest";

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DualDailyTab } from "../../../src/react/views/dual-daily-tab";
import { renderWithContexts } from "../../fixtures/react-view-fixtures";

let createCount = 0;

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
		// React-native engine renders cells at row=0, col=0/1
		expect(container.querySelector('[data-row="0"][data-col="0"]')).toBeTruthy();
		expect(container.querySelector('[data-row="0"][data-col="1"]')).toBeTruthy();
		expect(createCount).toBe(2);
	});
});
