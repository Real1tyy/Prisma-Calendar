import type { Invoker } from "./types";

/**
 * Builds an `Invoker` that calls handlers directly on an in-process API
 * object (typically `gateway.getApi()`). Use this for vitest Tier 0 /
 * fast-feedback contract suites that exercise the same plan as the Tier 1
 * Playwright run, without paying the Electron boot cost.
 */
export function inProcessInvoker(api: Record<string, (...args: unknown[]) => unknown>): Invoker {
	return async (action, params) => {
		const fn = api[action];
		if (typeof fn !== "function") {
			throw new Error(`inProcessInvoker: action "${action}" is not a function on the provided API`);
		}
		return await Promise.resolve(fn(params));
	};
}

/**
 * Builds an `Invoker` that serialises calls through `page.evaluate` to invoke
 * the action on `window[globalKey]`. The runner stays Node-side; only the
 * action name + params cross the boundary, then the JSON-clonable result
 * comes back. This is the canonical adapter for Tier 1 black-box specs.
 *
 * Typed loosely (`unknown` page) so this module does not take a hard
 * dependency on `@playwright/test`. Plugin specs import Playwright directly;
 * this helper only needs `evaluate(fn, arg)`.
 */
export interface PageEvaluateLike {
	evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
}

export function pageEvaluateInvoker(page: PageEvaluateLike, globalKey: string): Invoker {
	return async (action, params) => {
		return await page.evaluate(
			async (arg: { globalKey: string; action: string; params: unknown }) => {
				// `window` is the renderer global Obsidian plugins expose APIs on.
				// `globalThis` is intentionally avoided here — the obsidian-md
				// ESLint rule prefers `window`/`activeWindow` for popout
				// compatibility, even though this callback only runs in the main
				// page context via `page.evaluate`.
				const api = (window as unknown as Record<string, unknown>)[arg.globalKey] as
					| Record<string, (p: unknown) => unknown>
					| undefined;
				if (!api) throw new Error(`window.${arg.globalKey} is not exposed`);
				const fn = api[arg.action];
				if (typeof fn !== "function") throw new Error(`window.${arg.globalKey}.${arg.action} is not a function`);
				const result = await Promise.resolve(fn(arg.params));
				return result;
			},
			{ globalKey, action, params }
		);
	};
}
