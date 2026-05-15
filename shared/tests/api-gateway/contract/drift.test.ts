import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import {
	assertNoContractDrift,
	compareContracts,
	ContractDriftError,
	defineAction,
	emitContract,
	serializeContract,
} from "../../../src/integrations/api-gateway/contract";
import type { ActionDefMap } from "../../../src/integrations/api-gateway/types";

const Input = z.object({ title: z.string() });
const Output = z.object({ id: z.string() });

function buildActions(): ActionDefMap {
	return {
		createTask: defineAction({
			description: "Create a task.",
			input: Input,
			output: Output,
			handler: () => ({ id: "1" }),
		}),
	};
}

describe("compareContracts", () => {
	it("returns ok when contracts match", () => {
		const a = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions: buildActions() });
		const b = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions: buildActions() });

		expect(compareContracts(a, b)).toEqual({ ok: true });
	});

	it("detects added and removed actions", () => {
		const emitted = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions: buildActions() });
		const committed = emitContract({
			globalKey: "Tasks",
			pluginVersion: "1.0.0",
			actions: {
				...buildActions(),
				oldAction: defineAction({ description: "Old.", handler: () => null }),
			},
		});

		const result = compareContracts(emitted, committed);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.drift).toContain("action removed: oldAction");
	});

	it("detects description and schema changes", () => {
		const committed = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions: buildActions() });
		const changed: ActionDefMap = {
			createTask: defineAction({
				description: "Changed description.",
				input: z.object({ title: z.string(), priority: z.number() }),
				output: Output,
				handler: () => ({ id: "1" }),
			}),
		};
		const emitted = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions: changed });

		const result = compareContracts(emitted, committed);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.drift).toContain("createTask.description changed");
		expect(result.drift).toContain("createTask.input schema changed");
	});

	it("detects globalKey, pluginVersion, and contractVersion changes", () => {
		const a = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions: buildActions() });
		const b = emitContract({ globalKey: "Other", pluginVersion: "2.0.0", actions: buildActions() });

		const result = compareContracts(a, b);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.drift.some((line) => line.includes("globalKey"))).toBe(true);
		expect(result.drift.some((line) => line.includes("pluginVersion"))).toBe(true);
	});
});

describe("assertNoContractDrift", () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "contract-drift-"));
	});

	afterEach(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("passes when committed file matches the emitted contract", async () => {
		const actions = buildActions();
		const contract = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions });
		const path = join(tmpDir, "api-contract.json");
		await writeFile(path, serializeContract(contract));

		await expect(
			assertNoContractDrift({
				actions,
				committedPath: path,
				globalKey: "Tasks",
				pluginVersion: "1.0.0",
				regenerateCommand: "pnpm contract:emit",
			})
		).resolves.toBeUndefined();
	});

	it("throws ContractDriftError with regenerate instructions on drift", async () => {
		const actions = buildActions();
		const stale = emitContract({
			globalKey: "Tasks",
			pluginVersion: "1.0.0",
			actions: {
				createTask: defineAction({ description: "Stale.", handler: () => null }),
			},
		});
		const path = join(tmpDir, "api-contract.json");
		await writeFile(path, serializeContract(stale));

		await expect(
			assertNoContractDrift({
				actions,
				committedPath: path,
				globalKey: "Tasks",
				pluginVersion: "1.0.0",
				regenerateCommand: "pnpm contract:emit",
			})
		).rejects.toThrowError(ContractDriftError);
	});

	it("throws ContractDriftError with a clear message when file is missing", async () => {
		await expect(
			assertNoContractDrift({
				actions: buildActions(),
				committedPath: join(tmpDir, "does-not-exist.json"),
				globalKey: "Tasks",
				pluginVersion: "1.0.0",
				regenerateCommand: "pnpm contract:emit",
			})
		).rejects.toMatchObject({
			name: "ContractDriftError",
			drift: expect.arrayContaining([expect.stringContaining("missing or unreadable")]) as unknown as string[],
		});
	});

	it("throws ContractDriftError when file is not valid JSON", async () => {
		const path = join(tmpDir, "api-contract.json");
		await writeFile(path, "{ not json");

		await expect(
			assertNoContractDrift({
				actions: buildActions(),
				committedPath: path,
				globalKey: "Tasks",
				pluginVersion: "1.0.0",
				regenerateCommand: "pnpm contract:emit",
			})
		).rejects.toMatchObject({
			drift: expect.arrayContaining([expect.stringContaining("not valid JSON")]) as unknown as string[],
		});
	});
});
