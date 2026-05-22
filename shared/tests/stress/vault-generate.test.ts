import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { SeededRandom } from "../../src/testing/stress/seeded-random";
import type { VaultProfile } from "../../src/testing/stress/types";
import { generateVault, type GeneratedEvent } from "../../src/testing/stress/vault/generate";

const PROFILE: VaultProfile = { name: "tiny", events: 5, recurring: 1 };

const buildEvent = (rng: SeededRandom, index: number): GeneratedEvent => ({
	relativePath: `Event-${String(index).padStart(3, "0")}.md`,
	content: `---\nstart: 2026-01-${String((index % 28) + 1).padStart(2, "0")}\nweight: ${rng.int(0, 100)}\n---\n# Event ${index}\n`,
});

const tmpDirs: string[] = [];
function freshDir(): string {
	const dir = mkdtempSync(path.join(os.tmpdir(), "stress-vault-"));
	tmpDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tmpDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("generateVault", () => {
	it("writes exactly profile.events files", () => {
		const dir = freshDir();
		generateVault({ dir, profile: PROFILE, seed: 42, buildEvent });
		expect(readdirSync(dir)).toHaveLength(5);
	});

	it("is byte-identical for the same seed", () => {
		const a = freshDir();
		const b = freshDir();
		generateVault({ dir: a, profile: PROFILE, seed: 42, buildEvent });
		generateVault({ dir: b, profile: PROFILE, seed: 42, buildEvent });
		for (let i = 0; i < PROFILE.events; i++) {
			const name = `Event-${String(i).padStart(3, "0")}.md`;
			expect(readFileSync(path.join(b, name), "utf8")).toBe(readFileSync(path.join(a, name), "utf8"));
		}
	});

	it("differs for a different seed", () => {
		const a = freshDir();
		const b = freshDir();
		generateVault({ dir: a, profile: PROFILE, seed: 42, buildEvent });
		generateVault({ dir: b, profile: PROFILE, seed: 7, buildEvent });
		const name = "Event-000.md";
		expect(readFileSync(path.join(b, name), "utf8")).not.toBe(readFileSync(path.join(a, name), "utf8"));
	});

	it("returns a manifest describing the generated vault", () => {
		const dir = freshDir();
		const manifest = generateVault({ dir, profile: PROFILE, seed: 42, buildEvent, generatorVersion: 3 });
		expect(manifest).toMatchObject({
			profile: "tiny",
			seed: 42,
			events: 5,
			recurring: 1,
			generatorVersion: 3,
		});
	});
});
