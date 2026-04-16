import type { SchemaFieldDescriptor } from "@real1ty-obsidian-plugins";
import { describe, expect, it } from "vitest";

import { resolveWidget } from "../src/settings/resolve-widget";

function base(overrides: Partial<SchemaFieldDescriptor> = {}): SchemaFieldDescriptor {
	return {
		key: "foo",
		label: "Foo",
		optional: false,
		type: "string",
		...overrides,
	} as SchemaFieldDescriptor;
}

describe("resolveWidget", () => {
	it("returns 'toggle' for boolean and toggle descriptor types", () => {
		expect(resolveWidget(base({ type: "boolean" }))).toBe("toggle");
		expect(resolveWidget(base({ type: "toggle" }))).toBe("toggle");
	});

	it("returns 'dropdown' for enum descriptors", () => {
		expect(
			resolveWidget({
				key: "k",
				label: "K",
				optional: false,
				type: "enum",
				enumValues: ["a", "b"],
			})
		).toBe("dropdown");
	});

	it("returns 'secret' for secret descriptors (Obsidian SecretComponent, keychain-backed)", () => {
		expect(resolveWidget(base({ type: "secret" }))).toBe("secret");
	});

	it("returns 'date' and 'datetime' for date descriptors", () => {
		expect(resolveWidget(base({ type: "date" }))).toBe("date");
		expect(resolveWidget(base({ type: "datetime" }))).toBe("datetime");
	});

	it("uses 'slider' for bounded numbers and 'number' otherwise", () => {
		expect(
			resolveWidget({
				key: "k",
				label: "K",
				optional: false,
				type: "number",
				min: 0,
				max: 10,
			})
		).toBe("slider");

		expect(
			resolveWidget({
				key: "k",
				label: "K",
				optional: false,
				type: "number",
				min: 0,
			})
		).toBe("number");

		expect(resolveWidget(base({ type: "number" }))).toBe("number");
	});

	it("returns 'array-csv' for array descriptors", () => {
		expect(
			resolveWidget({
				key: "k",
				label: "K",
				optional: false,
				type: "array",
				itemType: "string",
			})
		).toBe("array-csv");
	});

	it("defaults strings to 'text'", () => {
		expect(resolveWidget(base({ type: "string" }))).toBe("text");
	});

	it("descriptor.widget from .meta() overrides type-based inference", () => {
		expect(resolveWidget(base({ type: "string", widget: "textarea" }))).toBe("textarea");
		expect(resolveWidget(base({ type: "string", widget: "color" }))).toBe("color");
	});

	it("override.widget from render site beats descriptor.widget", () => {
		expect(resolveWidget(base({ type: "string", widget: "textarea" }), { widget: "color" })).toBe("color");
	});

	it("override.widget beats type-based inference for bounded numbers", () => {
		expect(
			resolveWidget(
				{
					key: "k",
					label: "K",
					optional: false,
					type: "number",
					min: 0,
					max: 10,
				},
				{ widget: "number" }
			)
		).toBe("number");
	});

	it("unknown widget strings pass through unchanged", () => {
		expect(resolveWidget(base({ type: "string", widget: "custom-registry-key" }))).toBe("custom-registry-key");
		expect(resolveWidget(base({ type: "string" }), { widget: "custom-thing" })).toBe("custom-thing");
	});
});
