import { bootstrapObsidian, expect, test } from "../fixtures/electron";
import type { PrismaPlugin, PrismaWindow } from "../fixtures/window-types";

test.describe("bootstrap", () => {
	test("obsidian launches with prisma-calendar ready", async () => {
		const ob = await bootstrapObsidian({ prefix: "bootstrap" });

		try {
			// Renderer side: plugin visible in registry and at least one bundle initialized.
			const summary = await ob.page.evaluate((id) => {
				const w = window as unknown as PrismaWindow;
				const plugin = w.app.plugins.plugins[id] as PrismaPlugin | undefined;
				const calendars = plugin?.settingsStore?.currentSettings?.["calendars"] as
					| Array<{ directory?: string }>
					| undefined;
				return {
					pluginLoaded: Boolean(plugin),
					version: plugin?.manifest?.version ?? null,
					bundleIds: plugin?.calendarBundles?.map((b) => b.calendarId) ?? [],
					directory: calendars?.[0]?.directory ?? null,
					prismaCommands: Object.keys(w.app.commands.commands).filter((c) => c.startsWith(`${id}:`)),
				};
			}, "prisma-calendar");

			expect(summary.pluginLoaded, "prisma-calendar must be loaded").toBe(true);
			expect(summary.bundleIds.length, "at least one bundle must exist").toBeGreaterThan(0);
			expect(summary.directory, "data.json directory should be seeded to Events").toBe("Events");
			expect(summary.prismaCommands.length, "prisma-calendar should register commands").toBeGreaterThan(0);

			const welcome = ob.readVaultFile("Welcome.md");
			expect(welcome).toContain("Welcome");
		} finally {
			await ob.close();
		}
	});
});
