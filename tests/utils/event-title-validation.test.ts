import { describe, expect, it } from "vitest";

import { ILLEGAL_TITLE_CHARS, validateEventTitle } from "../../src/utils/event-title-validation";

describe("validateEventTitle", () => {
	it("accepts empty titles (untitled events are allowed elsewhere in the flow)", () => {
		expect(validateEventTitle("")).toEqual({ ok: true });
		expect(validateEventTitle("   ")).toEqual({ ok: true });
	});

	it("accepts normal titles including spaces, punctuation, unicode and emoji", () => {
		expect(validateEventTitle("Team Meeting").ok).toBe(true);
		expect(validateEventTitle("Daily Stand-up (9am)").ok).toBe(true);
		expect(validateEventTitle("Workout 🏋️").ok).toBe(true);
		expect(validateEventTitle("会議 — 1").ok).toBe(true);
	});

	it("rejects every individual filename-illegal character", () => {
		for (const ch of ILLEGAL_TITLE_CHARS) {
			const result = validateEventTitle(`Event ${ch} title`);
			expect(result.ok, `"${ch}" must be rejected`).toBe(false);
			if (!result.ok) {
				expect(result.illegalChars).toContain(ch);
				expect(result.message).toContain(`"${ch}"`);
			}
		}
	});

	it("reports every distinct illegal character when multiple are present", () => {
		const result = validateEventTitle("a/b\\c:d*e");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(new Set(result.illegalChars)).toEqual(new Set(["/", "\\", ":", "*"]));
		}
	});

	it("uses singular grammar for one illegal character and plural for multiple", () => {
		const single = validateEventTitle("a/b");
		const multiple = validateEventTitle("a/b:c");
		expect(single.ok).toBe(false);
		expect(multiple.ok).toBe(false);
		if (!single.ok) expect(single.message).toContain("this character");
		if (!multiple.ok) expect(multiple.message).toContain("these characters");
	});
});
