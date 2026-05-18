import { expect, type Page } from "@playwright/test";
import type { PrismaCalendarApi } from "@real1ty-obsidian-plugins/external-apis/prisma-calendar";
import { createTypedApi, pageEvaluateInvoker, type Invoker } from "@real1ty-obsidian-plugins/testing/api-contract";

/**
 * Shared helpers for the `window.PrismaCalendar.*` contract specs. Two layers:
 *
 *   1. `createPrismaApi(page)` — thin Prisma-typed wrapper over the shared
 *      `createTypedApi<TApi>` factory in `shared/src/testing/api-contract/`.
 *      Returns a `PrismaCalendarApi`-shaped proxy so specs call
 *      `api.createEvent({...})` with full type inference instead of
 *      `(await invoke(...)) as string`. The generated `PrismaCalendarApi`
 *      interface from `@real1ty-obsidian-plugins/external-apis/prisma-calendar`
 *      is the authoritative shape — drift between contract and runtime
 *      surfaces as a compile error in the spec, not a runtime cast surprise.
 *
 *   2. Poll helpers — wait for indexer / window-api / active-file readiness
 *      before the next action. The metadata cache + event repository need a
 *      tick to ingest a freshly created file, and pro-gated actions only
 *      attach to the window after `licenseManager` fires `expose()`.
 */

/** Build a typed `PrismaCalendarApi` proxy backed by `pageEvaluateInvoker`. */
export function createPrismaApi(page: Page): PrismaCalendarApi {
	return createTypedApi<PrismaCalendarApi>(page, "PrismaCalendar");
}

/** Wait until a single file is indexed by the event repository. */
export async function waitForApiIndex(api: PrismaCalendarApi, filePath: string): Promise<void> {
	await expect
		.poll(async () => (await api.getEventByPath({ filePath })) !== null, {
			message: `event ${filePath} never appeared in the indexed event repository`,
		})
		.toBe(true);
}

/** Wait until every file in the list is indexed by the event repository. */
export async function waitForAllIndexed(api: PrismaCalendarApi, filePaths: readonly string[]): Promise<void> {
	await expect
		.poll(async () => {
			const results = await Promise.all(filePaths.map((p) => api.getEventByPath({ filePath: p })));
			return results.every((r) => r !== null);
		})
		.toBe(true);
}

/**
 * Wait until a specific action surfaces as a function on `window[globalKey]`.
 * Pro-gated actions (anything beyond `isPro`) are only attached after the
 * licenseManager subscription fires expose() — `__setProForTesting(true)`
 * triggers that synchronously but the test invocation may still arrive
 * before Obsidian's event loop flushes. Poll the window directly to gate
 * the next invocation.
 */
export async function waitForApiAction(page: Page, globalKey: string, action: string): Promise<void> {
	await expect
		.poll(
			async () =>
				page.evaluate(
					({ key, name }) => {
						const api = (window as unknown as Record<string, unknown>)[key] as Record<string, unknown> | undefined;
						return typeof api?.[name] === "function";
					},
					{ key: globalKey, name: action }
				),
			{ message: `window.${globalKey}.${action} was never exposed` }
		)
		.toBe(true);
}

/**
 * Poll `app.workspace.getActiveFile()?.path` until it matches `expectedPath`.
 * Used by active-note action specs that need the workspace to settle on the
 * opened event before invoking `openEditActiveNoteModal` / `duplicateCurrentEvent`.
 */
export async function waitForActiveFile(page: Page, expectedPath: string): Promise<void> {
	await expect
		.poll(() =>
			page.evaluate(() => {
				const w = window as unknown as {
					app: { workspace: { getActiveFile: () => { path: string } | null } };
				};
				return w.app.workspace.getActiveFile()?.path ?? null;
			})
		)
		.toBe(expectedPath);
}

// Re-export the loose Invoker for the rare callsite that needs the untyped
// surface (drift suites that walk the contract programmatically).
export { type Invoker, pageEvaluateInvoker };
