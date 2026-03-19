import { describe, expect, it } from "vitest";

import {
	cleanupTitle,
	extractInstanceDate,
	extractNotesCoreName,
	extractZettelId,
	hashRRuleIdToZettelFormat,
	rebuildPhysicalInstanceWithNewDate,
	removeInstanceDate,
	removeZettelId,
} from "../../src/utils/event-naming";

describe("extractZettelId", () => {
	it("should extract zettel ID from hyphen-separated format", () => {
		expect(extractZettelId("Meeting-20250203140530")).toBe("20250203140530");
	});

	it("should extract zettel ID from space-separated format", () => {
		expect(extractZettelId("Meeting 20250203140530")).toBe("20250203140530");
	});

	it("should extract zettel ID from physical instance format", () => {
		expect(extractZettelId("Meeting 2025-02-03-00001125853328")).toBe("00001125853328");
	});

	it("should return null when no zettel ID present", () => {
		expect(extractZettelId("Meeting")).toBeNull();
		expect(extractZettelId("Meeting 2025-02-03")).toBeNull();
	});

	it("should not match fewer than 14 digits", () => {
		expect(extractZettelId("Meeting-1234567890123")).toBeNull();
	});
});

describe("removeZettelId", () => {
	it("should remove hyphen-separated zettel ID", () => {
		expect(removeZettelId("Meeting-20250203140530")).toBe("Meeting");
	});

	it("should remove space-separated zettel ID", () => {
		expect(removeZettelId("Meeting 20250203140530")).toBe("Meeting");
	});

	it("should preserve instance date when removing zettel from physical instance", () => {
		expect(removeZettelId("Meeting 2025-02-03-00001125853328")).toBe("Meeting 2025-02-03");
	});

	it("should return title unchanged when no zettel ID", () => {
		expect(removeZettelId("Meeting")).toBe("Meeting");
	});
});

describe("extractInstanceDate", () => {
	it("should extract date from physical recurring instance basename", () => {
		expect(extractInstanceDate("Meeting 2025-02-03-00001125853328")).toBe("2025-02-03");
	});

	it("should extract date from multi-word title instance", () => {
		expect(extractInstanceDate("Team Meeting 2025-12-31-00001125853328")).toBe("2025-12-31");
	});

	it("should return null for regular event with zettel ID only", () => {
		expect(extractInstanceDate("Meeting-20250203140530")).toBeNull();
	});

	it("should return null for event without zettel ID", () => {
		expect(extractInstanceDate("Meeting")).toBeNull();
		expect(extractInstanceDate("Meeting 2025-02-03")).toBeNull();
	});

	it("should return null for empty string", () => {
		expect(extractInstanceDate("")).toBeNull();
	});
});

describe("removeInstanceDate", () => {
	it("should remove trailing date from title", () => {
		expect(removeInstanceDate("Meeting 2025-02-03")).toBe("Meeting");
	});

	it("should not modify title without trailing date", () => {
		expect(removeInstanceDate("Meeting")).toBe("Meeting");
	});
});

describe("cleanupTitle", () => {
	it("should remove both zettel ID and instance date", () => {
		expect(cleanupTitle("Meeting 2025-02-03-00001125853328")).toBe("Meeting");
	});

	it("should remove only zettel ID from regular event", () => {
		expect(cleanupTitle("Meeting-20250203140530")).toBe("Meeting");
	});

	it("should return plain title unchanged", () => {
		expect(cleanupTitle("Meeting")).toBe("Meeting");
	});
});

describe("rebuildPhysicalInstanceWithNewDate", () => {
	it("should replace date in physical instance basename", () => {
		expect(rebuildPhysicalInstanceWithNewDate("Meeting 2025-02-03-00001125853328", "2025-03-15")).toBe(
			"Meeting 2025-03-15-00001125853328"
		);
	});

	it("should handle multi-word titles", () => {
		expect(rebuildPhysicalInstanceWithNewDate("Team Meeting 2025-02-03-00001125853328", "2025-06-01")).toBe(
			"Team Meeting 2025-06-01-00001125853328"
		);
	});

	it("should return null for non-instance basenames", () => {
		expect(rebuildPhysicalInstanceWithNewDate("Meeting-20250203140530", "2025-03-15")).toBeNull();
		expect(rebuildPhysicalInstanceWithNewDate("Meeting", "2025-03-15")).toBeNull();
	});
});

describe("hashRRuleIdToZettelFormat", () => {
	it("should produce a 14-digit string", () => {
		const result = hashRRuleIdToZettelFormat("some-rrule-id");
		expect(result).toMatch(/^\d{14}$/);
	});

	it("should be deterministic for the same input", () => {
		const a = hashRRuleIdToZettelFormat("test-id-123");
		const b = hashRRuleIdToZettelFormat("test-id-123");
		expect(a).toBe(b);
	});

	it("should produce different results for different inputs", () => {
		const a = hashRRuleIdToZettelFormat("id-1");
		const b = hashRRuleIdToZettelFormat("id-2");
		expect(a).not.toBe(b);
	});
});

describe("extractNotesCoreName", () => {
	it("should strip zettel ID from title", () => {
		expect(extractNotesCoreName("Meeting-20250203140530")).toBe("Meeting");
	});

	it("should strip ISO date format", () => {
		expect(extractNotesCoreName("Meeting 2025-02-03")).toBe("Meeting");
	});

	it("should strip day abbreviation", () => {
		expect(extractNotesCoreName("Workout Tue")).toBe("Workout");
	});

	it("should strip full day name", () => {
		expect(extractNotesCoreName("Meeting Monday")).toBe("Meeting");
	});
});
