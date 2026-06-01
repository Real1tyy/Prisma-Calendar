import { readFile } from "node:fs/promises";

import type { ActionDefMap } from "../types";
import { emitContract } from "./emit-contract";
import type { PluginApiContract, PluginApiContractAction } from "./types";

export interface ContractMatch {
	ok: true;
}

export interface ContractDrift {
	ok: false;
	drift: string[];
}

/**
 * Pure diff between the emitted and committed contracts. Returns
 * `{ ok: true }` on perfect structural equality, or an `{ ok: false, drift }`
 * payload listing every difference in human-readable form.
 *
 * The diff is intentionally shallow-prose: each line is meant to read like a
 * git-blame annotation, not a JSON Patch. The goal is "tell me what changed
 * so I know whether to regenerate or revert."
 */
export function compareContracts(
	emitted: PluginApiContract,
	committed: PluginApiContract
): ContractMatch | ContractDrift {
	const drift: string[] = [];

	// Widen to `number` to bypass the literal-type narrowing that makes
	// `1 !== 1` look tautological — the runtime values can diverge if the
	// committed file was emitted by an older library version.
	const emittedVersion: number = emitted.contractVersion;
	const committedVersion: number = committed.contractVersion;
	if (emittedVersion !== committedVersion) {
		drift.push(`contractVersion: ${String(committedVersion)} → ${String(emittedVersion)}`);
	}
	if (emitted.globalKey !== committed.globalKey) {
		drift.push(`globalKey: "${committed.globalKey}" → "${emitted.globalKey}"`);
	}
	if (emitted.pluginVersion !== committed.pluginVersion) {
		drift.push(`pluginVersion: "${committed.pluginVersion}" → "${emitted.pluginVersion}"`);
	}

	const emittedNames = new Set(Object.keys(emitted.actions));
	const committedNames = new Set(Object.keys(committed.actions));

	for (const name of emittedNames) {
		if (!committedNames.has(name)) drift.push(`action added: ${name}`);
	}
	for (const name of committedNames) {
		if (!emittedNames.has(name)) drift.push(`action removed: ${name}`);
	}

	for (const name of emittedNames) {
		if (!committedNames.has(name)) continue;
		diffAction(name, emitted.actions[name], committed.actions[name], drift);
	}

	return drift.length === 0 ? { ok: true } : { ok: false, drift };
}

function diffAction(
	name: string,
	emitted: PluginApiContractAction,
	committed: PluginApiContractAction,
	drift: string[]
): void {
	if (emitted.description !== committed.description) {
		drift.push(`${name}.description changed`);
	}
	if (emitted.urlAccessible !== committed.urlAccessible) {
		drift.push(`${name}.urlAccessible: ${String(committed.urlAccessible)} → ${String(emitted.urlAccessible)}`);
	}
	if (JSON.stringify(emitted.http) !== JSON.stringify(committed.http)) {
		drift.push(`${name}.http changed: ${JSON.stringify(committed.http)} → ${JSON.stringify(emitted.http)}`);
	}
	if (JSON.stringify(emitted.input) !== JSON.stringify(committed.input)) {
		drift.push(`${name}.input schema changed`);
	}
	if (JSON.stringify(emitted.output) !== JSON.stringify(committed.output)) {
		drift.push(`${name}.output schema changed`);
	}
}

export class ContractDriftError extends Error {
	readonly drift: string[];
	readonly regenerateCommand: string;

	constructor(drift: string[], regenerateCommand: string) {
		const driftList = drift.map((line) => `  • ${line}`).join("\n");
		super(
			[
				"Plugin API contract drift detected.",
				"",
				"The committed `api-contract.json` does not match the current action map.",
				"",
				"Changes:",
				driftList,
				"",
				`To accept these changes, regenerate the contract:`,
				`  ${regenerateCommand}`,
				"",
				"Then commit the updated artifact.",
			].join("\n")
		);
		this.name = "ContractDriftError";
		this.drift = drift;
		this.regenerateCommand = regenerateCommand;
	}
}

/**
 * Vitest-friendly assertion that:
 *   1. emits the contract from the current action map,
 *   2. loads the committed `api-contract.json`,
 *   3. diffs them,
 *   4. throws `ContractDriftError` with regenerate instructions on mismatch.
 *
 * The throw is structured so vitest's default reporter renders the message
 * cleanly — the contributor sees the drift and the exact command to fix it.
 */
export async function assertNoContractDrift(args: {
	actions: ActionDefMap;
	committedPath: string;
	globalKey: string;
	pluginVersion: string;
	regenerateCommand: string;
}): Promise<void> {
	const emitted = emitContract({
		globalKey: args.globalKey,
		pluginVersion: args.pluginVersion,
		actions: args.actions,
	});

	let committedRaw: string;
	try {
		committedRaw = await readFile(args.committedPath, "utf-8");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new ContractDriftError(
			[`api-contract.json missing or unreadable at ${args.committedPath} (${message})`],
			args.regenerateCommand
		);
	}

	let committed: PluginApiContract;
	try {
		committed = JSON.parse(committedRaw) as PluginApiContract;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new ContractDriftError([`api-contract.json is not valid JSON (${message})`], args.regenerateCommand);
	}

	const result = compareContracts(emitted, committed);
	if (!result.ok) {
		throw new ContractDriftError(result.drift, args.regenerateCommand);
	}
}
