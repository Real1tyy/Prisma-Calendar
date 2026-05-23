import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createMappedSchema, withSerialize } from "../../src/core/vault-table/create-mapped-schema";

describe("withSerialize", () => {
	it("should attach a serialize method to a Zod schema", () => {
		const schema = withSerialize(z.object({ title: z.string() }));

		expect(typeof schema.serialize).toBe("function");
	});

	it("should use identity serialization (returns data as-is)", () => {
		const schema = withSerialize(z.object({ title: z.string(), count: z.number() }));

		const data = { title: "Team Meeting", count: 5 };
		const serialized = schema.serialize(data);

		expect(serialized).toBe(data);
	});

	it("should still parse correctly after wrapping", () => {
		const schema = withSerialize(z.object({ name: z.string(), active: z.boolean() }));

		const result = schema.parse({ name: "Alice", active: true });
		expect(result).toEqual({ name: "Alice", active: true });
	});

	it("should throw on invalid data during parse", () => {
		const schema = withSerialize(z.object({ name: z.string() }));

		expect(() => schema.parse({ name: 123 })).toThrow();
	});

	it("should handle schema with default values", () => {
		const schema = withSerialize(
			z.object({
				title: z.string(),
				priority: z.number().default(0),
			})
		);

		const result = schema.parse({ title: "Weekly Review" });
		expect(result).toEqual({ title: "Weekly Review", priority: 0 });

		const serialized = schema.serialize(result);
		expect(serialized).toEqual({ title: "Weekly Review", priority: 0 });
	});

	it("should handle schema with optional fields", () => {
		const schema = withSerialize(
			z.object({
				title: z.string(),
				description: z.string().optional(),
			})
		);

		const result = schema.parse({ title: "Project Planning" });
		expect(result).toEqual({ title: "Project Planning" });

		const serialized = schema.serialize(result);
		expect(serialized).toEqual({ title: "Project Planning" });
	});
});

describe("createMappedSchema", () => {
	const shape = {
		title: z.string(),
		status: z.string().default("active"),
		priority: z.number().default(0),
	};

	const settings = {
		titleProp: "task_title",
		statusProp: "task_status",
		priorityProp: "task_priority",
	};

	it("should remap external frontmatter keys to internal keys during parse", () => {
		const schema = createMappedSchema(shape, settings);

		const raw = {
			task_title: "Team Meeting",
			task_status: "done",
			task_priority: 3,
		};

		const result = schema.parse(raw);
		expect(result.title).toBe("Team Meeting");
		expect(result.status).toBe("done");
		expect(result.priority).toBe(3);
	});

	it("should serialize internal keys back to external frontmatter keys", () => {
		const schema = createMappedSchema(shape, settings);

		const data = { title: "Weekly Review", status: "active", priority: 1 };
		const serialized = schema.serialize(data);

		expect(serialized).toEqual({
			task_title: "Weekly Review",
			task_status: "active",
			task_priority: 1,
		});
	});

	it("should support round-trip: parse then serialize", () => {
		const schema = createMappedSchema(shape, settings);

		const raw = {
			task_title: "Project Planning",
			task_status: "pending",
			task_priority: 5,
		};

		const parsed = schema.parse(raw);
		const serialized = schema.serialize(parsed);

		expect(serialized).toEqual(raw);
	});

	it("should apply default values for missing fields", () => {
		const schema = createMappedSchema(shape, settings);

		const raw = { task_title: "Workout" };
		const result = schema.parse(raw);

		expect(result.title).toBe("Workout");
		expect(result.status).toBe("active");
		expect(result.priority).toBe(0);
	});

	it("should omit undefined values during serialization", () => {
		const optionalShape = {
			title: z.string(),
			notes: z.string().optional(),
		};
		const optionalSettings = {
			titleProp: "fm_title",
			notesProp: "fm_notes",
		};

		const schema = createMappedSchema(optionalShape, optionalSettings);
		const data = { title: "Event" } as { title: string; notes?: string };
		const serialized = schema.serialize(data);

		expect(serialized).toEqual({ fm_title: "Event" });
		expect("fm_notes" in serialized).toBe(false);
	});

	it("should handle settings where external keys match internal keys", () => {
		const sameKeySettings = {
			titleProp: "title",
			statusProp: "status",
			priorityProp: "priority",
		};

		const schema = createMappedSchema(shape, sameKeySettings);

		const raw = { title: "Task", status: "done", priority: 2 };
		const parsed = schema.parse(raw);

		expect(parsed).toEqual(raw);

		const serialized = schema.serialize(parsed);
		expect(serialized).toEqual(raw);
	});

	it("should return non-object values unchanged during preprocess", () => {
		const schema = createMappedSchema(shape, settings);

		expect(() => schema.parse(null)).toThrow();
		expect(() => schema.parse("not-an-object")).toThrow();
		expect(() => schema.parse(42)).toThrow();
	});

	it("should handle array field types", () => {
		const arrayShape = {
			tags: z.array(z.string()).default([]),
			name: z.string(),
		};
		const arraySettings = {
			tagsProp: "fm_tags",
			nameProp: "fm_name",
		};

		const schema = createMappedSchema(arrayShape, arraySettings);

		const raw = { fm_tags: ["work", "urgent"], fm_name: "Alice" };
		const parsed = schema.parse(raw);

		expect(parsed.tags).toEqual(["work", "urgent"]);
		expect(parsed.name).toBe("Alice");

		const serialized = schema.serialize(parsed);
		expect(serialized).toEqual(raw);
	});

	it("should handle boolean field types", () => {
		const boolShape = {
			completed: z.boolean().default(false),
			title: z.string(),
		};
		const boolSettings = {
			completedProp: "is_completed",
			titleProp: "task_name",
		};

		const schema = createMappedSchema(boolShape, boolSettings);

		const raw = { is_completed: true, task_name: "Workout" };
		const parsed = schema.parse(raw);

		expect(parsed.completed).toBe(true);
		expect(parsed.title).toBe("Workout");

		const serialized = schema.serialize(parsed);
		expect(serialized).toEqual(raw);
	});

	it("should preserve values when parsing data already in internal format", () => {
		const schema = createMappedSchema(shape, settings);

		const internalData = { title: "Team Meeting", status: "done", priority: 3 };
		const result = schema.parse(internalData);

		expect(result.title).toBe("Team Meeting");
		expect(result.status).toBe("done");
		expect(result.priority).toBe(3);
	});

	it("should support round-trip: parse external, serialize, parse internal again", () => {
		const schema = createMappedSchema(shape, settings);

		const raw = { task_title: "Weekly Review", task_status: "pending", task_priority: 5 };
		const parsed = schema.parse(raw);
		const serialized = schema.serialize(parsed);
		expect(serialized).toEqual(raw);

		const reparsed = schema.parse(parsed);
		expect(reparsed).toEqual(parsed);
	});

	it("should use looseObject so extra keys in raw data are ignored", () => {
		const schema = createMappedSchema(shape, settings);

		const raw = {
			task_title: "Event",
			task_status: "active",
			task_priority: 0,
			extra_field: "should not cause error",
		};

		const result = schema.parse(raw);
		expect(result.title).toBe("Event");
	});

	it("should apply fieldOverrides for non-conventional settings prop names", () => {
		const overrideShape = { categories: z.array(z.string()).default([]), title: z.string() };
		const overrideSettings = { categoryProp: "fm_cats", titleProp: "fm_title" };
		// `categories` maps to `categoryProp` (override), not the `categoriesProp` convention.
		const schema = createMappedSchema(overrideShape, overrideSettings, { categories: "categoryProp" });

		const parsed = schema.parse({ fm_cats: ["work"], fm_title: "Event" });
		expect(parsed.categories).toEqual(["work"]);
		expect(parsed.title).toBe("Event");
		expect(schema.serialize(parsed)).toEqual({ fm_cats: ["work"], fm_title: "Event" });
	});
});

describe("createMappedSchema memoization", () => {
	const shape = { title: z.string(), status: z.string().default("active") };

	it("returns the same schema instance for the same shape + prop mapping", () => {
		const settings = { titleProp: "t", statusProp: "s" };
		expect(createMappedSchema(shape, settings)).toBe(createMappedSchema(shape, settings));
	});

	it("hits the cache across different settings objects with the same mapping", () => {
		// The hot ingest path passes a fresh `{ ...settings }` per row — the cache must
		// key on the resolved names, not object identity, or it would never hit.
		const a = createMappedSchema(shape, { titleProp: "t", statusProp: "s" });
		const b = createMappedSchema(shape, { titleProp: "t", statusProp: "s" });
		expect(a).toBe(b);
	});

	it("builds a distinct schema when a prop name differs", () => {
		const a = createMappedSchema(shape, { titleProp: "a_title", statusProp: "s" });
		const b = createMappedSchema(shape, { titleProp: "b_title", statusProp: "s" });
		expect(a).not.toBe(b);
	});

	it("keys per shape, so structurally-identical but distinct shapes never collide", () => {
		const otherShape = { title: z.string(), status: z.string().default("active") };
		const settings = { titleProp: "t", statusProp: "s" };
		expect(createMappedSchema(shape, settings)).not.toBe(createMappedSchema(otherShape, settings));
	});

	it("a reused (cached) schema still remaps the correct external keys", () => {
		const first = createMappedSchema(shape, { titleProp: "t", statusProp: "s" });
		const reused = createMappedSchema(shape, { titleProp: "t", statusProp: "s" });
		expect(reused).toBe(first);
		expect(reused.parse({ t: "Team Meeting", s: "done" })).toEqual({ title: "Team Meeting", status: "done" });
	});
});
