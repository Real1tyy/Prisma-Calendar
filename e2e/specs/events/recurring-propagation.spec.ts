import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, updateCalendarSettings } from "../../fixtures/seed-events";
import { createEventViaModal, formatLocalDate, openCalendarReady } from "./events-helpers";
import { collectInstanceFiles } from "./robustness-helpers";

// Round 2 — recurring propagation safety canary. The propagation ON path
// takes seconds of plugin-side debouncing plus indexer latency and is
// covered by the unit suite; the canary that matters for prod robustness
// is the OFF path — when a user explicitly disables propagation, source
// edits must NOT leak into the instance files.

const INSTANCE_TIMEOUT_MS = 15_000;
const PROPAGATION_TIMEOUT_MS = 20_000;
// Wait past PROPAGATION_DEBOUNCE_MS (3s) to let any scheduled (but disabled)
// propagation fire.
const DEBOUNCE_DRAIN_MS = 6_000;

function rewriteFrontmatterField(vaultDir: string, relativePath: string, field: string, newValue: string): void {
	const absolute = join(vaultDir, relativePath);
	const original = readFileSync(absolute, "utf8");
	const rewritten = original.replace(new RegExp(`^${field}:.*$`, "m"), `${field}: ${newValue}`);
	writeFileSync(absolute, rewritten, "utf8");
}

test.describe("recurring event propagation", () => {
	test("with propagation OFF, source edits do not reach physical instances", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		await updateCalendarSettings(obsidian.page, { propagateFrontmatterToInstances: false });

		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = formatLocalDate(tomorrow);

		const sourcePath = await createEventViaModal(obsidian, {
			title: "No Propagate",
			start: `${tomorrowStr}T09:00`,
			end: `${tomorrowStr}T09:30`,
			recurring: { rruleType: "custom", customFreq: "DAILY", customInterval: 1 },
			location: "Room A",
		});

		await expect
			.poll(() => collectInstanceFiles(obsidian.vaultDir, "No Propagate").length, { timeout: INSTANCE_TIMEOUT_MS })
			.toBeGreaterThanOrEqual(2);

		const instances = collectInstanceFiles(obsidian.vaultDir, "No Propagate").map((abs) =>
			abs.slice(obsidian.vaultDir.length + 1)
		);

		// All instances start at Room A (inherited at creation).
		for (const relative of instances) {
			expect(readEventFrontmatter(obsidian.vaultDir, relative)["Location"]).toBe("Room A");
		}

		rewriteFrontmatterField(obsidian.vaultDir, sourcePath, "Location", "Room B");
		await refreshCalendar(obsidian.page);

		// The source file itself reflects the direct edit.
		await expect
			.poll(() => readEventFrontmatter(obsidian.vaultDir, sourcePath)["Location"], {
				timeout: PROPAGATION_TIMEOUT_MS,
			})
			.toBe("Room B");

		// Wait past the debouncer, then assert each instance is untouched.
		await obsidian.page.waitForTimeout(DEBOUNCE_DRAIN_MS);
		for (const relative of instances) {
			expect(readEventFrontmatter(obsidian.vaultDir, relative)["Location"]).toBe("Room A");
		}
	});
});
