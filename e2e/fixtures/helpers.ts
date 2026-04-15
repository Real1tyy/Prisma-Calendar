import type { Page } from "@playwright/test";

/**
 * Activate Prisma-Calendar's calendar view for the given calendar ID. Uses the
 * runtime API instead of the command palette to avoid palette-UI races.
 */
export async function openCalendar(page: Page, calendarId = "default"): Promise<void> {
	await page.evaluate(async (id) => {
		const w = window as unknown as {
			app: {
				plugins: {
					plugins: Record<
						string,
						{
							calendarBundles?: Array<{
								calendarId: string;
								activateCalendarView?: () => Promise<void>;
							}>;
						}
					>;
				};
			};
		};
		const plugin = w.app.plugins.plugins["prisma-calendar"];
		const bundle = plugin?.calendarBundles?.find((b) => b.calendarId === id) ?? plugin?.calendarBundles?.[0];
		if (!bundle || typeof bundle.activateCalendarView !== "function") {
			throw new Error(`No CalendarBundle for id=${id} (bundles: ${plugin?.calendarBundles?.length ?? 0})`);
		}
		await bundle.activateCalendarView();
	}, calendarId);
}
