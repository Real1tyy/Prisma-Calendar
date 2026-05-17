import { createPrismaApi } from "../../fixtures/api-helpers";
import { todayISO } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";

// Tier 1 contract spec for `navigateToDate`. The handler activates the
// calendar view, resolves `viewRef.calendarComponent`, and calls
// `calendarComponent.navigateToDate(date, view)`. Two failure modes are
// silently-false: missing calendar component (no open view) and invalid
// date string. Both are user-reachable through the action surface and
// untested elsewhere.
//
// ─── KNOWN WEAKNESS / FUTURE WORK ────────────────────────────────────
// This spec is intentionally the *weakest* of the window-api-* family.
// It only asserts on the boolean return value — it does NOT verify that
// FullCalendar's viewport actually moved. A regression where
// `cal.gotoDate(date)` silently no-ops would still let
// `navigateToDate(...)` return true and these tests would pass.
//
// We tried the stronger version (read `cal.getDate()` after each call
// and assert it matches the target) but `cal.getDate()` throws "Cannot
// read properties of undefined (reading 'getCurrentData')" until FC's
// `currentDataManager` is wired up. Even after `calendar.goToDate(...)`
// primes FC via `gotoDate`, `getDate()` kept returning null in the
// polling helper — the spec was slower and flakier than it earned.
//
// Right shape for a future pass:
//   * Add a `waitForCalendarReady(page)` helper that polls until
//     `cal.currentDataManager != null && cal.view != null` before any
//     getDate read. Use it as the gate for a viewport-verifying spec.
//   * Once viewport reads are reliable: collapse the four boolean
//     smoke tests below into one spec that drives `navigateToDate` to a
//     known target, asserts FC's `getDate()` equals it, then asserts the
//     bad-input variants leave it unchanged.
//   * Add coverage for the `view` param (e.g. `view: "timeGridDay"`)
//     and assert FC's `.view.type` flipped accordingly.
//   * Cross-check that an event tile rendered at `date` is reachable via
//     `eventByTitle(...)` after navigation — proves the viewport mounted
//     and didn't just shift its anchor variable.
//
// Until that helper exists, treat this spec as a smoke test for
// "navigateToDate is callable and returns a boolean of the right
// polarity" — not as a behavior test.

test.describe("plugin api contract — navigation via window.PrismaCalendar", () => {
	test("navigateToDate with today's ISO returns true", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);
		expect(await api.navigateToDate({ date: todayISO() })).toBe(true);
	});

	test("navigateToDate with no input defaults to 'now' and returns true", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);
		// `input.date` is optional — handler falls through to `new Date()`. The
		// view is open in the fixture, so the call must succeed.
		expect(await api.navigateToDate({})).toBe(true);
	});

	test("navigateToDate with an invalid date string returns false (no exception)", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);
		// `new Date("not-a-date")` → NaN, handler short-circuits to false.
		// Proves the error envelope works — a regression that lets NaN through
		// would corrupt FullCalendar's internal state.
		expect(await api.navigateToDate({ date: "not-a-real-date" })).toBe(false);
	});

	test("navigateToDate against an unknown calendarId returns false", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);
		expect(
			await api.navigateToDate({
				date: todayISO(),
				calendarId: "does-not-exist",
			})
		).toBe(false);
	});
});
