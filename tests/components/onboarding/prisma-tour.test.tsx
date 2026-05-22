// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type CustomCalendarPlugin from "../../../src/main";
import { buildPrismaTourSteps } from "../../../src/react/onboarding/prisma-tour";

// The before-hooks are never invoked here, so a bare stub is enough to build the
// step list and assert its shape — the runtime behaviour is covered by the E2E spec.
const stubPlugin = {} as unknown as CustomCalendarPlugin;

const EXPECTED_IDS = [
	"welcome",
	"first-event",
	"drag-and-drop",
	"open-event",
	"create-event",
	"switch-views",
	"finish",
];

describe("buildPrismaTourSteps", () => {
	it("defines the full onboarding journey in order", () => {
		const steps = buildPrismaTourSteps(stubPlugin);
		expect(steps.map((s) => s.id)).toEqual(EXPECTED_IDS);
	});

	it("opens and closes with centered, target-less steps", () => {
		const steps = buildPrismaTourSteps(stubPlugin);
		const first = steps[0];
		const last = steps[steps.length - 1];

		for (const step of [first, last]) {
			expect(step.target).toBeUndefined();
			expect(step.placement).toBe("center");
		}
	});

	it("anchors the event steps to the sample tile without auto-scrolling", () => {
		const steps = buildPrismaTourSteps(stubPlugin);
		const eventSteps = steps.filter((s) => ["first-event", "drag-and-drop", "open-event"].includes(s.id ?? ""));

		expect(eventSteps).toHaveLength(3);
		for (const step of eventSteps) {
			expect(step.target).toContain('[data-event-title="Your first event"]');
			expect(step.disableScroll).toBe(true);
		}
	});

	it("seeds and navigates only on the steps that need it", () => {
		const steps = buildPrismaTourSteps(stubPlugin);
		const withBefore = steps.filter((s) => typeof s.before === "function").map((s) => s.id);

		expect(withBefore).toEqual(["welcome", "first-event", "create-event", "switch-views"]);
	});

	it("makes the hands-on steps fully interactive so the overlay never blocks drag/open/create", () => {
		const steps = buildPrismaTourSteps(stubPlugin);
		const interactionById = Object.fromEntries(steps.map((s) => [s.id, s.interaction]));

		expect(interactionById["drag-and-drop"]).toBe("page");
		expect(interactionById["open-event"]).toBe("page");
		expect(interactionById["create-event"]).toBe("page");
		// Explanatory steps stay read-only (undefined → "none" in the host engine).
		expect(interactionById["first-event"]).toBeUndefined();
		expect(interactionById["switch-views"]).toBeUndefined();
	});

	it("gives every step renderable content", () => {
		const steps = buildPrismaTourSteps(stubPlugin);
		for (const step of steps) {
			expect(step.content).toBeTruthy();
		}
	});
});
