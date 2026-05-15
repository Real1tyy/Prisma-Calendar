import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { assertNoContractDrift, emitContract, serializeContract } from "@real1ty-obsidian-plugins";
import { describe, it } from "vitest";

import { buildContractActions, GLOBAL_KEY } from "../../src/core/api/contract-actions";

// Anchored against the repo root via Prisma-Calendar's package layout. The
// emitter and the assertion both consult this single path — drift in the
// committed `api-contract.json` triggers the assertion, and setting
// `UPDATE_CONTRACT=1` rewrites it instead.
const PLUGIN_ROOT = resolve(__dirname, "..", "..");
const CONTRACT_PATH = resolve(PLUGIN_ROOT, "api-contract.json");
const REGENERATE_COMMAND = "pnpm --dir Prisma-Calendar run contract:emit";

const pluginVersion = (() => {
	const raw = JSON.parse(readFileSync(resolve(PLUGIN_ROOT, "package.json"), "utf-8")) as { version: string };
	return raw.version;
})();

describe("Prisma-Calendar window-API contract", () => {
	it("matches the committed api-contract.json (or regenerates it when UPDATE_CONTRACT=1)", async () => {
		const actions = buildContractActions();

		if (process.env["UPDATE_CONTRACT"] === "1") {
			const contract = emitContract({
				globalKey: GLOBAL_KEY,
				pluginVersion,
				actions,
			});
			writeFileSync(CONTRACT_PATH, serializeContract(contract));
			// Skip the drift assertion in update mode — the file has just been
			// regenerated, so any drift would be tautologically zero.
			return;
		}

		await assertNoContractDrift({
			actions,
			committedPath: CONTRACT_PATH,
			globalKey: GLOBAL_KEY,
			pluginVersion,
			regenerateCommand: REGENERATE_COMMAND,
		});
	});
});
