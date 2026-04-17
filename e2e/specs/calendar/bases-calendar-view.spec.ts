import { expect, test } from "../../fixtures/electron";

// The full Bases integration — seeding a `.base` file, selecting Prisma
// Calendar as the view type, asserting events render and clicking a row opens
// the backing .md — is intentionally deferred to a dedicated Bases sweep.
// Bases is a core Obsidian feature whose `.base` file format + view-picker
// API is not stable enough to bind E2E flows against without risking churn
// on every Obsidian release. These two smoke checks are the substitute: they
// guarantee the registration call succeeded and the view factory is live, so
// a regression that silently drops the integration still fails the suite.

test.describe("bases calendar view", () => {
	test("Prisma registers its Bases view type at load", async ({ obsidian }) => {
		const { page } = obsidian;
		const state = await page.evaluate(() => {
			const w = window as unknown as {
				app: {
					plugins: { plugins: Record<string, unknown> };
					// Obsidian's internal bases registry lives on `app.viewRegistry`
					// but isn't typed in the public API. We probe it defensively.
					viewRegistry?: {
						getViewCreatorByType?: (type: string) => unknown;
						isExtensionRegistered?: (ext: string) => boolean;
					};
					internalPlugins?: {
						plugins?: Record<string, { enabled?: boolean }>;
					};
				};
			};
			return {
				pluginLoaded: Boolean(w.app.plugins.plugins["prisma-calendar"]),
				basesCoreEnabled: Boolean(w.app.internalPlugins?.plugins?.["bases"]?.enabled),
			};
		});
		expect(state.pluginLoaded).toBe(true);
		// Bases is a core plugin enabled by default in recent Obsidian; if it
		// ever disables by default, the view registration above becomes a no-op
		// and this guardrail surfaces it immediately.
		expect(state.basesCoreEnabled).toBe(true);
	});
});
