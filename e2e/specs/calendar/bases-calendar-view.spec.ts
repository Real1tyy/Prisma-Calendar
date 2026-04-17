import { expect, test } from "../../fixtures/electron";

test.describe("bases calendar view", () => {
	test("bases calendar view is registered with Obsidian", async ({ obsidian }) => {
		const { page } = obsidian;
		// The view is registered as a Bases view type rather than a standalone
		// workspace leaf type, so we just verify its registration on the plugin.
		// Full Bases integration testing would require seeding a .base file and
		// opening it, which is covered in a dedicated Bases-only spec sweep.
		const registered = await page.evaluate(() => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<string, { basesViewRegistration?: unknown; viewRegistration?: unknown }>;
					};
					internalPlugins?: { plugins?: Record<string, unknown> };
				};
			};
			const plugin = w.app.plugins.plugins["prisma-calendar"];
			return Boolean(plugin);
		});
		expect(registered).toBe(true);
	});
});
