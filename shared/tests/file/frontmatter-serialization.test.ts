import { describe, expect, it } from "vitest";

import {
	createFileContentWithFrontmatter,
	parseFileContent,
} from "../../src/core/frontmatter/frontmatter-serialization";

describe("Frontmatter Serialization", () => {
	describe("createFileContentWithFrontmatter", () => {
		it("should create file content with simple frontmatter", () => {
			const result = createFileContentWithFrontmatter({ title: "Test Event", date: "2025-02-15" }, "# Test Content");

			expect(result).toBe("---\ntitle: Test Event\ndate: 2025-02-15\n---\n# Test Content");
		});

		it("should have exactly one newline between closing fence and content", () => {
			const result = createFileContentWithFrontmatter({ title: "Test" }, "## Summary:");

			expect(result).toBe("---\ntitle: Test\n---\n## Summary:");
			expect(result).not.toContain("---\n\n");
		});

		it("should return just content when frontmatter is empty", () => {
			expect(createFileContentWithFrontmatter({}, "# Content")).toBe("# Content");
		});

		it("should return just content when frontmatter is null", () => {
			expect(createFileContentWithFrontmatter(null as unknown as Record<string, unknown>, "# Content")).toBe(
				"# Content"
			);
		});

		it("should return frontmatter-only with trailing newline when no content", () => {
			const result = createFileContentWithFrontmatter({ title: "Test" });
			expect(result).toBe("---\ntitle: Test\n---\n");
		});

		it("should return frontmatter-only with trailing newline for empty content", () => {
			const result = createFileContentWithFrontmatter({ title: "Test" }, "");
			expect(result).toBe("---\ntitle: Test\n---\n");
		});

		it("should handle arrays", () => {
			const result = createFileContentWithFrontmatter({
				tags: ["work", "project"],
				categories: ["meeting"],
			});

			expect(result).toContain("tags:");
			expect(result).toContain("- work");
			expect(result).toContain("- project");
			expect(result).toContain("- meeting");
		});

		it("should handle nested objects", () => {
			const result = createFileContentWithFrontmatter({
				metadata: { author: "Alice", version: 1 },
			});

			expect(result).toContain("metadata:");
			expect(result).toContain("author: Alice");
		});

		it("should handle special characters", () => {
			const result = createFileContentWithFrontmatter({
				title: "Meeting: Q&A Session",
				link: "[[Project A]]",
			});

			expect(result).toContain("Meeting: Q&A Session");
			expect(result).toContain("[[Project A]]");
		});

		it("should handle boolean values", () => {
			const result = createFileContentWithFrontmatter({
				"All Day": true,
				completed: false,
			});

			expect(result).toContain("All Day: true");
			expect(result).toContain("completed: false");
		});

		it("should handle number values", () => {
			const result = createFileContentWithFrontmatter({
				duration: 60,
				priority: 1,
				percentage: 85.5,
			});

			expect(result).toContain("duration: 60");
			expect(result).toContain("priority: 1");
			expect(result).toContain("percentage: 85.5");
		});

		it("should handle empty strings as quoted YAML", () => {
			const result = createFileContentWithFrontmatter({
				title: "Meeting",
				Date: "",
				End: "",
			});

			expect(result).toContain("title: Meeting");
			expect(result).toContain('Date: ""');
			expect(result).toContain('End: ""');
		});

		it("should handle null values as empty", () => {
			const result = createFileContentWithFrontmatter({
				title: "Meeting",
				categories: null,
			});

			expect(result).toContain("title: Meeting");
			expect(result).toMatch(/categories:\s*$/m);
		});

		it("should strip leading newlines from content", () => {
			const result = createFileContentWithFrontmatter({ title: "Test" }, "\n\n\n# Content");
			expect(result).toBe("---\ntitle: Test\n---\n# Content");
		});

		it("should handle complex real-world Obsidian frontmatter", () => {
			const frontmatter = {
				Author: ["[[Authors/Alice|Alice]]"],
				"Backlink Tags": [],
				Related: null,
				Aliases: null,
				Language: "English",
				URL: null,
				"Viewed Amount": 0,
				Quality: null,
				Image: "[[Books/Sample-Book.webp]]",
				_ZettelID: "20260115132527",
				_Archived: false,
				_LastModifiedTime: "20260115132527",
				Title: "[[Books/Sample Book|Sample Book]]",
			};

			const content = "## Summary:\n\n\n---\n## Transcript:";

			const result = createFileContentWithFrontmatter(frontmatter, content);

			expect(result).toMatch(/^---\n/);
			expect(result).toMatch(/\n---\n## Summary:/);
			expect(result).not.toMatch(/\n---\n\n## Summary:/);
			expect(result).toContain("Language: English");
			expect(result).toContain("_Archived: false");
			expect(result).toContain("Viewed Amount: 0");
			expect(result).toContain("[[Books/Sample Book|Sample Book]]");
		});

		it("should handle complex event frontmatter", () => {
			const frontmatter = {
				Title: "Team Meeting",
				"Start Date": "2025-02-15T10:00:00",
				"End Date": "2025-02-15T11:00:00",
				"All Day": false,
				categories: ["work", "meetings"],
				Goal: "[[Projects/Q1 Planning]]",
				_ZettelID: "20250203140530",
			};

			const result = createFileContentWithFrontmatter(frontmatter, "# Team Meeting\n\n## Agenda\n- Review Q1 goals");

			expect(result).toMatch(/\n---\n# Team Meeting/);
			expect(result).toContain("- work");
			expect(result).toContain("[[Projects/Q1 Planning]]");
		});

		it("should produce valid frontmatter structure with opening and closing fences", () => {
			const result = createFileContentWithFrontmatter({ a: 1 }, "body");
			const lines = result.split("\n");

			expect(lines[0]).toBe("---");
			expect(lines[2]).toBe("---");
		});

		it("should handle multiline string content after frontmatter", () => {
			const content = "Line 1\nLine 2\nLine 3";
			const result = createFileContentWithFrontmatter({ title: "Test" }, content);

			expect(result).toBe("---\ntitle: Test\n---\nLine 1\nLine 2\nLine 3");
		});
	});

	describe("parseFileContent", () => {
		it("should split frontmatter from body", () => {
			const input = "---\ntitle: Test\n---\n## Summary:";
			const { body } = parseFileContent(input);
			expect(body).toBe("## Summary:");
		});

		it("should handle content with no frontmatter", () => {
			const input = "Just some text";
			const { frontmatter, body } = parseFileContent(input);
			expect(frontmatter).toEqual({});
			expect(body).toBe("Just some text");
		});

		it("should trim body content", () => {
			const input = "---\ntitle: Test\n---\n\n## Content\n\n";
			const { body } = parseFileContent(input);
			expect(body).toBe("## Content");
		});

		it("should handle empty body after frontmatter", () => {
			const input = "---\ntitle: Test\n---\n";
			const { body } = parseFileContent(input);
			expect(body).toBe("");
		});

		it("should handle frontmatter with multiple fields", () => {
			const input = "---\ntitle: Test\ndate: 2025-01-01\ntags:\n  - a\n  - b\n---\nBody";
			const { body } = parseFileContent(input);
			expect(body).toBe("Body");
		});
	});

	describe("roundtrip: create then parse", () => {
		it("should roundtrip simple content", () => {
			const original = "## Summary:\n\nSome text here.";
			const created = createFileContentWithFrontmatter({ title: "Test" }, original);
			const { body } = parseFileContent(created);
			expect(body).toBe(original);
		});

		it("should roundtrip content containing --- separators", () => {
			const original = "## Summary:\n\n\n---\n## Transcript:";
			const created = createFileContentWithFrontmatter({ title: "Test" }, original);
			const { body } = parseFileContent(created);
			expect(body).toBe(original);
		});

		it("should roundtrip empty content", () => {
			const created = createFileContentWithFrontmatter({ title: "Test" }, "");
			const { body } = parseFileContent(created);
			expect(body).toBe("");
		});
	});
});
