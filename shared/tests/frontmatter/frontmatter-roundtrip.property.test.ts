import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
	createFileContentWithFrontmatter,
	parseFileContent,
} from "../../src/core/frontmatter/frontmatter-serialization";

// Frontmatter keys in Obsidian are YAML mapping keys. Keep them simple —
// identifiers, no special YAML chars, no reserved prototype names.
const RESERVED_KEYS = new Set([
	"toString",
	"valueOf",
	"hasOwnProperty",
	"constructor",
	"__proto__",
	"isPrototypeOf",
	"propertyIsEnumerable",
	"toLocaleString",
]);

const arbKey = fc
	.string({ minLength: 1, maxLength: 15 })
	.filter((s) => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(s) && !RESERVED_KEYS.has(s));

const arbScalar = fc.oneof(
	fc.string({ minLength: 0, maxLength: 40 }).filter((s) => !/[\r\n]/.test(s)),
	fc.integer({ min: -1_000_000, max: 1_000_000 }),
	fc.boolean()
);

const arbStringArray = fc.array(
	fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !/[\r\n:#]/.test(s)),
	{ maxLength: 5 }
);

const arbFrontmatterValue = fc.oneof(arbScalar, arbStringArray);

const arbFrontmatter = fc.dictionary(arbKey, arbFrontmatterValue, {
	minKeys: 0,
	maxKeys: 8,
});

const arbBody = fc.oneof(
	fc.constant(""),
	fc
		.string({ minLength: 0, maxLength: 200 })
		// `createFileContentWithFrontmatter` trims leading newlines off the body,
		// and our normalization would make round-trip comparison ambiguous.
		.map((s) => s.replace(/^\n+/, ""))
);

describe("frontmatter serialization round-trip", () => {
	it("createFileContentWithFrontmatter then parseFileContent recovers the original body", () => {
		fc.assert(
			fc.property(arbFrontmatter, arbBody, (fm, body) => {
				const content = createFileContentWithFrontmatter(fm, body);
				const { body: recoveredBody } = parseFileContent(content);

				// parseFileContent trims the body; we emitted trailing content as-is,
				// so compare after trimming both sides to normalize whitespace differences.
				expect(recoveredBody.trim()).toBe(body.trim());
			}),
			{ numRuns: 200 }
		);
	});

	it("content with no frontmatter is preserved as-is in body", () => {
		fc.assert(
			fc.property(arbBody, (body) => {
				const content = createFileContentWithFrontmatter({}, body);
				const { body: recovered } = parseFileContent(content);

				expect(recovered).toBe(body);
			}),
			{ numRuns: 100 }
		);
	});

	it("empty frontmatter produces content without YAML block", () => {
		fc.assert(
			fc.property(arbBody, (body) => {
				const content = createFileContentWithFrontmatter({}, body);
				expect(content.startsWith("---\n")).toBe(false);
			}),
			{ numRuns: 50 }
		);
	});

	it("non-empty frontmatter always starts with --- delimiter", () => {
		fc.assert(
			fc.property(
				arbFrontmatter.filter((fm) => Object.keys(fm).length > 0),
				arbBody,
				(fm, body) => {
					const content = createFileContentWithFrontmatter(fm, body);
					expect(content.startsWith("---\n")).toBe(true);
				}
			),
			{ numRuns: 100 }
		);
	});

	it("round-trip is idempotent: parse(build(parse(build(x)))) === parse(build(x))", () => {
		fc.assert(
			fc.property(arbFrontmatter, arbBody, (fm, body) => {
				const first = createFileContentWithFrontmatter(fm, body);
				const parsed = parseFileContent(first);
				const second = createFileContentWithFrontmatter(fm, parsed.body);
				const parsed2 = parseFileContent(second);

				expect(parsed2.body).toBe(parsed.body);
			}),
			{ numRuns: 100 }
		);
	});

	it("never throws on arbitrary well-formed frontmatter + body input", () => {
		fc.assert(
			fc.property(arbFrontmatter, arbBody, (fm, body) => {
				expect(() => {
					const content = createFileContentWithFrontmatter(fm, body);
					parseFileContent(content);
				}).not.toThrow();
			}),
			{ numRuns: 200 }
		);
	});
});
