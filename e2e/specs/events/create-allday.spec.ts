import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { formatLocalDate } from "./events-helpers";

// All-day counterpart of `frontmatter-schema.spec.ts`: the all-day branch of
// `setEventBasics` writes a different shape from timed events, and a regression
// in either branch should fail loudly. Strict `toEqual` catches drift + value
// + type regressions in one assertion. Notable pinned invariants:
//   - `Start Date` / `End Date` are empty strings (not absent) so downstream
//     tools don't have to branch on presence.
//   - `assignListToFrontmatter` collapses empty Category / Prerequisite /
//     Participants to `""` — the canonical empty-list form.
//   - `Location` / `Icon` / `Break` are DELETED on empty input
//     (`setStringProp` / `setNumericProp` contract) — they MUST NOT appear.
//   - This file uses the no-notifications fixture, so `Already Notified` is
//     not stamped (`skipNewlyCreatedNotifications` is gated on
//     `enableNotifications`). The notifications-on path is covered by
//     `frontmatter-schema.spec.ts`.

test.describe("create event — all-day", () => {
	test("writes the exact expected frontmatter shape (no drift, no value regressions)", async ({ calendar }) => {
		const date = formatLocalDate(new Date());
		const evt = await calendar.createEvent({ title: "Project Planning", allDay: true, date });
		expect(evt.path).toMatch(/^Events\/Project Planning.*\.md$/);

		expect(readEventFrontmatter(calendar.vaultDir, evt.path)).toEqual({
			Date: date,
			"Start Date": "",
			"End Date": "",
			"All Day": true,
			Category: "",
			Prerequisite: "",
			Participants: "",
		});

		await calendar.switchMode("month");
		await evt.expectVisible();
	});
});
