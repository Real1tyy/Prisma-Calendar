import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, it } from "vitest";

import { emitExternalApiDts, serializeExternalApiDts } from "../integrations/api-gateway/external-apis";
import type { ActionDefMap } from "../integrations/api-gateway/types";
import { assertNoContractDrift, emitContract, serializeContract } from "../integrations/api-gateway/contract";
import type { PluginApiContract } from "../integrations/api-gateway/contract/types";

/**
 * `runContractDriftTest` collapses the boilerplate every producer plugin
 * needs to gate its committed `api-contract.json` against the live action
 * map. Pass the plugin directory and the built action map; the runner
 * derives the contract path and the plugin version from the standard layout
 * (`<pluginDir>/api-contract.json` + `<pluginDir>/package.json`).
 *
 * `UPDATE_CONTRACT=1` rewrites the artifact instead of asserting — same
 * semantics as the original per-plugin tests.
 */
export interface RunContractDriftTestArgs {
	pluginDir: string;
	globalKey: string;
	actions: ActionDefMap;
	regenerateCommand: string;
}

export async function runContractDriftTest(args: RunContractDriftTestArgs): Promise<void> {
	const contractPath = resolve(args.pluginDir, "api-contract.json");
	const pluginVersion = readPackageVersion(args.pluginDir);

	if (process.env["UPDATE_CONTRACT"] === "1") {
		const contract = emitContract({
			globalKey: args.globalKey,
			pluginVersion,
			actions: args.actions,
		});
		writeFileSync(contractPath, serializeContract(contract));
		return;
	}

	await assertNoContractDrift({
		actions: args.actions,
		committedPath: contractPath,
		globalKey: args.globalKey,
		pluginVersion,
		regenerateCommand: args.regenerateCommand,
	});
}

/**
 * `runExternalApisDriftTest` is the .d.ts equivalent: reads the committed
 * `api-contract.json`, runs the emitter in-memory, and compares the result
 * against the committed `shared/src/external-apis/<plugin-kebab>.d.ts`.
 *
 * `pluginDir` anchors the contract path and the kebab-case file name; the
 * monorepo root is derived as `<pluginDir>/..` so the emitted .d.ts can be
 * located deterministically without each caller hardcoding paths.
 *
 * `UPDATE_EXTERNAL_APIS=1` rewrites the .d.ts instead of asserting.
 */
export interface RunExternalApisDriftTestArgs {
	pluginDir: string;
	pluginKebab: string;
	regenerateCommand: string;
}

export async function runExternalApisDriftTest(args: RunExternalApisDriftTestArgs): Promise<void> {
	const contractPath = resolve(args.pluginDir, "api-contract.json");
	const monorepoRoot = resolve(args.pluginDir, "..");
	const dtsPath = resolve(monorepoRoot, "shared", "src", "external-apis", `${args.pluginKebab}.d.ts`);
	const sourceRel = relative(monorepoRoot, contractPath);

	const contract = JSON.parse(readFileSync(contractPath, "utf-8")) as PluginApiContract;
	const emitted = serializeExternalApiDts(
		await emitExternalApiDts({
			contract,
			sourcePath: sourceRel,
			regenerateCommand: args.regenerateCommand,
		})
	);

	if (process.env["UPDATE_EXTERNAL_APIS"] === "1") {
		writeFileSync(dtsPath, emitted);
		return;
	}

	const committed = readFileSync(dtsPath, "utf-8");
	if (emitted !== committed) {
		throw new Error(
			[
				`External-API .d.ts drift detected for ${args.pluginKebab}.`,
				"",
				`The committed shared/src/external-apis/${args.pluginKebab}.d.ts does not match`,
				"what would be generated from the current api-contract.json.",
				"",
				"To accept the regenerated output, run:",
				`  ${args.regenerateCommand}`,
				"",
				"Then commit the updated .d.ts.",
			].join("\n")
		);
	}
}

function readPackageVersion(pluginDir: string): string {
	const pkgPath = resolve(pluginDir, "package.json");
	const raw = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
	return raw.version;
}

/**
 * Declares the full pair of API drift tests (contract + external-apis .d.ts)
 * for a single producer plugin inside one `describe` block. Call this at the
 * top level of a vitest file — it replaces the four-test boilerplate that
 * each plugin used to duplicate.
 *
 * The host vitest file must run in a jsdom environment because
 * `runExternalApisDriftTest` depends on `json-schema-to-typescript` which
 * touches the `location` global. Add `// @vitest-environment jsdom` to the
 * top of the host file.
 */
export interface DeclareApiDriftSuiteArgs {
	pluginDir: string;
	pluginKebab: string;
	globalKey: string;
	actions: ActionDefMap;
	contractRegenerateCommand: string;
	externalApisRegenerateCommand: string;
}

export function declareApiDriftSuite(args: DeclareApiDriftSuiteArgs): void {
	describe(`${args.pluginKebab} API drift`, () => {
		it("api-contract.json matches the live action map (UPDATE_CONTRACT=1 to regenerate)", async () => {
			await runContractDriftTest({
				pluginDir: args.pluginDir,
				globalKey: args.globalKey,
				actions: args.actions,
				regenerateCommand: args.contractRegenerateCommand,
			});
		});

		it("external-apis .d.ts matches the contract (UPDATE_EXTERNAL_APIS=1 to regenerate)", async () => {
			await runExternalApisDriftTest({
				pluginDir: args.pluginDir,
				pluginKebab: args.pluginKebab,
				regenerateCommand: args.externalApisRegenerateCommand,
			});
		});
	});
}
