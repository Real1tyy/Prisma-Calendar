import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createSeededRandom, type SeededRandom } from "../seeded-random";
import type { VaultProfile } from "../types";

// Generic, deterministic vault generator. The plugin supplies a `buildEvent`
// that turns an index + seeded RNG into a markdown file; the engine here owns
// the loop, directory creation, and manifest. Same seed → byte-identical files.

export interface GeneratedEvent {
	/** Path relative to the target `dir` (e.g. `Event-0001.md`). */
	relativePath: string;
	content: string;
}

export interface VaultManifest {
	profile: string;
	seed: number;
	events: number;
	recurring: number;
	generatorVersion: number;
	createdAt: string;
}

export interface GenerateVaultOptions<P extends VaultProfile> {
	/** Absolute target directory; created if missing. */
	dir: string;
	profile: P;
	seed: number;
	buildEvent: (rng: SeededRandom, index: number, profile: P) => GeneratedEvent;
	generatorVersion?: number;
	/** Optional path to write the manifest JSON. */
	manifestPath?: string;
}

export function generateVault<P extends VaultProfile>(options: GenerateVaultOptions<P>): VaultManifest {
	const { dir, profile, seed, buildEvent, manifestPath } = options;
	const generatorVersion = options.generatorVersion ?? 1;

	mkdirSync(dir, { recursive: true });
	const rng = createSeededRandom(seed);

	for (let index = 0; index < profile.events; index++) {
		const { relativePath, content } = buildEvent(rng, index, profile);
		const full = path.join(dir, relativePath);
		mkdirSync(path.dirname(full), { recursive: true });
		writeFileSync(full, content, "utf8");
	}

	const manifest: VaultManifest = {
		profile: profile.name,
		seed,
		events: profile.events,
		recurring: profile.recurring,
		generatorVersion,
		createdAt: new Date().toISOString(),
	};
	if (manifestPath) {
		mkdirSync(path.dirname(manifestPath), { recursive: true });
		writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
	}
	return manifest;
}
