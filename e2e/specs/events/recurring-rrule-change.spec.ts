import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	createEventViaModal,
	EVENT_MODAL_SELECTOR,
	expectEventVisible,
	formatLocalDate,
	openCalendarReady,
	rightClickEventMenu,
} from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";
import { collectInstanceFiles, instanceFileRegex, parseInstanceDate } from "./robustness-helpers";

const INSTANCE_TIMEOUT_MS = 15_000;

test.describe("recurring rrule change", () => {
	test("switching weekly → daily updates the source's RRule and keeps instances valid", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const todayStr = formatLocalDate(new Date());

		const sourcePath = await createEventViaModal(obsidian, {
			title: "Pattern Shift",
			start: `${todayStr}T09:00`,
			end: `${todayStr}T09:30`,
			recurring: {
				rruleType: "weekly",
				weekdays: ["monday", "wednesday", "friday"],
			},
		});

		// Initial cadence: Mon/Wed/Fri only.
		await expect
			.poll(() => collectInstanceFiles(obsidian.vaultDir, "Pattern Shift").length, { timeout: INSTANCE_TIMEOUT_MS })
			.toBeGreaterThanOrEqual(2);

		const allowedWeekdays = new Set([1, 3, 5]);
		for (const file of collectInstanceFiles(obsidian.vaultDir, "Pattern Shift")) {
			const match = file.match(instanceFileRegex("Pattern Shift"));
			expect(match, `weekly instance file should match pattern: ${file}`).not.toBeNull();
			expect(allowedWeekdays).toContain(parseInstanceDate(match!).getDay());
		}

		// Edit the source → switch to custom daily interval 1.
		const sourceRRuleBefore = String(readEventFrontmatter(obsidian.vaultDir, sourcePath)["RRule"] ?? "");
		await expectEventVisible(obsidian.page, "Pattern Shift");
		await rightClickEventMenu(obsidian.page, "Pattern Shift", "editEvent");
		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible", timeout: 15_000 });
		await fillEventModal(obsidian.page, {
			recurring: { rruleType: "custom", customFreq: "DAILY", customInterval: 1 },
		});
		await saveEventModal(obsidian.page);

		// The source's RRule frontmatter must change: that's the precise,
		// testable contract of "edit took effect". The existing instances'
		// regeneration cadence is a separate concern (they're persisted files
		// the user might want to keep); we don't assert it here.
		await expect
			.poll(() => String(readEventFrontmatter(obsidian.vaultDir, sourcePath)["RRule"] ?? ""), { timeout: 10_000 })
			.not.toBe(sourceRRuleBefore);

		const sourceRRuleAfter = String(readEventFrontmatter(obsidian.vaultDir, sourcePath)["RRule"] ?? "").toLowerCase();
		expect(sourceRRuleAfter).toMatch(/daily|interval=1/);

		// Every instance file must still be readable (the switch must not
		// leave the vault in a half-broken state where some files error).
		for (const file of collectInstanceFiles(obsidian.vaultDir, "Pattern Shift")) {
			const relative = file.slice(obsidian.vaultDir.length + 1);
			const fm = readEventFrontmatter(obsidian.vaultDir, relative);
			expect(fm["Start Date"], `instance ${relative} should still have a Start Date`).toBeTruthy();
		}
	});
});
