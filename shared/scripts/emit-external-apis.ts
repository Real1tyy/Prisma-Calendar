#!/usr/bin/env tsx
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { PluginApiContract } from "../src/integrations/api-gateway/contract/types";
import { emitExternalApiDts, serializeExternalApiDts } from "../src/integrations/api-gateway/external-apis/emit-dts";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SHARED_ROOT = resolve(SCRIPT_DIR, "..");
const MONOREPO_ROOT = resolve(SHARED_ROOT, "..");
const OUTPUT_DIR = resolve(SHARED_ROOT, "src", "external-apis");
const REGENERATE_COMMAND = "pnpm --filter @real1ty-obsidian-plugins run emit-external-apis";

interface DiscoveredContract {
	pluginDir: string;
	contractPath: string;
	contract: PluginApiContract;
}

function discoverContracts(): DiscoveredContract[] {
	const discovered: DiscoveredContract[] = [];

	for (const entry of readdirSync(MONOREPO_ROOT)) {
		const candidate = join(MONOREPO_ROOT, entry);
		let isDir = false;
		try {
			isDir = statSync(candidate).isDirectory();
		} catch {
			continue;
		}
		if (!isDir) continue;

		const contractPath = join(candidate, "api-contract.json");
		let raw: string;
		try {
			raw = readFileSync(contractPath, "utf-8");
		} catch {
			continue;
		}

		let contract: PluginApiContract;
		try {
			contract = JSON.parse(raw) as PluginApiContract;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Failed to parse ${contractPath}: ${message}`);
		}

		discovered.push({ pluginDir: entry, contractPath, contract });
	}

	discovered.sort((a, b) => a.pluginDir.localeCompare(b.pluginDir));
	return discovered;
}

function camelToKebab(str: string): string {
	return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function outputFileFor(pluginDir: string): string {
	return join(OUTPUT_DIR, `${camelToKebab(pluginDir)}.d.ts`);
}

function readCurrent(filePath: string): string | null {
	try {
		return readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

async function main(): Promise<void> {
	const checkOnly = process.argv.includes("--check");
	const discovered = discoverContracts();

	if (discovered.length === 0) {
		console.error("No api-contract.json files found under monorepo root.");
		process.exit(1);
	}

	let driftCount = 0;
	let writeCount = 0;

	for (const { pluginDir, contractPath, contract } of discovered) {
		const outputPath = outputFileFor(pluginDir);
		const sourceRel = relative(MONOREPO_ROOT, contractPath);
		const emitted = await emitExternalApiDts({
			contract,
			sourcePath: sourceRel,
			regenerateCommand: REGENERATE_COMMAND,
		});
		const serialized = serializeExternalApiDts(emitted);
		const current = readCurrent(outputPath);

		if (current === serialized) {
			console.log(`✓ ${relative(MONOREPO_ROOT, outputPath)} up to date`);
			continue;
		}

		if (checkOnly) {
			driftCount += 1;
			console.error(`✗ ${relative(MONOREPO_ROOT, outputPath)} drift detected`);
			continue;
		}

		writeFileSync(outputPath, serialized);
		writeCount += 1;
		console.log(`✎ ${relative(MONOREPO_ROOT, outputPath)} ${current === null ? "created" : "updated"}`);
	}

	if (checkOnly && driftCount > 0) {
		console.error("");
		console.error(`External-API .d.ts drift in ${driftCount} file(s).`);
		console.error(`Regenerate: ${REGENERATE_COMMAND}`);
		process.exit(1);
	}

	if (!checkOnly) {
		console.log("");
		console.log(`emit-external-apis: ${writeCount} file(s) written, ${discovered.length} contract(s) processed.`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
