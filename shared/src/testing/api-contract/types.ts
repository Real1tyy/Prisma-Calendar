/**
 * Transport-agnostic CRUD-style contract test plan.
 *
 * A `ContractSuite` is a list of named steps; each step invokes one API action,
 * optionally derives its params from the outputs of previous steps, and
 * optionally asserts on its result. The runner is parameterised by an
 * `Invoker`, so the same plan runs in-process (vitest) or through
 * `page.evaluate` (Playwright) without any change to the plan itself.
 *
 * See `docs/decisions/2026-05-14-plugin-api-contract-testing.md` for the
 * architectural rationale.
 */

/** Function that invokes an action by name and returns its result. */
export type Invoker = (action: string, params: unknown) => Promise<unknown>;

/**
 * The outputs of previously-run steps, keyed by step name. Passed to params
 * resolvers and expect callbacks so later steps can reference earlier outputs
 * (e.g. the file path returned by `createEvent`).
 */
export type ResolvedSteps = Record<string, unknown>;

export interface ContractStep {
	/** Unique key under which the result is stored in ResolvedSteps. */
	name: string;
	/** API action name on the window surface. */
	action: string;
	/**
	 * Params for the action. Either a literal value or a resolver function
	 * that derives params from the outputs of prior steps.
	 */
	params: unknown | ((prev: ResolvedSteps) => unknown);
	/** Optional assertion on the result of this step. Receives the previous step results too. */
	expect?: (result: unknown, prev: ResolvedSteps) => void | Promise<void>;
}

export interface ContractSuite {
	/** Human-readable name surfaced by the runner's hooks. */
	name: string;
	steps: ContractStep[];
}

export interface RunnerHooks {
	/** Called after each step completes successfully. Useful for trace logging. */
	step?: (step: ContractStep, result: unknown, prev: ResolvedSteps) => void | Promise<void>;
	/** Called once at the start of the suite. */
	begin?: (suite: ContractSuite) => void | Promise<void>;
	/** Called once at the end of the suite (only on success). */
	end?: (suite: ContractSuite, results: ResolvedSteps) => void | Promise<void>;
}
