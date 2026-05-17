import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Locator } from "@playwright/test";

import { collapsibleSection, createEventHandle } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";
import { EVENT_MODAL_SELECTOR, formatLocalDate } from "../events/events-helpers";

// Stopwatch is rendered inside the event modal as a collapsible section
// (src/react/views/stopwatch.tsx). All interactable elements are stamped:
//   - TID.stopwatch.time            → "prisma-stopwatch-time"
//   - TID.stopwatch.btn(<variant>)  → "prisma-stopwatch-btn-{start,continue,pause,stop,resume}"
//   - TID.stopwatch.collapsibleSlug → "time-tracker" (passed to collapsibleSection())
// The minimize button lives on the event-form header: TID.event.btn("minimize").

const MODAL = ".modal";

const HHMMSS_REGEX = /^(\d{2}):(\d{2}):(\d{2})$/;

function parseStopwatchToMs(value: string): number {
	const match = value.match(HHMMSS_REGEX);
	if (!match) throw new Error(`unparseable stopwatch display: ${JSON.stringify(value)}`);
	const [, hh, mm, ss] = match;
	return ((Number(hh) * 60 + Number(mm)) * 60 + Number(ss)) * 1000;
}

async function readStopwatchMs(display: Locator): Promise<number> {
	return parseStopwatchToMs((await display.textContent()) ?? "");
}

test.describe("stopwatch lifecycle", () => {
	test("create-event-with-stopwatch opens the modal with an active stopwatch", async ({ calendar }) => {
		await calendar.runCommand("Prisma Calendar: Create new event with stopwatch");

		await expect(calendar.page.locator(MODAL).first()).toBeVisible();

		const display = calendar.page.locator(sel(TID.stopwatch.time)).first();
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
		const display = calendar.page.locator(sel(TID.stopwatch.time)).first();
		await display.waitFor({ state: "visible" });

		await calendar.page.waitForTimeout(1_500);

		await calendar.page
			.locator(sel(TID.event.btn("minimize")))
			.first()
			.click();
		await expect(modal).toBeHidden();

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");
		await expect(calendar.page.locator(MODAL).first()).toBeVisible();
		await expect(calendar.page.locator(sel(TID.stopwatch.time)).first()).toBeVisible();
	});

	test("create-with-stopwatch: minimize + wait + restore advances time and preserves pending form fields", async ({
		calendar,
	}) => {
		const page = calendar.page;
		await calendar.runCommand("Prisma Calendar: Create new event with stopwatch");

		const modal = page.locator(MODAL).first();
		await modal.waitFor({ state: "visible" });
		const display = page.locator(sel(TID.stopwatch.time)).first();
		await display.waitFor({ state: "visible" });

		// Pending edits the spec must see preserved through minimize/restore.
		await page
			.locator(sel(TID.event.control("title")))
			.first()
			.fill("Tracked Session");
		await page
			.locator(sel(TID.event.control("location")))
			.first()
			.fill("Room C");

		// Wait long enough that the display has rolled at least one tick before
		// minimize. The stopwatch ticks at 1Hz (setInterval 1000ms in stopwatch.tsx).
		await page.waitForTimeout(1_500);
		const beforeMs = await readStopwatchMs(display);

		await page
			.locator(sel(TID.event.btn("minimize")))
			.first()
			.click();
		await expect(modal).toBeHidden();

		// Background time accrual — proves the stopwatch keeps counting while
		// minimized (the snapshot tracks start time, not modal-mount time).
		await page.waitForTimeout(2_000);

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");
		await page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });
		const restoredDisplay = page.locator(sel(TID.stopwatch.time)).first();
		await restoredDisplay.waitFor({ state: "visible" });

		// Form data round-trip.
		await expect(page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Tracked Session");
		await expect(page.locator(sel(TID.event.control("location"))).first()).toHaveValue("Room C");

		const afterMs = await readStopwatchMs(restoredDisplay);
		// 1_500ms pre-minimize + 2_000ms hidden ≈ 3_500ms accrued. 1_000ms lower
		// bound absorbs command-palette + restore-modal latency while still
		// catching a frozen stopwatch.
		expect(afterMs - beforeMs).toBeGreaterThanOrEqual(1_000);

		// Ticking proof: poll the display until it advances past the restored
		// reading — guards against a stopwatch that resumes display but stops
		// the setInterval tick.
		await expect
			.poll(() => readStopwatchMs(restoredDisplay), { message: "stopwatch should continue ticking after restore" })
			.toBeGreaterThan(afterMs);
	});

	test("edit-existing: continue stopwatch + minimize + restore advances time and preserves event identity", async ({
		calendar,
	}) => {
		const page = calendar.page;
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
		await page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		// Stopwatch section starts collapsed — drive it through the shared DSL so
		// a future header/testid refactor only touches the collapsibleSection helper.
		const section = collapsibleSection(page, TID.stopwatch.collapsibleSlug);
		await section.expand();

		const continueBtn = page.locator(sel(TID.stopwatch.btn("continue"))).first();
		await continueBtn.waitFor({ state: "visible" });
		await continueBtn.click();

		// Once running, the display reflects elapsed = now − Start Date (08:00),
		// so the value is a multi-hour timestamp — we still only care about deltas.
		const display = page.locator(sel(TID.stopwatch.time)).first();
		await display.waitFor({ state: "visible" });
		await page.waitForTimeout(1_500);
		const beforeMs = await readStopwatchMs(display);

		await page
			.locator(sel(TID.event.btn("minimize")))
			.first()
			.click();
		await page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "detached" });

		await page.waitForTimeout(2_000);

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");
		await page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });
		const restoredDisplay = page.locator(sel(TID.stopwatch.time)).first();
		await restoredDisplay.waitFor({ state: "visible" });

		// Identity preserved across minimize/restore.
		await expect(page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Resumable");
		await expect(page.locator(sel(TID.event.control("location"))).first()).toHaveValue("Resume Room");

		const afterMs = await readStopwatchMs(restoredDisplay);
		expect(afterMs - beforeMs).toBeGreaterThanOrEqual(1_000);

		await expect
			.poll(() => readStopwatchMs(restoredDisplay), {
				message: "edit-side stopwatch should continue ticking after restore",
			})
			.toBeGreaterThan(afterMs);
	});
});
