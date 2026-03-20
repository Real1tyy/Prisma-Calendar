import { describe, expect, it } from "vitest";

import {
	buildDayMap,
	type TimedCreateOp,
	validateDayCoverage,
	validateEndAfterStart,
	validateNoGaps,
	validateNoOverlaps,
	validateWithinBounds,
} from "../../src/core/ai/ai-validation";

// ─── Tests ──────────────────────────────────────────────────────────

describe("validateEndAfterStart", () => {
	it("should return no errors for valid operations", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
		];
		expect(validateEndAfterStart(ops)).toEqual([]);
	});

	it("should detect end before start", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event", start: "2025-03-15T10:00:00", end: "2025-03-15T09:00:00" },
		];
		const errors = validateEndAfterStart(ops);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("Event");
		expect(errors[0]).toContain("not after start");
	});

	it("should detect end equal to start", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event", start: "2025-03-15T09:00:00", end: "2025-03-15T09:00:00" },
		];
		const errors = validateEndAfterStart(ops);
		expect(errors.length).toBe(1);
	});
});

describe("validateNoOverlaps", () => {
	it("should return no errors when events do not overlap", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
			{ type: "create", title: "Event B", start: "2025-03-15T10:00:00", end: "2025-03-15T11:00:00" },
		];
		const byDay = buildDayMap(ops);
		expect(validateNoOverlaps(byDay)).toEqual([]);
	});

	it("should allow boundary touching (end == next start)", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
			{ type: "create", title: "Event B", start: "2025-03-15T10:00:00", end: "2025-03-15T11:00:00" },
		];
		const byDay = buildDayMap(ops);
		expect(validateNoOverlaps(byDay)).toEqual([]);
	});

	it("should detect actual overlap", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:30:00" },
			{ type: "create", title: "Event B", start: "2025-03-15T10:00:00", end: "2025-03-15T11:00:00" },
		];
		const byDay = buildDayMap(ops);
		const errors = validateNoOverlaps(byDay);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("Overlap");
	});
});

describe("validateNoGaps", () => {
	it("should return no errors for contiguous events", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
			{ type: "create", title: "Event B", start: "2025-03-15T10:00:00", end: "2025-03-15T11:00:00" },
		];
		const byDay = buildDayMap(ops);
		expect(validateNoGaps(byDay)).toEqual([]);
	});

	it("should detect a 1-minute gap", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
			{ type: "create", title: "Event B", start: "2025-03-15T10:01:00", end: "2025-03-15T11:00:00" },
		];
		const byDay = buildDayMap(ops);
		const errors = validateNoGaps(byDay);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("Gap");
		expect(errors[0]).toContain("1min");
	});

	it("should detect a large gap", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
			{ type: "create", title: "Event B", start: "2025-03-15T12:00:00", end: "2025-03-15T13:00:00" },
		];
		const byDay = buildDayMap(ops);
		const errors = validateNoGaps(byDay);
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("120min");
	});
});

describe("validateDayCoverage", () => {
	it("should return no errors when all days are covered", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
			{ type: "create", title: "Event B", start: "2025-03-16T09:00:00", end: "2025-03-16T10:00:00" },
		];
		const byDay = buildDayMap(ops);
		const errors = validateDayCoverage(byDay, "2025-03-15T00:00:00.000Z", "2025-03-17T00:00:00.000Z");
		expect(errors).toEqual([]);
	});

	it("should detect a missing day", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
		];
		const byDay = buildDayMap(ops);
		const errors = validateDayCoverage(byDay, "2025-03-15T00:00:00.000Z", "2025-03-17T00:00:00.000Z");
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("2025-03-16");
	});

	it("should detect multiple missing days", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
		];
		const byDay = buildDayMap(ops);
		const errors = validateDayCoverage(byDay, "2025-03-15T00:00:00.000Z", "2025-03-18T00:00:00.000Z");
		expect(errors.length).toBe(2);
	});
});

describe("validateWithinBounds", () => {
	it("should return no errors when events are within bounds", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
		];
		const errors = validateWithinBounds(ops, "2025-03-15T00:00:00.000Z", "2025-03-16T00:00:00.000Z");
		expect(errors).toEqual([]);
	});

	it("should detect event starting before interval", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event", start: "2025-03-14T23:00:00", end: "2025-03-15T01:00:00" },
		];
		const errors = validateWithinBounds(ops, "2025-03-15T00:00:00.000Z", "2025-03-16T00:00:00.000Z");
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("outside interval");
	});

	it("should detect event ending after interval", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event", start: "2025-03-15T23:00:00", end: "2025-03-16T02:00:00" },
		];
		const errors = validateWithinBounds(ops, "2025-03-15T00:00:00.000Z", "2025-03-16T00:00:00.000Z");
		expect(errors.length).toBe(1);
		expect(errors[0]).toContain("outside interval");
	});

	it("should allow events exactly at boundary", () => {
		const ops: TimedCreateOp[] = [
			{ type: "create", title: "Event", start: "2025-03-15T00:00:00", end: "2025-03-16T00:00:00" },
		];
		const errors = validateWithinBounds(ops, "2025-03-15T00:00:00", "2025-03-16T00:00:00");
		expect(errors).toEqual([]);
	});
});
