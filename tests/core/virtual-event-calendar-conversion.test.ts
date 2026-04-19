import { describe, expect, it } from "vitest";

import { toCalendarEvent } from "../../src/core/event-store/event-store";
import { toVirtualInput } from "../../src/core/virtual-event-store";
import type { EventSaveData } from "../../src/types/event-boundaries";
import { createAllDayVirtualEventData, createVirtualEventData } from "../fixtures";

const VIRTUAL_FILE_PATH = "calendar/Virtual Events.md";

describe("toCalendarEvent", () => {
	describe("timed events", () => {
		it("should convert a timed virtual event to a timed CalendarEvent", () => {
			const data = createVirtualEventData({
				id: "abc-123",
				title: "Standup",
				start: "2025-03-15T09:00:00",
				end: "2025-03-15T09:30:00",
			});

			const result = toCalendarEvent(data, VIRTUAL_FILE_PATH);

			expect(result.type).toBe("timed");
			expect(result.id).toBe("abc-123");
			expect(result.title).toBe("Standup");
			expect(result.start).toBe("2025-03-15T09:00:00");
			expect(result.allDay).toBe(false);
			expect(result.virtualKind).toBe("manual");
			expect(result.skipped).toBe(false);
			expect(result.ref.filePath).toBe(VIRTUAL_FILE_PATH);
		});

		it("should set end equal to start when end is null", () => {
			const data = createVirtualEventData({ end: null });

			const result = toCalendarEvent(data, VIRTUAL_FILE_PATH);

			expect(result.type).toBe("timed");
			if (result.type === "timed") {
				expect(result.end).toBe(data.start);
			}
		});

		it("should preserve the end when provided", () => {
			const data = createVirtualEventData({
				start: "2025-03-15T09:00:00",
				end: "2025-03-15T11:00:00",
			});

			const result = toCalendarEvent(data, VIRTUAL_FILE_PATH);

			if (result.type === "timed") {
				expect(result.end).toBe("2025-03-15T11:00:00");
			}
		});
	});

	describe("all-day events", () => {
		it("should convert an all-day virtual event to an allDay CalendarEvent", () => {
			const data = createAllDayVirtualEventData({
				id: "day-1",
				title: "Holiday",
				start: "2025-12-25T00:00:00",
			});

			const result = toCalendarEvent(data, VIRTUAL_FILE_PATH);

			expect(result.type).toBe("allDay");
			expect(result.id).toBe("day-1");
			expect(result.title).toBe("Holiday");
			expect(result.start).toBe("2025-12-25T00:00:00");
			expect(result.allDay).toBe(true);
			expect(result.virtualKind).toBe("manual");
		});
	});

	describe("properties passthrough", () => {
		it("should pass properties through as meta", () => {
			const data = createVirtualEventData({
				properties: { Category: "Work", Priority: "High" },
			});

			const result = toCalendarEvent(data, VIRTUAL_FILE_PATH);

			expect(result.meta).toEqual({ Category: "Work", Priority: "High" });
		});

		it("should default meta to empty object when properties is empty", () => {
			const data = createVirtualEventData({ properties: {} });

			const result = toCalendarEvent(data, VIRTUAL_FILE_PATH);

			expect(result.meta).toEqual({});
		});
	});

	describe("metadata defaults", () => {
		it("should provide empty metadata from eventDefaults", () => {
			const data = createVirtualEventData();

			const result = toCalendarEvent(data, VIRTUAL_FILE_PATH);

			expect(result.metadata).toBeDefined();
			expect(result.metadata.skip).toBeUndefined();
			expect(result.metadata.breakMinutes).toBeUndefined();
		});
	});
});

describe("round-trip: EventSaveData → VirtualEventData → CalendarEvent", () => {
	function makeSaveData(overrides: Partial<EventSaveData> = {}): EventSaveData {
		return {
			filePath: "events/meeting.md",
			title: "Team Standup",
			start: "2025-03-15T09:00:00",
			end: "2025-03-15T09:30:00",
			allDay: false,
			virtual: true,
			preservedFrontmatter: { Category: "Work", Status: "active" },
			...overrides,
		};
	}

	it("should preserve title, start, end, allDay through the full chain", () => {
		const saveData = makeSaveData();
		const virtualInput = toVirtualInput(saveData);
		const virtualData = { ...virtualInput, id: "rt-1" };
		const calEvent = toCalendarEvent(virtualData, VIRTUAL_FILE_PATH);

		expect(calEvent.title).toBe(saveData.title);
		expect(calEvent.start).toBe(saveData.start);
		expect(calEvent.allDay).toBe(false);
		if (calEvent.type === "timed") {
			expect(calEvent.end).toBe(saveData.end);
		}
	});

	it("should preserve frontmatter properties as meta", () => {
		const saveData = makeSaveData({
			preservedFrontmatter: { Priority: "High", Tags: ["urgent", "review"] },
		});
		const virtualInput = toVirtualInput(saveData);
		const virtualData = { ...virtualInput, id: "rt-2" };
		const calEvent = toCalendarEvent(virtualData, VIRTUAL_FILE_PATH);

		expect(calEvent.meta).toEqual({ Priority: "High", Tags: ["urgent", "review"] });
	});

	it("should handle all-day events through the full chain", () => {
		const saveData = makeSaveData({
			start: "2025-12-25T00:00:00",
			end: null,
			allDay: true,
		});
		const virtualInput = toVirtualInput(saveData);
		const virtualData = { ...virtualInput, id: "rt-3" };
		const calEvent = toCalendarEvent(virtualData, VIRTUAL_FILE_PATH);

		expect(calEvent.type).toBe("allDay");
		expect(calEvent.allDay).toBe(true);
		expect(calEvent.start).toBe("2025-12-25T00:00:00");
	});

	it("should default end to start for timed events with null end", () => {
		const saveData = makeSaveData({ end: null, allDay: false });
		const virtualInput = toVirtualInput(saveData);
		const virtualData = { ...virtualInput, id: "rt-4" };
		const calEvent = toCalendarEvent(virtualData, VIRTUAL_FILE_PATH);

		expect(calEvent.type).toBe("timed");
		if (calEvent.type === "timed") {
			expect(calEvent.end).toBe(saveData.start);
		}
	});

	it("should set virtualKind to manual regardless of save data virtual flag", () => {
		const saveData = makeSaveData({ virtual: true });
		const virtualInput = toVirtualInput(saveData);
		const virtualData = { ...virtualInput, id: "rt-5" };
		const calEvent = toCalendarEvent(virtualData, VIRTUAL_FILE_PATH);

		expect(calEvent.virtualKind).toBe("manual");
	});

	it("should strip filePath and virtual from intermediate VirtualEventData", () => {
		const saveData = makeSaveData({ filePath: "events/x.md", virtual: true });
		const virtualInput = toVirtualInput(saveData);

		expect(virtualInput).not.toHaveProperty("filePath");
		expect(virtualInput).not.toHaveProperty("virtual");
		expect(Object.keys(virtualInput).sort()).toEqual(["allDay", "end", "properties", "start", "title"]);
	});
});
