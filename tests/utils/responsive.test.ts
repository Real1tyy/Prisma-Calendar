import { describe, expect, it } from "vitest";

import { MOBILE_BREAKPOINT_PX, shouldUseMobileLayout } from "../../src/utils/responsive";

describe("shouldUseMobileLayout", () => {
	describe("platform signal wins regardless of width", () => {
		it.each([
			{ label: "phone-width", width: 390 },
			{ label: "tablet-width", width: 1024 },
			{ label: "desktop-width", width: 1920 },
		])("treats a mobile platform as mobile at $label", ({ width }) => {
			expect(shouldUseMobileLayout({ isPlatformMobile: true, width })).toBe(true);
		});
	});

	describe("width fallback on non-mobile platforms (narrow desktop pane)", () => {
		it.each([
			{ width: 320, expected: true },
			{ width: MOBILE_BREAKPOINT_PX - 1, expected: true },
			{ width: MOBILE_BREAKPOINT_PX, expected: true },
			{ width: MOBILE_BREAKPOINT_PX + 1, expected: false },
			{ width: 1920, expected: false },
		])("width $width → $expected", ({ width, expected }) => {
			expect(shouldUseMobileLayout({ isPlatformMobile: false, width })).toBe(expected);
		});
	});

	it("honours a custom breakpoint override", () => {
		expect(shouldUseMobileLayout({ isPlatformMobile: false, width: 900, breakpoint: 1000 })).toBe(true);
		expect(shouldUseMobileLayout({ isPlatformMobile: false, width: 1100, breakpoint: 1000 })).toBe(false);
	});
});
