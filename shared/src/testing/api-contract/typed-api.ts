import { pageEvaluateInvoker, type PageEvaluateLike } from "./invokers";

/**
 * Build a typed proxy over a plugin's `window[globalKey]` action map. Returns
 * an object that satisfies the consumer's generated `…Api` interface (emitted
 * from `api-contract.json` into `shared/src/external-apis/<plugin>.d.ts`),
 * with every method call dispatched through `pageEvaluateInvoker`.
 *
 * Specs call `api.<action>(input)` and get the contract-typed `Promise<…>`
 * back — no `as` casts, no `unknown` ladders. Drift between the live contract
 * and the spec surfaces as a TypeScript error in the spec file.
 *
 * Each plugin's E2E fixtures should wrap this with a one-line factory:
 *
 *     export const createPrismaApi = (page: Page) =>
 *         createTypedApi<PrismaCalendarApi>(page, "PrismaCalendar");
 *
 * That keeps the per-plugin import of the generated type local while every
 * monorepo plugin shares the same dispatch logic.
 */
export function createTypedApi<TApi extends object>(page: PageEvaluateLike, globalKey: string): TApi {
	const invoke = pageEvaluateInvoker(page, globalKey);
	return new Proxy({} as TApi, {
		get(_target, action: string | symbol) {
			if (typeof action !== "string") return undefined;
			return (input?: unknown) => invoke(action, input);
		},
	});
}
