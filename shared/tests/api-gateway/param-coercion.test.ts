import { describe, expect, it } from "vitest";

import { ParamCoercion } from "../../src/integrations/api-gateway/param-coercion";

describe("ParamCoercion", () => {
	describe("string", () => {
		it("should return the value when present", () => {
			expect(ParamCoercion.string({ key: "hello" }, "key")).toBe("hello");
		});

		it("should return undefined when key is absent", () => {
			expect(ParamCoercion.string({}, "key")).toBeUndefined();
		});

		it("should return empty string when value is empty", () => {
			expect(ParamCoercion.string({ key: "" }, "key")).toBe("");
		});
	});

	describe("boolean", () => {
		it("should parse 'true' as true", () => {
			expect(ParamCoercion.boolean({ key: "true" }, "key")).toBe(true);
		});

		it("should parse '1' as true", () => {
			expect(ParamCoercion.boolean({ key: "1" }, "key")).toBe(true);
		});

		it("should parse 'false' as false", () => {
			expect(ParamCoercion.boolean({ key: "false" }, "key")).toBe(false);
		});

		it("should parse '0' as false", () => {
			expect(ParamCoercion.boolean({ key: "0" }, "key")).toBe(false);
		});

		it("should return undefined when key is absent", () => {
			expect(ParamCoercion.boolean({}, "key")).toBeUndefined();
		});

		it("should parse arbitrary string as false", () => {
			expect(ParamCoercion.boolean({ key: "yes" }, "key")).toBe(false);
		});
	});

	describe("number", () => {
		it("should parse integer strings", () => {
			expect(ParamCoercion.number({ key: "42" }, "key")).toBe(42);
		});

		it("should parse float strings", () => {
			expect(ParamCoercion.number({ key: "3.14" }, "key")).toBe(3.14);
		});

		it("should parse negative numbers", () => {
			expect(ParamCoercion.number({ key: "-7" }, "key")).toBe(-7);
		});

		it("should return undefined for NaN values", () => {
			expect(ParamCoercion.number({ key: "abc" }, "key")).toBeUndefined();
		});

		it("should return undefined when key is absent", () => {
			expect(ParamCoercion.number({}, "key")).toBeUndefined();
		});

		it("should parse zero", () => {
			expect(ParamCoercion.number({ key: "0" }, "key")).toBe(0);
		});
	});

	describe("stringArray", () => {
		it("should split comma-separated values", () => {
			expect(ParamCoercion.stringArray({ key: "a,b,c" }, "key")).toEqual(["a", "b", "c"]);
		});

		it("should trim whitespace around values", () => {
			expect(ParamCoercion.stringArray({ key: " a , b , c " }, "key")).toEqual(["a", "b", "c"]);
		});

		it("should filter out empty segments", () => {
			expect(ParamCoercion.stringArray({ key: "a,,b," }, "key")).toEqual(["a", "b"]);
		});

		it("should return single-element array for non-comma value", () => {
			expect(ParamCoercion.stringArray({ key: "solo" }, "key")).toEqual(["solo"]);
		});

		it("should return undefined when key is absent", () => {
			expect(ParamCoercion.stringArray({}, "key")).toBeUndefined();
		});

		it("should return empty array for empty string", () => {
			expect(ParamCoercion.stringArray({ key: "" }, "key")).toEqual([]);
		});
	});

	describe("required.string", () => {
		it("should return the value when present", () => {
			expect(ParamCoercion.required.string({ key: "hello" }, "key")).toBe("hello");
		});

		it("should throw when key is absent", () => {
			expect(() => ParamCoercion.required.string({}, "title")).toThrow("Missing required URL parameter: title");
		});
	});

	describe("required.boolean", () => {
		it("should parse 'true' as true", () => {
			expect(ParamCoercion.required.boolean({ key: "true" }, "key")).toBe(true);
		});

		it("should throw when key is absent", () => {
			expect(() => ParamCoercion.required.boolean({}, "enabled")).toThrow("Missing required URL parameter: enabled");
		});
	});

	describe("required.number", () => {
		it("should parse valid number", () => {
			expect(ParamCoercion.required.number({ key: "42" }, "key")).toBe(42);
		});

		it("should throw when key is absent", () => {
			expect(() => ParamCoercion.required.number({}, "count")).toThrow("Missing required URL parameter: count");
		});

		it("should throw for NaN values", () => {
			expect(() => ParamCoercion.required.number({ key: "abc" }, "key")).toThrow(
				'URL parameter "key" is not a valid number: abc'
			);
		});
	});

	describe("required.stringArray", () => {
		it("should split comma-separated values", () => {
			expect(ParamCoercion.required.stringArray({ key: "a,b" }, "key")).toEqual(["a", "b"]);
		});

		it("should throw when key is absent", () => {
			expect(() => ParamCoercion.required.stringArray({}, "tags")).toThrow("Missing required URL parameter: tags");
		});
	});
});
