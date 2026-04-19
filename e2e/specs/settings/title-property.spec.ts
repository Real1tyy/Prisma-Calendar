import type { Page } from "@playwright/test";
import { expectPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { ACTIVE_CALENDAR_LEAF, PLUGIN_ID } from "../../fixtures/constants";
import { isoLocal, todayISO, todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import {
	assignPrerequisiteViaUI,
	clickContextMenuItem,
	closeSettings,
	ganttBarLocator,
	openPrismaSettings,
	rightClickEvent,
	saveEventModal,
	setSchemaTextInput,
	switchSettingsTab,
} from "../../fixtures/helpers";
import { sel } from "../../fixtures/testids";
import { fillEventModal } from "../events/fill-event-modal";

// Exercises the `titleProp` calendar setting end-to-end: once a frontmatter key
// is configured as the event's display title, every surface that renders an
// event name must honour it — calendar blocks, edit modal, gantt bars,
// timeline rows, heatmap day detail. The fallback behaviour (no setting →
// filename-derived title) is also pinned so we notice if the priority order in
// `getEventName()` ever regresses.
//
// All tests seed directly to disk via `calendar.seedOnDisk` so custom
// frontmatter keys can be written (the `seedOnDiskMany` shape only knows
// Start/End/Date/All Day/Category). `getEventName` resolves the title once at
// parse time and stores it on `event.title`, so DOM queries against
// `data-event-title="<configured value>"` are the canonical assertion.

const TITLE_PROP = "EventName";

// `calendarTitleProp` (default "Calendar Title") outranks `titleProp` inside
// `getEventName`, and the plugin auto-writes that key as a back-link on every
// indexed event file — so any test that wants titleProp to win must also blank
// `calendarTitleProp` first. Leaving it set would mask the behaviour we're
// trying to assert.
async function configureTitleProp(page: Page, value: string): Promise<void> {
	await openPrismaSettings(page);
	await switchSettingsTab(page, "properties");
	await setSchemaTextInput(page, "calendarTitleProp", "");
	await setSchemaTextInput(page, "titleProp", value);
	await settleSettings(page, { pluginId: PLUGIN_ID });
	await closeSettings(page);
}

function blockByTitle(page: Page, title: string) {
	return page.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-event"][data-event-title="${title}"]`).first();
}

test.describe("settings: titleProp — frontmatter title drives every view", () => {
	test("falls back to the cleaned filename when titleProp is unset", async ({ calendar }) => {
		// Baseline: no titleProp configured. Seeding an event with a filename of
		// "Filename Fallback" should yield a block whose rendered title is the
		// filename (zettel suffix stripped by `cleanupTitle`).
		await calendar.seedOnDisk("Filename Fallback", {
			"Start Date": todayStamp(9, 0),
			"End Date": todayStamp(10, 0),
		});

		await expect(blockByTitle(calendar.page, "Filename Fallback")).toBeVisible();
	});

	test("configured titleProp wins over the filename in the calendar view", async ({ calendar }) => {
		await configureTitleProp(calendar.page, TITLE_PROP);

		// data.json must carry the new key — acts as a canary that the settings
		// round-trip actually persisted before we go on to verify render paths.
		expectPluginData(calendar.vaultDir, PLUGIN_ID, {
			"calendars.0.titleProp": TITLE_PROP,
		});

		await calendar.seedOnDisk("hidden-filename", {
			"Start Date": todayStamp(9, 0),
			"End Date": todayStamp(10, 0),
			[TITLE_PROP]: "Display Alpha",
		});

		await expect(blockByTitle(calendar.page, "Display Alpha")).toBeVisible();
		await expect(blockByTitle(calendar.page, "hidden-filename")).toHaveCount(0);
	});

	test("edit modal reads the titleProp value and writes changes back to the same property", async ({ calendar }) => {
		await configureTitleProp(calendar.page, TITLE_PROP);

		const event = await calendar.seedOnDisk("editable-filename", {
			"Start Date": todayStamp(9, 0),
			"End Date": todayStamp(10, 0),
			[TITLE_PROP]: "Before Edit",
		});

		await expect(blockByTitle(calendar.page, "Before Edit")).toBeVisible();

		// Open the edit modal through the real context menu, not an internal
		// command — the modal must populate its title input from `event.title`,
		// which is the resolved titleProp value (not the filename).
		await rightClickEvent(calendar.page, { title: "Before Edit" });
		await clickContextMenuItem(calendar.page, "editEvent");

		const titleInput = calendar.page.locator(sel("prisma-event-control-title")).first();
		await expect(titleInput).toBeVisible();
		await expect(titleInput).toHaveValue("Before Edit");

		await fillEventModal(calendar.page, { title: "After Edit" });
		await saveEventModal(calendar.page);

		// The resolver writes the new title to the configured property key — we
		// only care that the user's text landed there. The edit path also
		// appends the ZettelID suffix to the saved value (a pre-existing quirk
		// of `event-edit-modal.saveEvent`), so match on substring rather than
		// equality to keep this spec focused on the titleProp contract itself.
		await event.expectFrontmatter(TITLE_PROP, (v) => typeof v === "string" && v.startsWith("After Edit"));
	});

	test("gantt bars render the titleProp value for connected events", async ({ calendar }) => {
		await configureTitleProp(calendar.page, TITLE_PROP);

		await calendar.switchMode("month");

		// Mirror the setup used by the existing gantt suite: create events via
		// the real toolbar → modal flow so the prerequisite-tracker ingests the
		// same fm writes it sees in production. With titleProp already set, the
		// modal writes the typed title into the configured property — the file
		// on disk ends up with `EventName: "Gantt Upstream"` and `event.title`
		// resolves to that string.
		await calendar.seedMany([
			{ title: "Gantt Upstream", start: isoLocal(0, 9, 0), end: isoLocal(0, 10, 0) },
			{ title: "Gantt Downstream", start: isoLocal(10, 14, 0), end: isoLocal(10, 15, 0) },
		]);

		await assignPrerequisiteViaUI(calendar.page, "Gantt Downstream", "Gantt Upstream");

		await calendar.unlockPro();
		await calendar.switchView("gantt");

		const bars = calendar.page.locator(sel("prisma-gantt-bar"));
		await expect(bars).toHaveCount(2);

		await expect(ganttBarLocator(calendar.page, "Gantt Upstream")).toBeVisible();
		await expect(ganttBarLocator(calendar.page, "Gantt Downstream")).toBeVisible();
	});

	test("timeline items render the titleProp value", async ({ calendar }) => {
		await configureTitleProp(calendar.page, TITLE_PROP);

		await calendar.seedOnDisk("tl-file-1", {
			"Start Date": todayStamp(9, 0),
			"End Date": todayStamp(9, 30),
			[TITLE_PROP]: "Timeline Alpha",
		});
		await calendar.seedOnDisk("tl-file-2", {
			"Start Date": todayStamp(13, 0),
			"End Date": todayStamp(14, 0),
			[TITLE_PROP]: "Timeline Bravo",
		});
		await calendar.seedOnDisk("tl-file-3", {
			"Start Date": todayStamp(18, 0),
			"End Date": todayStamp(19, 0),
			[TITLE_PROP]: "Timeline Charlie",
		});

		await calendar.switchView("timeline");

		const container = calendar.page.locator(sel("prisma-timeline-container")).first();
		await expect(container).toBeVisible();

		const items = container.locator(".prisma-timeline-item");
		await expect(items).toHaveCount(3);

		// vis-timeline stamps item text from `cleanupTitle(event.title)` into a
		// child `.vis-item-content` element. `textContent` walks hidden / clipped
		// descendants too, which `innerText` would skip when the bar is too
		// narrow to show the label.
		const texts = (await items.evaluateAll((els) => els.map((el) => el.textContent ?? ""))).join("\n");
		expect(texts).toContain("Timeline Alpha");
		expect(texts).toContain("Timeline Bravo");
		expect(texts).toContain("Timeline Charlie");
		expect(texts).not.toContain("tl-file-1");
		expect(texts).not.toContain("tl-file-2");
		expect(texts).not.toContain("tl-file-3");
	});

	test("heatmap day detail lists events by titleProp value", async ({ calendar }) => {
		await configureTitleProp(calendar.page, TITLE_PROP);

		await calendar.seedOnDisk("hm-file-1", {
			"Start Date": todayStamp(9, 0),
			"End Date": todayStamp(9, 30),
			[TITLE_PROP]: "Heatmap Alpha",
		});
		await calendar.seedOnDisk("hm-file-2", {
			"Start Date": todayStamp(13, 0),
			"End Date": todayStamp(14, 0),
			[TITLE_PROP]: "Heatmap Bravo",
		});

		await calendar.unlockPro();
		await calendar.switchView("heatmap");

		const container = calendar.page.locator(sel("prisma-heatmap-container")).first();
		await expect(container).toBeVisible();

		const todayCell = container.locator(`${sel("prisma-heatmap-cell")}[data-date="${todayISO()}"]`).first();
		await expect(todayCell).toHaveAttribute("data-count", "2");

		// Clicking the cell opens the inline day-detail panel, which stamps each
		// row with `.prisma-heatmap-detail-title` containing `cleanupTitle(event.title)`.
		await todayCell.click();

		const titles = calendar.page.locator(".prisma-heatmap-detail-title");
		await expect(titles).toHaveCount(2);
		const texts = (await titles.allInnerTexts()).join("\n");
		expect(texts).toContain("Heatmap Alpha");
		expect(texts).toContain("Heatmap Bravo");
		expect(texts).not.toContain("hm-file-1");
		expect(texts).not.toContain("hm-file-2");
	});
});
