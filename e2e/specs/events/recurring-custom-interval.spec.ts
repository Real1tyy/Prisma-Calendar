import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";
import { openCreateModal, waitForModalClosed, waitForNewEventFiles, snapshotEventFiles } from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

// Parity guard for the advanced recurring controls (custom interval + UNTIL +
// futureInstancesCount + generatePastEvents). The basic weekly recurrence is
// covered by recurring.spec.ts; this spec exercises the four controls that
// only render under the `recurring.enabled === true` branch of the React
// RecurrenceSection — the imperative modal wrote them through individual
// inputs whose values feed `applyRecurringFieldsToFrontmatter`.

test.describe("event modal — recurring advanced controls", () => {
	test("custom interval (every 3 weeks) writes the DSL form to the rrule frontmatter", async ({ calendar }) => {
		const baseline = snapshotEventFiles(calendar.vaultDir);

		await openCreateModal(calendar.page);
		await fillEventModal(calendar.page, {
			title: "Triweekly Standup",
			start: fromAnchor(0, 9, 0),
			end: fromAnchor(0, 9, 30),
			recurring: {
				rruleType: "custom",
				customFreq: "WEEKLY",
				customInterval: 3,
			},
		});

		await saveEventModal(calendar.page);
		await waitForModalClosed(calendar.page);

		const [relativePath] = await waitForNewEventFiles(calendar.vaultDir, baseline, 1);
		const fm = readEventFrontmatter(calendar.vaultDir, relativePath!);
		const rrule = String(fm["RRule"] ?? "");
		expect(rrule).toMatch(/3/);
		// The custom DSL helper produces a string containing the freq label.
		expect(rrule.toLowerCase()).toContain("week");
	});

	test("UNTIL + futureInstancesCount + generatePastEvents persist on save", async ({ calendar }) => {
		const baseline = snapshotEventFiles(calendar.vaultDir);

		const untilDate = "2027-12-31";
		await openCreateModal(calendar.page);
		await fillEventModal(calendar.page, {
			title: "Bounded Series",
			start: fromAnchor(0, 9, 0),
			end: fromAnchor(0, 10, 0),
			recurring: { rruleType: "daily" },
		});

		// Three controls live below `prisma-recurring-event-fields` and aren't
		// driven by fillEventModal — set them directly.
		await calendar.page.locator(sel("prisma-event-control-rrule-until")).first().fill(untilDate);
		await calendar.page.locator(sel("prisma-event-control-future-instances-count")).first().fill("4");

		const generatePast = calendar.page.locator(sel("prisma-event-control-generate-past-events")).first();
		await expect(generatePast).not.toBeChecked();
		await generatePast.click();
		await expect(generatePast).toBeChecked();

		await saveEventModal(calendar.page);
		await waitForModalClosed(calendar.page);

		const [relativePath] = await waitForNewEventFiles(calendar.vaultDir, baseline, 1);
		const fm = readEventFrontmatter(calendar.vaultDir, relativePath!);

		expect(fm["RRule"]).toBe("daily");
		expect(String(fm["RRuleUntil"] ?? "")).toContain(untilDate);
		// Default prop names per `settings.ts`: "Future Instances Count" /
		// "Generate Past Events". `PositiveInt.parse("4")` → 4, written as a
		// number.
		expect(fm["Future Instances Count"]).toBe(4);
		expect(fm["Generate Past Events"]).toBe(true);
	});
});
