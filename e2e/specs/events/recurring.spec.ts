import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { expectFrontmatter, listEventFiles, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	createEventViaModal,
	expectEventVisible,
	formatLocalDate,
	monthsFromTodayTo,
	navigateCalendar,
	openCalendarReady,
} from "./events-helpers";

const INSTANCE_FILE_TIMEOUT_MS = 10_000;
const DEFAULT_FUTURE_INSTANCES = 2;

/**
 * Match a physical instance filename for `title`: `Title YYYY-MM-DD-<zettel>.md`
 * — the space-date-zettel suffix is what distinguishes instances from the
 * source event note, which uses `Title-<zettel>.md` (no date token).
 */
function instanceFileRegex(title: string): RegExp {
	const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`/${escaped} (\\d{4})-(\\d{2})-(\\d{2})-\\d+\\.md$`);
}

/** Parse `YYYY-MM-DD` captured from the filename into a local Date. */
function parseInstanceDate(match: RegExpMatchArray): Date {
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function collectInstanceFiles(vaultDir: string, title: string): string[] {
	const regex = instanceFileRegex(title);
	return listEventFiles(vaultDir).filter((p) => regex.test(p));
}

test.describe("recurring events", () => {
	test("weekly Mon/Wed/Fri generates physical instances on the right weekdays", async ({ obsidian }) => {
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

		await expect
			.poll(() => collectInstanceFiles(obsidian.vaultDir, "Weekly Review").length, {
				timeout: INSTANCE_FILE_TIMEOUT_MS,
			})
			.toBeGreaterThanOrEqual(DEFAULT_FUTURE_INSTANCES);

		const instances = collectInstanceFiles(obsidian.vaultDir, "Weekly Review");
		const allowedWeekdays = new Set([1, 3, 5]);
		for (const file of instances) {
			const match = file.match(instanceFileRegex("Weekly Review"));
			expect(match, `instance file should match naming pattern: ${file}`).not.toBeNull();
			const weekday = parseInstanceDate(match!).getDay();
			expect(allowedWeekdays, `instance ${file} weekday=${weekday}`).toContain(weekday);
		}

		await expectEventVisible(obsidian.page, "Weekly Review");
	});

	test("custom interval every 2 days generates instances 2 days apart", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const date = "2026-05-10";
		const relativePath = await createEventViaModal(obsidian, {
			title: "Workout",
			start: `${date}T07:00`,
			end: `${date}T07:30`,
			recurring: {
				rruleType: "custom",
				customFreq: "DAILY",
				customInterval: 2,
			},
		});

		const fm = readEventFrontmatter(obsidian.vaultDir, relativePath);
		expect(String(fm["RRule"] ?? "")).toMatch(/2/);

		await expect
			.poll(() => collectInstanceFiles(obsidian.vaultDir, "Workout").length, {
				timeout: INSTANCE_FILE_TIMEOUT_MS,
			})
			.toBeGreaterThanOrEqual(DEFAULT_FUTURE_INSTANCES);

		const instanceDates = collectInstanceFiles(obsidian.vaultDir, "Workout")
			.map((p) => p.match(instanceFileRegex("Workout")))
			.filter((m): m is RegExpMatchArray => m !== null)
			.map(parseInstanceDate)
			.sort((a, b) => a.getTime() - b.getTime());

		for (let i = 1; i < instanceDates.length; i++) {
			const diffDays = Math.round((instanceDates[i]!.getTime() - instanceDates[i - 1]!.getTime()) / 86_400_000);
			expect(
				diffDays,
				`gap between ${instanceDates[i - 1]!.toISOString()} and ${instanceDates[i]!.toISOString()}`
			).toBe(2);
		}

		await navigateCalendar(obsidian.page, monthsFromTodayTo(date));
		await expectEventVisible(obsidian.page, "Workout");
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
