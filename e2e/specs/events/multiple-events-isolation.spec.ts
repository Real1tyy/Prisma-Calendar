import { basename } from "node:path";

import { expect, test } from "../../fixtures/electron";
import { formatLocalDate } from "./events-helpers";

// Five quick creates via the toolbar Create button — catches filename
// collisions and shared-state bugs that only show up under back-to-back
// creation.
test.describe("multiple events — isolation", () => {
	test("five create-button clicks produce five distinct files", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const titles = ["Event A", "Event B", "Event C", "Event D", "Event E"];
		const events = await calendar.seedMany(
			titles.map((title, i) => {
				const hour = String(9 + i).padStart(2, "0");
				return {
					title,
					start: `${today}T${hour}:00`,
					end: `${today}T${hour}:30`,
				};
			})
		);

		const paths = events.map((e) => e.path);
		expect(new Set(paths).size).toBe(titles.length);

		const basenames = paths.map((p) => basename(p));
		for (const title of titles) {
			expect(basenames.some((name) => name.startsWith(title))).toBe(true);
		}
	});
});
