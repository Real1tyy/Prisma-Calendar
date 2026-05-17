import { createPrismaApi } from "../../fixtures/api-helpers";
import { expect, test } from "../../fixtures/electron";

// Tier 1 contract spec for the AI surface (`aiQuery`). The action body is
// non-deterministic (LLM call), but the response *envelope* is contractual:
// `{ success: boolean, error?: string, response?: string, mode?: AIMode,
// operations?, validationErrors?, executionResult? }`.
//
// What this spec proves:
//   1. The action exists on the window surface and is callable.
//   2. The bundle-resolution failure path returns `{ success: false, error }`
//      — not a thrown exception. Consumers depend on the envelope shape;
//      throwing instead of returning would break every caller.
//
// What this spec does NOT prove:
//   - LLM response correctness (non-deterministic, would need a live AI key).
//   - End-to-end planning / manipulation flow.
//
// Those belong in an integration tier with a recorded or mocked AI backend.

test.describe("plugin api contract — AI surface via window.PrismaCalendar", () => {
	test("aiQuery against an unknown calendarId returns the failure envelope, not throws", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const result = await api.aiQuery({
			message: "List events for today",
			calendarId: "does-not-exist",
			mode: "query",
		});

		expect(result.success).toBe(false);
		// The error message is contractual — callers branch on its presence.
		expect(typeof result.error).toBe("string");
		expect(result.error!.length).not.toBe(0);
	});
});
