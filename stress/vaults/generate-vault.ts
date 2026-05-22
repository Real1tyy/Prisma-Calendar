import path from "node:path";

import { generateVault } from "@real1ty-obsidian-plugins/testing/stress";

import { buildPrismaEvent } from "./event-builder";
import { PROFILES, type ProfileName } from "./profiles";

// Standalone vault generator CLI. Useful for pre-seeding a vault on disk for
// inspection or for the future bootstrap-seed-dir cold-start flow. The
// navigation spec generates inline; this script is the manual entry point.
//
//   tsx stress/vaults/generate-vault.ts --profile small --seed 42 --out /tmp/v

function parseArgs(argv: readonly string[]): Map<string, string> {
	const args = new Map<string, string>();
	for (let i = 0; i < argv.length; i++) {
		const token = argv[i];
		if (token?.startsWith("--")) {
			args.set(token.slice(2), argv[i + 1] ?? "");
			i++;
		}
	}
	return args;
}

function main(): void {
	const args = parseArgs(process.argv.slice(2));
	const profileName = (args.get("profile") ?? "small") as ProfileName;
	const profile = PROFILES[profileName];
	if (!profile) {
		throw new Error(`Unknown profile "${profileName}". Available: ${Object.keys(PROFILES).join(", ")}`);
	}

	const seed = Number.parseInt(args.get("seed") ?? "42", 10);
	const outDir = args.get("out") ?? path.resolve(process.cwd(), "stress", ".vaults", profileName);
	const targetDir = path.join(outDir, profile.directory);

	const manifest = generateVault({
		dir: targetDir,
		profile,
		seed,
		buildEvent: buildPrismaEvent,
		manifestPath: path.join(outDir, ".obsidian", "prisma-stress-manifest.json"),
	});

	console.log(`[stress] generated ${manifest.events} events (${profileName}, seed ${seed}) -> ${targetDir}`);
}

main();
