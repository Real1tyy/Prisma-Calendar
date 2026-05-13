import { describe, expect, it } from "vitest";

import { compareVersions, parseVersion } from "../../../src/core/release-check/compare-versions";

describe("parseVersion", () => {
	it("strips a leading v and returns numeric segments", () => {
		expect(parseVersion("v1.2.3")).toEqual([1, 2, 3]);
		expect(parseVersion("V0.0.1")).toEqual([0, 0, 1]);
		expect(parseVersion("2.15.0")).toEqual([2, 15, 0]);
	});

	it("returns an empty array for non-numeric input", () => {
		expect(parseVersion("")).toEqual([]);
		expect(parseVersion("alpha")).toEqual([]);
	});

	it("ignores prerelease and build metadata", () => {
		expect(parseVersion("1.2.3-beta.1")).toEqual([1, 2, 3, 1]);
	});
});

describe("compareVersions", () => {
	it("returns 1 when the first version is newer", () => {
		expect(compareVersions("1.2.4", "1.2.3")).toBe(1);
		expect(compareVersions("2.0.0", "1.99.99")).toBe(1);
		expect(compareVersions("v2.15.0", "2.14.9")).toBe(1);
	});

	it("returns -1 when the first version is older", () => {
		expect(compareVersions("1.2.3", "1.2.4")).toBe(-1);
		expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
	});

	it("returns 0 when versions are equal, ignoring the v prefix", () => {
		expect(compareVersions("v1.2.3", "1.2.3")).toBe(0);
		expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
	});

	it("treats missing segments as zero", () => {
		expect(compareVersions("1.2", "1.2.0")).toBe(0);
		expect(compareVersions("1.2", "1.2.1")).toBe(-1);
		expect(compareVersions("1.3", "1.2.9")).toBe(1);
	});
});
