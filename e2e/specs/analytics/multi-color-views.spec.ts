import { fromAnchor, todayStamp } from "../../fixtures/dates";
import { type CalendarHandle } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { assignPrerequisiteViaUI, ganttBarLocator } from "../../fixtures/helpers";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { sel } from "../../fixtures/testids";

const COLOR_A = "#ff0000";
const COLOR_B = "#00ff00";
const COLOR_C = "#0000ff";

const ACTIVE_LEAF = ".workspace-leaf.mod-active";

async function seedMultiColorRules(calendar: CalendarHandle): Promise<void> {
	await updateCalendarSettings(calendar.page, {
		colorMode: "2",
		showEventColorDots: true,
		colorRules: [
			{ id: "rule-a", expression: "Category.includes('Alpha')", color: COLOR_A, enabled: true },
			{ id: "rule-b", expression: "Category.includes('Beta')", color: COLOR_B, enabled: true },
			{ id: "rule-c", expression: "Category.includes('Gamma')", color: COLOR_C, enabled: true },
		],
	});
}

test.describe("multi-color across views", () => {
	test("calendar event tile shows gradient and overflow dots when multiple color rules match", async ({ calendar }) => {
		await seedMultiColorRules(calendar);
		await calendar.switchMode("month");

		await calendar.seedOnDiskMany([
			{
				title: "Multi Category Task",
				start: todayStamp(10, 0),
				end: todayStamp(11, 0),
				categories: ["Alpha", "Beta", "Gamma"],
			},
		]);

		const tile = calendar.page
			.locator(`${ACTIVE_LEAF} [data-testid="prisma-cal-event"][data-event-title="Multi Category Task"]`)
			.first();
		await expect(tile).toBeVisible();

		await expect
			.poll(() => tile.evaluate((el) => (el as HTMLElement).style.backgroundImage), {
				message: "expected gradient on calendar tile",
			})
			.toContain("linear-gradient");

		const dots = tile.locator(".prisma-event-color-dots .prisma-day-color-dot");
		await expect(dots).toHaveCount(1);
	});

	test("gantt bars show gradient when event matches multiple color rules", async ({ calendar }) => {
		await seedMultiColorRules(calendar);
		await calendar.switchMode("month");
		await calendar.goToAnchor();

		await calendar.seedMany([
			{
				title: "Upstream Multi",
				start: fromAnchor(0, 9, 0),
				end: fromAnchor(0, 10, 0),
				categories: ["Alpha", "Beta", "Gamma"],
			},
			{
				title: "Downstream Multi",
				start: fromAnchor(10, 14, 0),
				end: fromAnchor(10, 15, 0),
				categories: ["Alpha", "Beta"],
			},
		]);

		await assignPrerequisiteViaUI(calendar.page, "Downstream Multi", "Upstream Multi");
		await calendar.unlockPro();
		await calendar.switchView("gantt");

		const upstreamBar = ganttBarLocator(calendar.page, "Upstream Multi");
		await expect(upstreamBar).toBeVisible();

		const bgImage = await upstreamBar.evaluate((el) => (el as HTMLElement).style.backgroundImage);
		expect(bgImage).toContain("linear-gradient");
	});

	test("timeline items show gradient when event matches multiple color rules", async ({ calendar }) => {
		await seedMultiColorRules(calendar);

		await calendar.seedOnDiskMany([
			{
				title: "Timeline Multi",
				start: todayStamp(10, 0),
				end: todayStamp(11, 0),
				categories: ["Alpha", "Beta", "Gamma"],
			},
		]);

		await calendar.switchView("timeline");

		const container = calendar.page.locator(sel("prisma-timeline-container")).first();
		await expect(container).toBeVisible();

		const item = container.locator(".vis-item.prisma-timeline-item").first();
		await expect(item).toBeVisible();

		await expect
			.poll(() => item.evaluate((el) => (el as HTMLElement).getAttribute("style") ?? ""), {
				message: "expected gradient on timeline item",
			})
			.toContain("linear-gradient");
	});
});
