import { describe, expect, it, vi } from "vitest";

import { toJoyrideStep } from "../../src/onboarding/tour-host";
import type { TourStep } from "../../src/onboarding/tour-types";

const base: TourStep = { content: "hi", target: ".x" };

describe("toJoyrideStep", () => {
	it.each([
		["none (default)", undefined, true, false],
		["none", "none", true, false],
		["target", "target", false, false],
		["page", "page", false, true],
	] as const)(
		"maps interaction=%s to blockTargetInteraction=%s / hideOverlay=%s",
		(_label, interaction, block, hide) => {
			const step = toJoyrideStep({ ...base, ...(interaction ? { interaction } : {}) });
			expect(step.blockTargetInteraction).toBe(block);
			expect(step.hideOverlay).toBe(hide);
		}
	);

	it("centers a target-less step and falls back to the body target", () => {
		const step = toJoyrideStep({ content: "x" });
		expect(step.placement).toBe("center");
		expect(step.target).toBe("body");
	});

	it("auto-places a targeted step and maps disableScroll → skipScroll", () => {
		const step = toJoyrideStep({ content: "x", target: ".y", disableScroll: true });
		expect(step.placement).toBe("auto");
		expect(step.skipScroll).toBe(true);
	});

	it("wraps the before-hook so the tour awaits it (discarding its return value)", async () => {
		const before = vi.fn().mockResolvedValue("ignored");
		const step = toJoyrideStep({ content: "x", before });
		await (step.before as () => Promise<void>)();
		expect(before).toHaveBeenCalledTimes(1);
	});
});
