import { describe, expect, it } from "vitest";

import { describeError } from "../../src/utils/errors";

describe("describeError", () => {
	it("returns Error.message for Error instances", () => {
		expect(describeError(new Error("boom"))).toBe("boom");
	});

	it("returns Error.message for subclasses of Error", () => {
		class HttpError extends Error {
			constructor(public status: number) {
				super(`HTTP ${status}`);
			}
		}
		expect(describeError(new HttpError(404))).toBe("HTTP 404");
	});

	it("returns the string as-is for string values", () => {
		expect(describeError("plain string")).toBe("plain string");
		expect(describeError("")).toBe("");
	});

	it("stringifies numbers and booleans", () => {
		expect(describeError(42)).toBe("42");
		expect(describeError(0)).toBe("0");
		expect(describeError(true)).toBe("true");
		expect(describeError(false)).toBe("false");
	});

	it("returns the fallback for null and undefined", () => {
		expect(describeError(null)).toBe("unknown error");
		expect(describeError(undefined)).toBe("unknown error");
	});

	it("returns the fallback for plain objects (avoids '[object Object]')", () => {
		expect(describeError({ code: 500 })).toBe("unknown error");
	});

	it("returns the fallback for arrays", () => {
		expect(describeError([1, 2, 3])).toBe("unknown error");
	});

	it("uses the supplied fallback when provided", () => {
		expect(describeError({}, "custom")).toBe("custom");
		expect(describeError(null, "")).toBe("");
	});

	it("never returns '[object Object]'", () => {
		const result = describeError({ toString: () => "[object Object]" });
		expect(result).not.toBe("[object Object]");
		expect(result).toBe("unknown error");
	});
});
