import type { ContractStep, ContractSuite, Invoker, ResolvedSteps, RunnerHooks } from "./types";

/**
 * Identity helper that exists for typing/documentation purposes — pass any
 * `ContractSuite` literal through it so editors surface the contract shape
 * (and a future migration to a stricter literal type stays painless).
 */
export function defineCrudContractSuite(suite: ContractSuite): ContractSuite {
	return suite;
}

/**
 * Runs every step in order, threading each step's result into a shared
 * `ResolvedSteps` map that subsequent steps can read. On the first step that
 * throws, the runner re-throws — the failing assertion / API error bubbles up
 * with the suite + step name attached so vitest / Playwright reporters render
 * a useful frame.
 */
export async function runContractSuite(
	suite: ContractSuite,
	options: { invoke: Invoker; hooks?: RunnerHooks }
): Promise<ResolvedSteps> {
	const { invoke, hooks } = options;
	const resolved: ResolvedSteps = {};

	await hooks?.begin?.(suite);

	for (const step of suite.steps) {
		const params = resolveParams(step, resolved);
		let result: unknown;
		try {
			result = await invoke(step.action, params);
		} catch (error) {
			throw wrapError(error, suite, step, "invoke");
		}

		if (step.expect) {
			try {
				await step.expect(result, resolved);
			} catch (error) {
				throw wrapError(error, suite, step, "expect");
			}
		}

		resolved[step.name] = result;
		await hooks?.step?.(step, result, resolved);
	}

	await hooks?.end?.(suite, resolved);
	return resolved;
}

function resolveParams(step: ContractStep, prev: ResolvedSteps): unknown {
	if (typeof step.params === "function") {
		return (step.params as (p: ResolvedSteps) => unknown)(prev);
	}
	return step.params;
}

function wrapError(error: unknown, suite: ContractSuite, step: ContractStep, phase: "invoke" | "expect"): Error {
	const original = error instanceof Error ? error : new Error(String(error));
	const wrapped = new Error(
		`[contract:${suite.name}] step "${step.name}" (${step.action}) failed during ${phase}: ${original.message}`
	);
	if (original.stack !== undefined) wrapped.stack = original.stack;
	wrapped.cause = original;
	return wrapped;
}
