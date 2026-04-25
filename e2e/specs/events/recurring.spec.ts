import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { formatLocalDate, listEventFiles } from "./events-helpers";

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
	test("weekly Mon/Wed/Fri generates physical instances on the right weekdays", async ({ calendar }) => {
		const todayStr = formatLocalDate(new Date());

		const evt = await calendar.createEvent({
			title: "Weekly Review",
			start: `${todayStr}T09:00`,
			end: `${todayStr}T10:00`,
			recurring: {
				rruleType: "weekly",
				weekdays: ["monday", "wednesday", "friday"],
			},
		});

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		expect(fm["RRule"]).toBe("weekly");
		const spec = String(fm["RRuleSpec"] ?? "");
		expect(spec).toContain("monday");
		expect(spec).toContain("wednesday");
		expect(spec).toContain("friday");

		await expect
			.poll(() => collectInstanceFiles(calendar.vaultDir, "Weekly Review").length, {
				timeout: INSTANCE_FILE_TIMEOUT_MS,
			})
			.toBeGreaterThanOrEqual(DEFAULT_FUTURE_INSTANCES);

		const instances = collectInstanceFiles(calendar.vaultDir, "Weekly Review");
		const allowedWeekdays = new Set([1, 3, 5]);
		for (const file of instances) {
			const match = file.match(instanceFileRegex("Weekly Review"));
			expect(match, `instance file should match naming pattern: ${file}`).not.toBeNull();
			const weekday = parseInstanceDate(match!).getDay();
			expect(allowedWeekdays, `instance ${file} weekday=${weekday}`).toContain(weekday);
		}

		await evt.expectVisible();
	});

	test("custom interval every 2 days generates instances 2 days apart", async ({ calendar }) => {
		const date = formatLocalDate(new Date());
		const evt = await calendar.createEvent({
			title: "Workout",
			start: `${date}T07:00`,
			end: `${date}T07:30`,
			recurring: {
				rruleType: "custom",
				customFreq: "DAILY",
				customInterval: 2,
			},
		});

		const fm = readEventFrontmatter(calendar.vaultDir, evt.path);
		expect(String(fm["RRule"] ?? "")).toMatch(/2/);

		await expect
			.poll(() => collectInstanceFiles(calendar.vaultDir, "Workout").length, {
				timeout: INSTANCE_FILE_TIMEOUT_MS,
			})
			.toBeGreaterThanOrEqual(DEFAULT_FUTURE_INSTANCES);

		const instanceDates = collectInstanceFiles(calendar.vaultDir, "Workout")
			.map((p) => p.match(instanceFileRegex("Workout")))
			.filter((m): m is RegExpMatchArray => m !== null)
			.map(parseInstanceDate)
			.sort((a, b) => a.getTime() - b.getTime());

		for (let i = 1; i < instanceDates.length; i++) {
			const diffDays = Math.round((instanceDates[i].getTime() - instanceDates[i - 1].getTime()) / 86_400_000);
			expect(diffDays, `gap between ${instanceDates[i - 1].toISOString()} and ${instanceDates[i].toISOString()}`).toBe(
				2
			);
		}

		await evt.expectVisible();
	});

	test("Skip toggled on a physical instance hides it from render", async ({ calendar }) => {
		const todayStr = formatLocalDate(new Date());

		const evt = await calendar.seedOnDisk("Skipped Instance", {
			"Start Date": `${todayStr}T09:00`,
			"End Date": `${todayStr}T10:00`,
			Skip: true,
		});

		expectFrontmatter(calendar.vaultDir, evt.path, { Skip: true });
		await evt.expectVisible(false);
	});
});
