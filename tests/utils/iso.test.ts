import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { appendZ, stripZ, toInternalISO } from "../../src/utils/iso";
import { formatEventTimeInfo } from "../../src/utils/time-formatter";
import { createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";

describe("stripZ", () => {
	it("should remove .000Z suffix", () => {
		expect(stripZ("2026-03-19T08:50:00.000Z")).toBe("2026-03-19T08:50:00");
	});

	it("should remove bare Z suffix", () => {
		expect(stripZ("2026-03-19T08:50:00Z")).toBe("2026-03-19T08:50:00");
	});

	it("should leave bare ISO strings unchanged", () => {
		expect(stripZ("2026-03-19T08:50:00")).toBe("2026-03-19T08:50:00");
	});

	it("should leave date-only strings unchanged", () => {
		expect(stripZ("2026-03-19")).toBe("2026-03-19");
	});

	it("should handle midnight", () => {
		expect(stripZ("2026-03-19T00:00:00.000Z")).toBe("2026-03-19T00:00:00");
	});

	it("should handle end-of-day", () => {
		expect(stripZ("2026-03-19T23:59:59.000Z")).toBe("2026-03-19T23:59:59");
	});
});

describe("appendZ", () => {
	it("should append .000Z to bare ISO string", () => {
		expect(appendZ("2026-03-19T08:50:00")).toBe("2026-03-19T08:50:00.000Z");
	});

	it("should normalize Z to .000Z", () => {
		expect(appendZ("2026-03-19T08:50:00Z")).toBe("2026-03-19T08:50:00.000Z");
	});

	it("should not double-append .000Z", () => {
		expect(appendZ("2026-03-19T08:50:00.000Z")).toBe("2026-03-19T08:50:00.000Z");
	});

	it("should leave date-only strings unchanged", () => {
		expect(appendZ("2026-03-19")).toBe("2026-03-19");
	});
});

describe("toInternalISO", () => {
	it("should produce no-Z, no-offset, no-milliseconds output", () => {
		const dt = DateTime.fromISO("2026-03-19T08:50:00");
		expect(toInternalISO(dt)).toBe("2026-03-19T08:50:00");
	});

	it("should suppress zero milliseconds", () => {
		const dt = DateTime.fromISO("2026-03-19T08:50:00.000");
		expect(toInternalISO(dt)).toBe("2026-03-19T08:50:00");
	});

	it("should handle midnight", () => {
		const dt = DateTime.fromISO("2026-03-19T00:00:00");
		expect(toInternalISO(dt)).toBe("2026-03-19T00:00:00");
	});

	it("should handle noon", () => {
		const dt = DateTime.fromISO("2026-03-19T12:00:00");
		expect(toInternalISO(dt)).toBe("2026-03-19T12:00:00");
	});

	it("should handle end-of-day 23:59", () => {
		const dt = DateTime.fromISO("2026-03-19T23:59:00");
		expect(toInternalISO(dt)).toBe("2026-03-19T23:59:00");
	});

	it("should handle leap year Feb 29", () => {
		const dt = DateTime.fromISO("2024-02-29T10:00:00");
		expect(toInternalISO(dt)).toBe("2024-02-29T10:00:00");
	});

	it("should handle year boundary", () => {
		const dt = DateTime.fromISO("2025-12-31T23:59:59");
		expect(toInternalISO(dt)).toBe("2025-12-31T23:59:59");
	});
});

describe("roundtrip: frontmatter → internal → frontmatter", () => {
	it("should preserve time through stripZ → appendZ cycle", () => {
		const frontmatterValue = "2026-03-19T08:50:00.000Z";
		const internal = stripZ(frontmatterValue);
		const backToFrontmatter = appendZ(internal);

		expect(internal).toBe("2026-03-19T08:50:00");
		expect(backToFrontmatter).toBe("2026-03-19T08:50:00.000Z");
		expect(stripZ(backToFrontmatter)).toBe(internal);
	});

	it("should preserve time through DateTime → toInternalISO → DateTime cycle", () => {
		const original = DateTime.fromISO("2026-03-19T14:30:00");
		const iso = toInternalISO(original);
		const parsed = DateTime.fromISO(iso);

		expect(parsed.hour).toBe(14);
		expect(parsed.minute).toBe(30);
		expect(parsed.year).toBe(2026);
		expect(parsed.month).toBe(3);
		expect(parsed.day).toBe(19);
	});

	it("should preserve midnight correctly", () => {
		const original = DateTime.fromISO("2026-01-01T00:00:00");
		const iso = toInternalISO(original);
		const parsed = DateTime.fromISO(iso);

		expect(parsed.hour).toBe(0);
		expect(parsed.minute).toBe(0);
		expect(parsed.day).toBe(1);
	});
});

describe("formatEventTimeInfo preserves correct times with internal ISO", () => {
	it("should format timed event at 9:30 AM correctly", () => {
		const event = createMockTimedEvent({ start: "2024-03-15T09:30:00" });
		expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:30 AM");
	});

	it("should format all-day event on correct date", () => {
		const event = createMockAllDayEvent({ start: "2024-03-15T00:00:00" });
		expect(formatEventTimeInfo(event)).toBe("All Day - Mar 15, 2024");
	});

	it("should format event at noon correctly", () => {
		const event = createMockTimedEvent({ start: "2024-03-15T12:00:00" });
		expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 PM");
	});

	it("should format event at midnight correctly", () => {
		const event = createMockTimedEvent({ start: "2024-03-15T00:00:00" });
		expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 AM");
	});
});

describe("date grouping keeps events on correct day", () => {
	it("should group events by date correctly with internal ISO", () => {
		const events = [
			createMockTimedEvent({ id: "1", start: "2024-03-15T09:00:00", end: "2024-03-15T10:00:00" }),
			createMockTimedEvent({ id: "2", start: "2024-03-15T14:00:00", end: "2024-03-15T15:00:00" }),
			createMockTimedEvent({ id: "3", start: "2024-03-16T09:00:00", end: "2024-03-16T10:00:00" }),
		];

		const grouped = new Map<string, typeof events>();
		for (const event of events) {
			const dateKey = event.start.slice(0, 10);
			const existing = grouped.get(dateKey) ?? [];
			existing.push(event);
			grouped.set(dateKey, existing);
		}

		expect(grouped.get("2024-03-15")).toHaveLength(2);
		expect(grouped.get("2024-03-16")).toHaveLength(1);
	});
});
