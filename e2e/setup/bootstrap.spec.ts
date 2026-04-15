import { bootstrapObsidian } from "../fixtures/electron";
import { expect, test } from "../fixtures/electron";

test.describe("bootstrap", () => {
	test("obsidian launches with prisma-calendar ready", async () => {
		const ob = await bootstrapObsidian({ prefix: "bootstrap" });

		try {
			// Renderer side: plugin visible in registry and at least one bundle initialized.
			const summary = await ob.page.evaluate((id) => {
				const w = window as unknown as {
					app: {
						plugins: {
							plugins: Record<
								string,
								{
									manifest?: { version?: string };
									calendarBundles?: Array<{ calendarId: string }>;
									settingsStore?: { currentSettings?: { calendars?: Array<{ directory?: string }> } };
								}
							>;
						};
						commands: { commands: Record<string, unknown> };
					};
				};
				const plugin = w.app.plugins.plugins[id];
				return {
					pluginLoaded: Boolean(plugin),
					version: plugin?.manifest?.version ?? null,
					bundleIds: plugin?.calendarBundles?.map((b) => b.calendarId) ?? [],
					directory: plugin?.settingsStore?.currentSettings?.calendars?.[0]?.directory ?? null,
					prismaCommands: Object.keys(w.app.commands.commands).filter((c) => c.startsWith(`${id}:`)),
				};
			}, "prisma-calendar");

			expect(summary.pluginLoaded, "prisma-calendar must be loaded").toBe(true);
			expect(summary.bundleIds.length, "at least one bundle must exist").toBeGreaterThan(0);
			expect(summary.directory, "data.json directory should be seeded to Events").toBe("Events");
			expect(summary.prismaCommands.length, "prisma-calendar should register commands").toBeGreaterThan(0);

			// Seed file is readable through the fixture (sanity for vault access).
			const eventNote = ob.readVaultFile("Events/Team Meeting.md");
			expect(eventNote).toContain("Team Meeting");
		} finally {
			await ob.close();
		}
	});
});
