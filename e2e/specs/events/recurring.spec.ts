import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { createEventViaModal, formatLocalDate, openCalendarReady } from "./events-helpers";

test.describe("recurring events", () => {
	test("weekly Mon/Wed/Fri writes the correct RRule + RRuleSpec", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = formatLocalDate(tomorrow);

		const relativePath = await createEventViaModal(obsidian, {
			title: "Weekly Review",
			start: `${tomorrowStr}T09:00`,
			end: `${tomorrowStr}T10:00`,
			recurring: {
				rruleType: "weekly",
				weekdays: ["monday", "wednesday", "friday"],
			},
		});

		const fm = readEventFrontmatter(obsidian.vaultDir, relativePath);
		expect(fm["RRule"]).toBe("weekly");
		const spec = String(fm["RRuleSpec"] ?? "");
		expect(spec).toContain("monday");
		expect(spec).toContain("wednesday");
		expect(spec).toContain("friday");
	});

	test("custom interval every 2 days persists to frontmatter", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const relativePath = await createEventViaModal(obsidian, {
			title: "Workout",
			start: "2026-05-10T07:00",
			end: "2026-05-10T07:30",
			recurring: {
				rruleType: "custom",
				customFreq: "DAILY",
				customInterval: 2,
			},
		});

		const fm = readEventFrontmatter(obsidian.vaultDir, relativePath);
		expect(String(fm["RRule"] ?? "")).toMatch(/2/);
	});

	test("Skip toggled on a physical instance hides it from render", async ({ obsidian }) => {
		const today = new Date();
		today.setDate(today.getDate() + 1);
		const instanceDate = formatLocalDate(today);
		const instancePath = "Events/Skipped Instance.md";
		writeFileSync(
			join(obsidian.vaultDir, instancePath),
			`---
Start Date: ${instanceDate}T09:00
End Date: ${instanceDate}T10:00
Skip: true
---

# Skipped Instance
`,
			"utf8"
		);

		await openCalendarReady(obsidian.page);

		expectFrontmatter(obsidian.vaultDir, instancePath, { Skip: true });

		const skippedBlock = obsidian.page.locator(".fc-event", { hasText: "Skipped Instance" });
		await expect(skippedBlock).toHaveCount(0);
	});
});
