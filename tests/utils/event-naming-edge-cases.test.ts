import { describe, expect, it } from "vitest";

import { hashRRuleIdToZettelFormat } from "../../src/utils/events/zettel-id";

describe("hashRRuleIdToZettelFormat", () => {
	it("should produce a 14-digit string", () => {
		const result = hashRRuleIdToZettelFormat("1234567890-abcde");
		expect(result).toHaveLength(14);
		expect(result).toMatch(/^\d{14}$/);
	});

	it("should be deterministic (same input → same output)", () => {
		const input = "1712345678901-xk9mN";
		const result1 = hashRRuleIdToZettelFormat(input);
		const result2 = hashRRuleIdToZettelFormat(input);
		expect(result1).toBe(result2);
	});

	it("should produce different hashes for different inputs", () => {
		const hash1 = hashRRuleIdToZettelFormat("1712345678901-abcde");
		const hash2 = hashRRuleIdToZettelFormat("1712345678901-fghij");
		expect(hash1).not.toBe(hash2);
	});

	it("should produce different hashes for similar but distinct rRuleIds", () => {
		const ids = [
			"1712345678900-aB1cD",
			"1712345678901-aB1cD",
			"1712345678902-aB1cD",
			"1712345678903-aB1cD",
			"1712345678904-aB1cD",
		];

		const hashes = ids.map(hashRRuleIdToZettelFormat);
		const uniqueHashes = new Set(hashes);

		expect(uniqueHashes.size).toBe(ids.length);
	});

	it("should handle empty string input", () => {
		const result = hashRRuleIdToZettelFormat("");
		expect(result).toHaveLength(14);
		expect(result).toMatch(/^\d{14}$/);
	});

	it("should handle very long input strings", () => {
		const longInput = "a".repeat(1000);
		const result = hashRRuleIdToZettelFormat(longInput);
		expect(result).toHaveLength(14);
		expect(result).toMatch(/^\d{14}$/);
	});

	it("should handle special characters in rRuleId", () => {
		const result = hashRRuleIdToZettelFormat("1712345678901-!@#$%");
		expect(result).toHaveLength(14);
		expect(result).toMatch(/^\d{14}$/);
	});

	it("should not produce collisions across a batch of realistic rRuleIds", () => {
		const hashes = new Set<string>();
		const collisions: string[] = [];

		for (let i = 0; i < 200; i++) {
			const id = `${1712345678900 + i}-${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(65 + (i % 26))}${i % 10}${String.fromCharCode(97 + ((i + 5) % 26))}${String.fromCharCode(65 + ((i + 10) % 26))}`;
			const hash = hashRRuleIdToZettelFormat(id);

			if (hashes.has(hash)) {
				collisions.push(id);
			}
			hashes.add(hash);
		}

		expect(collisions).toEqual([]);
	});
});
