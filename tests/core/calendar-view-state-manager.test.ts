import type { Calendar } from "@fullcalendar/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CalendarViewStateManager } from "../../src/core/calendar-view-state-manager";

interface FakeCalendar {
	view: { type: string } | null;
	currentDate: Date;
	getDate: () => Date;
	changeView: ReturnType<typeof vi.fn>;
	gotoDate: ReturnType<typeof vi.fn>;
}

function createFakeCalendar(overrides: Partial<FakeCalendar> = {}): FakeCalendar {
	const currentDate = overrides.currentDate ?? new Date("2026-04-15T10:00:00Z");
	return {
		view: "view" in overrides ? overrides.view! : { type: "dayGridMonth" },
		currentDate,
		getDate: overrides.getDate ?? (() => currentDate),
		changeView: overrides.changeView ?? vi.fn(),
		gotoDate: overrides.gotoDate ?? vi.fn(),
	};
}

describe("CalendarViewStateManager", () => {
	let manager: CalendarViewStateManager;

	beforeEach(() => {
		manager = new CalendarViewStateManager();
	});

	describe("initial state", () => {
		it("has no state", () => {
			expect(manager.hasState()).toBe(false);
			expect(manager.getCurrentState()).toBeNull();
			expect(manager.getSavedZoomLevel()).toBeNull();
		});
	});

	describe("saveState", () => {
		it("captures view type, current date, and zoom level", () => {
			const cal = createFakeCalendar({ view: { type: "timeGridWeek" } });

			manager.saveState(cal as unknown as Calendar, 30);

			expect(manager.hasState()).toBe(true);
			expect(manager.getCurrentState()).toEqual({
				viewType: "timeGridWeek",
				currentDate: cal.currentDate.toISOString(),
				zoomLevel: 30,
			});
			expect(manager.getSavedZoomLevel()).toBe(30);
		});

		it("does nothing when calendar has no view", () => {
			const cal = createFakeCalendar({ view: null });

			manager.saveState(cal as unknown as Calendar, 15);

			expect(manager.hasState()).toBe(false);
		});

		it("overwrites previous state on subsequent save", () => {
			const cal1 = createFakeCalendar({ view: { type: "dayGridMonth" } });
			const cal2 = createFakeCalendar({ view: { type: "listWeek" } });

			manager.saveState(cal1 as unknown as Calendar, 15);
			manager.saveState(cal2 as unknown as Calendar, 60);

			expect(manager.getCurrentState()?.viewType).toBe("listWeek");
			expect(manager.getSavedZoomLevel()).toBe(60);
		});
	});

	describe("restoreState", () => {
		it("does nothing when no state is saved", () => {
			const cal = createFakeCalendar();

			manager.restoreState(cal as unknown as Calendar);

			expect(cal.changeView).not.toHaveBeenCalled();
			expect(cal.gotoDate).not.toHaveBeenCalled();
		});

		it("applies saved viewType and date", () => {
			const savedDate = new Date("2026-05-01T12:00:00Z");
			const source = createFakeCalendar({
				view: { type: "timeGridDay" },
				currentDate: savedDate,
			});
			manager.saveState(source as unknown as Calendar, 15);

			const target = createFakeCalendar();
			manager.restoreState(target as unknown as Calendar);

			expect(target.changeView).toHaveBeenCalledWith("timeGridDay");
			expect(target.gotoDate).toHaveBeenCalledWith(savedDate);
			const passedDate = target.gotoDate.mock.calls[0][0] as Date;
			expect(passedDate.toISOString()).toBe(savedDate.toISOString());
		});
	});

	describe("clear", () => {
		it("drops saved state", () => {
			const cal = createFakeCalendar();
			manager.saveState(cal as unknown as Calendar, 30);
			expect(manager.hasState()).toBe(true);

			manager.clear();

			expect(manager.hasState()).toBe(false);
			expect(manager.getCurrentState()).toBeNull();
			expect(manager.getSavedZoomLevel()).toBeNull();
		});

		it("is a no-op when state was never set", () => {
			expect(() => manager.clear()).not.toThrow();
			expect(manager.hasState()).toBe(false);
		});
	});
});
