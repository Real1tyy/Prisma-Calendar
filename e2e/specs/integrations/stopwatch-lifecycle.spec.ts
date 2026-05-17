import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { createEventHandle } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { sel, STOPWATCH_TIME_TID, TID } from "../../fixtures/testids";
import { EVENT_MODAL_SELECTOR, formatLocalDate } from "../events/events-helpers";

// Stopwatch is rendered inside the event modal as a collapsible section
// (src/react/views/stopwatch.tsx). The display span is stamped with
// data-testid="prisma-stopwatch-time" and the minimize button with
// data-testid="prisma-event-btn-minimize" (event-form-header.tsx).
// Stopwatch start/continue buttons have no testids; specs target them via the
// stable `.prisma-stopwatch-{start,continue,pause}-btn` classes.

const MODAL = ".modal";
const STOPWATCH_TIME = sel(STOPWATCH_TIME_TID);
const MINIMIZE_BUTTON = sel(TID.event.btn("minimize"));
const CONTINUE_BUTTON = ".prisma-stopwatch-continue-btn";

const HHMMSS_REGEX = /^(\d{2}):(\d{2}):(\d{2})$/;

function parseStopwatchToMs(value: string): number {
	const match = value.match(HHMMSS_REGEX);
	if (!match) throw new Error(`unparseable stopwatch display: ${JSON.stringify(value)}`);
	const [, hh, mm, ss] = match;
	return ((Number(hh) * 60 + Number(mm)) * 60 + Number(ss)) * 1000;
}

test.describe("stopwatch lifecycle", () => {
	test("create-event-with-stopwatch opens the modal with an active stopwatch", async ({ calendar }) => {
		await calendar.runCommand("Prisma Calendar: Create new event with stopwatch");

		await expect(calendar.page.locator(MODAL).first()).toBeVisible();

		const display = calendar.page.locator(STOPWATCH_TIME).first();
		await display.waitFor({ state: "visible" });

		const first = await display.textContent();
		await calendar.page.waitForTimeout(2_000);
		const second = await display.textContent();
		expect(first).not.toBe(second);
	});

	test("minimize preserves stopwatch state across reopen", async ({ calendar }) => {
		await calendar.runCommand("Prisma Calendar: Create new event with stopwatch");

		const modal = calendar.page.locator(MODAL).first();
		await modal.waitFor({ state: "visible" });
		await calendar.page.locator(STOPWATCH_TIME).first().waitFor({ state: "visible" });

		await calendar.page.waitForTimeout(1_500);

		await calendar.page.locator(MINIMIZE_BUTTON).first().click();
		await expect(modal).toBeHidden();

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");
		await expect(calendar.page.locator(MODAL).first()).toBeVisible();
		await expect(calendar.page.locator(STOPWATCH_TIME).first()).toBeVisible();
	});

	test("create-with-stopwatch: minimize + wait + restore advances time and preserves pending form fields", async ({
		calendar,
	}) => {
		await calendar.runCommand("Prisma Calendar: Create new event with stopwatch");

		const modal = calendar.page.locator(MODAL).first();
		await modal.waitFor({ state: "visible" });
		await calendar.page.locator(STOPWATCH_TIME).first().waitFor({ state: "visible" });

		// Pending edits the spec must see preserved through minimize/restore.
		const titleInput = calendar.page.locator(sel(TID.event.control("title"))).first();
		await titleInput.fill("Tracked Session");
		const locationInput = calendar.page.locator(sel(TID.event.control("location"))).first();
		await locationInput.fill("Room C");

		// Wait long enough that the display has rolled at least one tick before
		// minimize. The stopwatch ticks at 1Hz (setInterval 1000ms in stopwatch.tsx).
		await calendar.page.waitForTimeout(1_500);
		const beforeMs = parseStopwatchToMs((await calendar.page.locator(STOPWATCH_TIME).first().textContent()) ?? "");

		await calendar.page.locator(MINIMIZE_BUTTON).first().click();
		await expect(modal).toBeHidden();

		// Background time accrual — proves the stopwatch keeps counting while
		// minimized (the snapshot tracks start time, not modal-mount time).
		await calendar.page.waitForTimeout(2_000);

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });
		await calendar.page.locator(STOPWATCH_TIME).first().waitFor({ state: "visible" });

		// Form data round-trip.
		await expect(calendar.page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Tracked Session");
		await expect(calendar.page.locator(sel(TID.event.control("location"))).first()).toHaveValue("Room C");

		const afterMs = parseStopwatchToMs((await calendar.page.locator(STOPWATCH_TIME).first().textContent()) ?? "");
		// 2_000ms hidden + 1_500ms pre-minimize = ~3_500ms of accrued time. Use
		// 1_000ms as the lower bound — generous enough to absorb command-palette
		// + restore-modal latency, tight enough to catch a frozen stopwatch.
		expect(afterMs - beforeMs).toBeGreaterThanOrEqual(1_000);

		// Ticking proof: poll the display until it advances again (without
		// asserting an exact delta — under heavy CI load the tick interval can
		// stretch past the default expect timeout).
		await expect
			.poll(async () => parseStopwatchToMs((await calendar.page.locator(STOPWATCH_TIME).first().textContent()) ?? ""), {
				message: "stopwatch should continue ticking after restore",
			})
			.toBeGreaterThan(afterMs);
	});

	test("edit-existing: continue stopwatch + minimize + restore advances time and preserves event identity", async ({
		calendar,
	}) => {
		const today = formatLocalDate(new Date());
		// Seed with a start in the past so `continueFromExisting` resolves to a
		// non-negative elapsed value — see continueFromExisting() in stopwatch.tsx
		// which refuses future start times.
		const seedPath = "Events/Resumable-20250101000000.md";
		writeFileSync(
			join(calendar.vaultDir, seedPath),
			`---
Start Date: ${today}T08:00
End Date: ${today}T08:30
Location: Resume Room
Already Notified: true
---

# Resumable
`,
			"utf8"
		);

		const evt = createEventHandle(calendar, seedPath, "Resumable");
		await evt.expectVisible();
		await evt.rightClick("editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		// The time-tracker section starts collapsed; clicking the header expands
		// it so the ▶ continue button becomes interactive. The CollapsibleSection
		// is stamped with testIdSlug="time-tracker" → prisma-collapsible-header-time-tracker.
		const header = calendar.page.locator('[data-testid="prisma-collapsible-header-time-tracker"]').first();
		await header.waitFor({ state: "visible" });
		await header.click();

		const continueBtn = calendar.page.locator(CONTINUE_BUTTON).first();
		await continueBtn.waitFor({ state: "visible" });
		await continueBtn.click();

		// Once running, the display reflects elapsed = now - Start Date (08:00),
		// so the value is a multi-hour timestamp — we still only care about deltas.
		await calendar.page.locator(STOPWATCH_TIME).first().waitFor({ state: "visible" });
		await calendar.page.waitForTimeout(1_500);
		const beforeMs = parseStopwatchToMs((await calendar.page.locator(STOPWATCH_TIME).first().textContent()) ?? "");

		await calendar.page.locator(MINIMIZE_BUTTON).first().click();
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "detached" });

		await calendar.page.waitForTimeout(2_000);

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });
		await calendar.page.locator(STOPWATCH_TIME).first().waitFor({ state: "visible" });

		// Identity preserved across minimize/restore.
		await expect(calendar.page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Resumable");
		await expect(calendar.page.locator(sel(TID.event.control("location"))).first()).toHaveValue("Resume Room");

		const afterMs = parseStopwatchToMs((await calendar.page.locator(STOPWATCH_TIME).first().textContent()) ?? "");
		expect(afterMs - beforeMs).toBeGreaterThanOrEqual(1_000);

		await expect
			.poll(async () => parseStopwatchToMs((await calendar.page.locator(STOPWATCH_TIME).first().textContent()) ?? ""), {
				message: "edit-side stopwatch should continue ticking after restore",
			})
			.toBeGreaterThan(afterMs);
	});
});
