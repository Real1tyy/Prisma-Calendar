import type { Page } from "@playwright/test";

const PLUGIN_ID = "prisma-calendar";

/**
 * Activate Prisma-Calendar's calendar view for the given calendar ID. Uses the
 * runtime API instead of the command palette to avoid palette-UI races.
 */
export async function openCalendarView(page: Page, calendarId = "default"): Promise<void> {
	await page.evaluate(
		async ({ id, pid }) => {
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
			const plugin = w.app.plugins.plugins[pid];
			const bundle = plugin?.calendarBundles?.find((b) => b.calendarId === id) ?? plugin?.calendarBundles?.[0];
			if (!bundle || typeof bundle.activateCalendarView !== "function") {
				throw new Error(`No CalendarBundle for id=${id} (bundles: ${plugin?.calendarBundles?.length ?? 0})`);
			}
			await bundle.activateCalendarView();
		},
		{ id: calendarId, pid: PLUGIN_ID }
	);
}

/** Back-compat alias; older specs imported `openCalendar`. */
export const openCalendar = openCalendarView;

/**
 * Click a Prisma view tab. Supported ids: calendar, stats, timeline, heatmap,
 * gantt, dashboard — matches the `prisma-view-tab-<id>` data-testid stamped
 * by the view renderer.
 */
export async function switchView(page: Page, viewId: string): Promise<void> {
	const tab = page.locator(`[data-testid="prisma-view-tab-${viewId}"]`).first();
	await tab.waitFor({ state: "visible", timeout: 10_000 });
	await tab.click();
}
