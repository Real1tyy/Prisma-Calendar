import { describe, expect, it } from "vitest";

import { baselineFileName, buildArtifactDir, buildRunStem, isoStamp } from "../../src/testing/stress/artifact-paths";

const FIXED = new Date("2026-05-21T18:30:00.000Z");

describe("isoStamp", () => {
	it("replaces colons and dots so the stamp is filesystem-safe", () => {
		expect(isoStamp(FIXED)).toBe("2026-05-21T18-30-00-000Z");
	});
});

describe("buildRunStem", () => {
	it("joins stamp, profile and scenario", () => {
		expect(buildRunStem({ profile: "medium", scenario: "nav", date: FIXED })).toBe(
			"2026-05-21T18-30-00-000Z_medium_nav"
		);
	});
});

describe("buildArtifactDir", () => {
	it("joins root and stem", () => {
		expect(buildArtifactDir("/tmp/perf", "stem")).toBe("/tmp/perf/stem");
	});
});

describe("baselineFileName", () => {
	it("is <scenario>.<profile>.json", () => {
		expect(baselineFileName("calendar-navigation", "medium")).toBe("calendar-navigation.medium.json");
	});
});
