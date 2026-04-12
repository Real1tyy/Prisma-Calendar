import { describe, expect, it } from "vitest";

import { createEventSchema } from "../../src/core/event-schema";

describe("createEventSchema", () => {
	it("accepts an empty object", () => {
		const schema = createEventSchema();
		expect(schema.parse({})).toEqual({});
	});

	it("passes through any Record<string, unknown> untouched", () => {
		const schema = createEventSchema();
		const input = {
			Title: "Team Meeting",
			Date: "2026-04-15",
			Participants: ["Alice", "Bob"],
			Priority: 1,
			Done: true,
			Notes: null,
		};

		expect(schema.parse(input)).toEqual(input);
	});

	it("preserves arbitrary nested structures", () => {
		const schema = createEventSchema();
		const input = {
			metadata: { level: 1, tags: ["work", "urgent"] },
			recurrence: { rule: { freq: "WEEKLY", byDay: ["MO", "WE"] } },
		};

		expect(schema.parse(input)).toEqual(input);
	});

	it("rejects non-object inputs", () => {
		const schema = createEventSchema();
		expect(() => schema.parse(null)).toThrow();
		expect(() => schema.parse(undefined)).toThrow();
		expect(() => schema.parse("string")).toThrow();
		expect(() => schema.parse(42)).toThrow();
		expect(() => schema.parse([])).toThrow();
	});

	it("exposes a serialize() method that returns identity", () => {
		const schema = createEventSchema();
		const input = { Title: "Event", Priority: 3 };

		expect(schema.serialize(input)).toEqual(input);
	});

	it("serialize returns the same reference (identity, not copy)", () => {
		const schema = createEventSchema();
		const input = { Title: "Event" };

		expect(schema.serialize(input)).toBe(input);
	});
});
