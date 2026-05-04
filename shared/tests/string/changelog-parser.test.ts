import { describe, expect, it } from "vitest";

import {
	formatChangelogSections,
	getChangelogSince,
	parseChangelog,
	resolveRelativeDocLinks,
} from "../../src/utils/string/changelog-parser";

const MOCK_CHANGELOG = `# Changelog

All notable changes to this project will be documented here.

## 1.27.0

### New Features

- **Customizable Calendar Toolbar**: Configure which buttons appear in the calendar toolbar.

### Breaking Changes

- **Deprecated Setting Removed**: The "Show untracked events dropdown" toggle has been removed.

---

## 1.26.0

### New Features

- **Untracked Event Filtering**: Filter untracked events based on frontmatter properties.

- **Untracked Events Dropdown**: New reactive dropdown showing events without date properties.

### Improvements

- **Immediate Command Availability**: Commands now work immediately after switching to a calendar view.

---

## 1.25.0

### New Features

- **Drag-to-Create Events**: You can now drag on the timeline to create events.

- **Fast Event Editing Commands**: Added five keyboard-friendly commands for rapid event time management.

### Bug Fixes

- **Fixed Default Duration for Timeline Click-to-Create**: Fixed an issue where clicking on the timeline always used 60 minutes.

## 1.24.0

### New Features

- **Auto-Category Assignment**: Categories can now be automatically assigned to new events.

## 1.23.0

### New Features

- **Sticky Headers for Better Scrolling**: Added configurable sticky headers for weekly and daily views.
`;

describe("Changelog Parser", () => {
	describe("parseChangelog", () => {
		it("should parse all version sections correctly", () => {
			const sections = parseChangelog(MOCK_CHANGELOG);

			expect(sections).toHaveLength(5);
			expect(sections.map((s) => s.version)).toEqual(["1.27.0", "1.26.0", "1.25.0", "1.24.0", "1.23.0"]);
		});

		it("should extract content without version heading", () => {
			const sections = parseChangelog(MOCK_CHANGELOG);

			expect(sections[0].version).toBe("1.27.0");
			expect(sections[0].content).not.toContain("## 1.27.0");
			expect(sections[0].content).toContain("### New Features");
		});

		it("should handle empty changelog", () => {
			const sections = parseChangelog("");

			expect(sections).toHaveLength(0);
		});

		it("should handle changelog without versions", () => {
			const sections = parseChangelog("# Changelog\n\nSome text without versions");

			expect(sections).toHaveLength(0);
		});
	});

	describe("getChangelogSince", () => {
		it("should return changelog sections between two versions (exclusive/inclusive)", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.24.0", "1.27.0");

			expect(sections).toHaveLength(3);
			expect(sections[0].version).toBe("1.27.0");
			expect(sections[1].version).toBe("1.26.0");
			expect(sections[2].version).toBe("1.25.0");
		});

		it("should return single version when from and to are adjacent", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.25.0", "1.26.0");

			expect(sections).toHaveLength(1);
			expect(sections[0].version).toBe("1.26.0");
		});

		it("should return empty array when fromVersion is greater than toVersion", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.27.0", "1.24.0");

			expect(sections).toHaveLength(0);
		});

		it("should return empty array when fromVersion equals toVersion", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.26.0", "1.26.0");

			expect(sections).toHaveLength(0);
		});

		it("should include toVersion but exclude fromVersion", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.23.0", "1.25.0");

			expect(sections).toHaveLength(2);
			expect(sections.map((s) => s.version)).toEqual(["1.25.0", "1.24.0"]);
			expect(sections.map((s) => s.version)).not.toContain("1.23.0");
		});

		it("should handle version with default value 1.1.0", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.1.0", "1.24.0");

			expect(sections.length).toBeGreaterThan(0);
			expect(sections[sections.length - 1].version).toBe("1.23.0");
		});

		it("should parse content correctly for each version", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.26.0", "1.27.0");

			expect(sections).toHaveLength(1);
			expect(sections[0].content).toContain("Customizable Calendar Toolbar");
			expect(sections[0].content).toContain("Breaking Changes");
			expect(sections[0].content).toContain("Deprecated Setting Removed");
		});

		it("should handle multi-section content", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.24.0", "1.26.0");

			expect(sections).toHaveLength(2);
			expect(sections[0].content).toContain("Untracked Event Filtering");
			expect(sections[0].content).toContain("Immediate Command Availability");
			expect(sections[1].content).toContain("Drag-to-Create Events");
			expect(sections[1].content).toContain("Fast Event Editing Commands");
		});
	});

	describe("formatChangelogSections", () => {
		it("should format single section correctly", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.26.0", "1.27.0");
			const formatted = formatChangelogSections(sections);

			expect(formatted).toContain("## 1.27.0");
			expect(formatted).toContain("### New Features");
			expect(formatted).toContain("Customizable Calendar Toolbar");
		});

		it("should format multiple sections with separators", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.24.0", "1.27.0");
			const formatted = formatChangelogSections(sections);

			expect(formatted).toContain("## 1.27.0");
			expect(formatted).toContain("## 1.26.0");
			expect(formatted).toContain("## 1.25.0");
		});

		it("should return 'No changes found' for empty sections", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.27.0", "1.24.0");
			const formatted = formatChangelogSections(sections);

			expect(formatted).toBe("No changes found.");
		});

		it("should preserve markdown formatting", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.25.0", "1.26.0");
			const formatted = formatChangelogSections(sections);

			expect(formatted).toContain("### New Features");
			expect(formatted).toContain("- **");
			expect(formatted).toContain("**:");
		});

		it("should trim whitespace from content", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.26.0", "1.27.0");
			const formatted = formatChangelogSections(sections);

			expect(formatted).not.toMatch(/\n\n\n+/);
			expect(formatted.trim()).toBe(formatted);
		});

		it("should escape Dataview inline queries", () => {
			const mockSections = parseChangelog(
				"## 1.0.0\n\n- Fixed `=this.property` query\n- Added `=dateformat(now)` support"
			);
			const formatted = formatChangelogSections(mockSections);

			expect(formatted).toContain("`\\=this.property`");
			expect(formatted).toContain("`\\=dateformat(now)`");
		});
	});

	describe("version comparison edge cases", () => {
		it("should handle patch version differences", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.26.0", "1.27.0");
			expect(sections.length).toBeGreaterThanOrEqual(1);
		});

		it("should handle minor version differences", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.20.0", "1.27.0");
			expect(sections.length).toBeGreaterThan(1);
		});

		it("should handle non-existent versions gracefully", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.99.0", "2.0.0");
			expect(sections).toHaveLength(0);
		});

		it("should handle versions with leading zeros", () => {
			const sections1 = getChangelogSince(MOCK_CHANGELOG, "1.1.0", "1.23.0");
			expect(sections1.length).toBeGreaterThan(0);
		});
	});

	describe("content structure", () => {
		it("should not include version heading in content", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.26.0", "1.27.0");

			expect(sections[0].version).toBe("1.27.0");
			expect(sections[0].content).not.toContain("## 1.27.0");
		});

		it("should include all subsections in content", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.24.0", "1.25.0");

			expect(sections[0].content).toContain("### New Features");
			expect(sections[0].content).toContain("### Bug Fixes");
		});

		it("should handle bullet points correctly", () => {
			const sections = getChangelogSince(MOCK_CHANGELOG, "1.26.0", "1.27.0");

			expect(sections[0].content).toMatch(/- \*\*.*\*\*:/);
		});

		it("should preserve horizontal rules in content", () => {
			const sections = parseChangelog(MOCK_CHANGELOG);

			// Some sections have --- in their content
			expect(sections[0].content).toContain("---");
		});
	});
});

const DOCS_BASE_WITH_UTM =
	"https://real1tyy.github.io/Prisma-Calendar/?utm_campaign=prisma_calendar&utm_source=plugin&utm_medium=whats_new&utm_content=documentation";
const DOCS_BASE_CLEAN = "https://real1tyy.github.io/Prisma-Calendar/";

const UTM_PREFIX = "utm_campaign=prisma_calendar&utm_source=plugin&utm_medium=whats_new&utm_content=";
const BASE = "https://real1tyy.github.io/Prisma-Calendar";

describe("resolveRelativeDocLinks", () => {
	describe("path resolution with full URL verification", () => {
		it("converts ./path.md to absolute URL with all UTM params", () => {
			const result = resolveRelativeDocLinks("[Quick Start](./quickstart.md)", DOCS_BASE_WITH_UTM);

			expect(result).toBe(`[Quick Start](${BASE}/quickstart?${UTM_PREFIX}quickstart)`);
		});

		it("resolves nested relative paths with all UTM params", () => {
			const result = resolveRelativeDocLinks("[Event Groups](./features/events/event-groups.md)", DOCS_BASE_WITH_UTM);

			expect(result).toBe(`[Event Groups](${BASE}/features/events/event-groups?${UTM_PREFIX}event_groups)`);
		});

		it("preserves fragment anchors after UTM params", () => {
			const result = resolveRelativeDocLinks("[License](./configuration/general.md#license)", DOCS_BASE_WITH_UTM);

			expect(result).toBe(`[License](${BASE}/configuration/general?${UTM_PREFIX}general#license)`);
		});

		it("handles deeply nested paths with fragments", () => {
			const result = resolveRelativeDocLinks(
				"[Series Shortcuts](./features/events/event-groups.md#series-shortcuts-in-context-menu)",
				DOCS_BASE_WITH_UTM
			);

			expect(result).toBe(
				`[Series Shortcuts](${BASE}/features/events/event-groups?${UTM_PREFIX}event_groups#series-shortcuts-in-context-menu)`
			);
		});

		it("handles relative paths without .md extension", () => {
			const result = resolveRelativeDocLinks("[Features](./features)", DOCS_BASE_WITH_UTM);

			expect(result).toBe(`[Features](${BASE}/features?${UTM_PREFIX}features)`);
		});

		it("handles clean base URL (no UTM inheritance)", () => {
			const result = resolveRelativeDocLinks("[QS](./quickstart.md)", DOCS_BASE_CLEAN);

			expect(result).toBe(`[QS](${BASE}/quickstart?utm_content=quickstart)`);
		});
	});

	describe("UTM parameter handling", () => {
		it("replaces hyphens with underscores in utm_content", () => {
			const result = resolveRelativeDocLinks("[Rules](./features/organization/color-rules.md)", DOCS_BASE_WITH_UTM);

			expect(result).toBe(`[Rules](${BASE}/features/organization/color-rules?${UTM_PREFIX}color_rules)`);
		});

		it("overrides base utm_content=documentation with path-derived value", () => {
			const result = resolveRelativeDocLinks("[QS](./quickstart.md)", DOCS_BASE_WITH_UTM);

			expect(result).not.toContain("utm_content=documentation");
			expect(result).toContain("utm_content=quickstart");
		});

		it("inherits utm_medium=settings when opened from settings", () => {
			const settingsBase =
				"https://real1tyy.github.io/Prisma-Calendar/?utm_campaign=prisma_calendar&utm_source=plugin&utm_medium=settings&utm_content=documentation";
			const result = resolveRelativeDocLinks("[QS](./quickstart.md)", settingsBase);

			expect(result).toBe(
				`[QS](${BASE}/quickstart?utm_campaign=prisma_calendar&utm_source=plugin&utm_medium=settings&utm_content=quickstart)`
			);
		});

		it("ignores non-utm query params in base URL", () => {
			const result = resolveRelativeDocLinks(
				"[QS](./quickstart.md)",
				"https://example.com/docs?foo=bar&utm_campaign=test"
			);

			expect(result).toBe("[QS](https://example.com/docs/quickstart?utm_campaign=test&utm_content=quickstart)");
		});
	});

	describe("passthrough — links that should NOT be transformed", () => {
		it("leaves absolute https URLs untouched", () => {
			const md = "[Video](https://youtu.be/abc123)";

			expect(resolveRelativeDocLinks(md, DOCS_BASE_WITH_UTM)).toBe(md);
		});

		it("leaves absolute http URLs untouched", () => {
			const md = "[Old](http://example.com)";

			expect(resolveRelativeDocLinks(md, DOCS_BASE_WITH_UTM)).toBe(md);
		});

		it("leaves anchor-only links untouched", () => {
			const md = "[Section](#my-section)";

			expect(resolveRelativeDocLinks(md, DOCS_BASE_WITH_UTM)).toBe(md);
		});

		it("leaves bare text without links untouched", () => {
			const md = "No links here, just **bold** text.";

			expect(resolveRelativeDocLinks(md, DOCS_BASE_WITH_UTM)).toBe(md);
		});

		it("leaves image syntax untouched", () => {
			const md = "![Screenshot](./images/screenshot.png)";

			expect(resolveRelativeDocLinks(md, DOCS_BASE_WITH_UTM)).toBe(md);
		});
	});

	describe("multiple links", () => {
		it("resolves all relative links in one line with correct per-link UTM", () => {
			const result = resolveRelativeDocLinks(
				"See [QS](./quickstart.md) and [General](./configuration/general.md).",
				DOCS_BASE_WITH_UTM
			);

			expect(result).toBe(
				`See [QS](${BASE}/quickstart?${UTM_PREFIX}quickstart) and [General](${BASE}/configuration/general?${UTM_PREFIX}general).`
			);
		});

		it("resolves relative links and leaves absolute links across lines", () => {
			const md = [
				"- [Quick Start](./quickstart.md)",
				"- [Timeline](./features/views/timeline.md#live-updates)",
				"- [Video](https://youtu.be/abc)",
			].join("\n");
			const result = resolveRelativeDocLinks(md, DOCS_BASE_WITH_UTM);

			expect(result).toBe(
				[
					`- [Quick Start](${BASE}/quickstart?${UTM_PREFIX}quickstart)`,
					`- [Timeline](${BASE}/features/views/timeline?${UTM_PREFIX}timeline#live-updates)`,
					"- [Video](https://youtu.be/abc)",
				].join("\n")
			);
		});
	});

	describe("real changelog patterns", () => {
		it("produces exact output for Prisma Calendar changelog entry", () => {
			const md =
				"- **Series shortcuts**: See [Event Groups → Series Shortcuts](./features/events/event-groups.md#series-shortcuts-in-context-menu).";
			const result = resolveRelativeDocLinks(md, DOCS_BASE_WITH_UTM);

			expect(result).toBe(
				`- **Series shortcuts**: See [Event Groups → Series Shortcuts](${BASE}/features/events/event-groups?${UTM_PREFIX}event_groups#series-shortcuts-in-context-menu).`
			);
		});

		it("transforms relative links but preserves absolute YouTube links", () => {
			const md = [
				"> **TLDR:** New [Quick Start Video](https://youtu.be/abc) covering setup.",
				"- **Quick Start Video**: See [Quick Start](./quickstart.md).",
				"- **Welcome flow**: See [Quick Start](./quickstart.md#initial-setup).",
				"- **Subscription**: See [License](./configuration/general.md#license).",
			].join("\n");
			const result = resolveRelativeDocLinks(md, DOCS_BASE_WITH_UTM);

			expect(result).toBe(
				[
					"> **TLDR:** New [Quick Start Video](https://youtu.be/abc) covering setup.",
					`- **Quick Start Video**: See [Quick Start](${BASE}/quickstart?${UTM_PREFIX}quickstart).`,
					`- **Welcome flow**: See [Quick Start](${BASE}/quickstart?${UTM_PREFIX}quickstart#initial-setup).`,
					`- **Subscription**: See [License](${BASE}/configuration/general?${UTM_PREFIX}general#license).`,
				].join("\n")
			);
		});

		it("preserves special characters in link text", () => {
			const result = resolveRelativeDocLinks(
				"[Color Rules → Multi-Color](./features/organization/color-rules.md#multi-color)",
				DOCS_BASE_WITH_UTM
			);

			expect(result).toBe(
				`[Color Rules → Multi-Color](${BASE}/features/organization/color-rules?${UTM_PREFIX}color_rules#multi-color)`
			);
		});
	});

	describe("edge cases", () => {
		it("returns empty string for empty input", () => {
			expect(resolveRelativeDocLinks("", DOCS_BASE_WITH_UTM)).toBe("");
		});

		it("handles base URL with trailing slash", () => {
			const result = resolveRelativeDocLinks("[QS](./quickstart.md)", "https://example.com/docs/");

			expect(result).toBe("[QS](https://example.com/docs/quickstart?utm_content=quickstart)");
		});

		it("handles base URL without trailing slash", () => {
			const result = resolveRelativeDocLinks("[QS](./quickstart.md)", "https://example.com/docs");

			expect(result).toBe("[QS](https://example.com/docs/quickstart?utm_content=quickstart)");
		});

		it("handles fragment-only .md path", () => {
			const result = resolveRelativeDocLinks("[Sec](./page.md#section)", DOCS_BASE_CLEAN);

			expect(result).toBe(`[Sec](${BASE}/page?utm_content=page#section)`);
		});
	});
});
