import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineAction, emitContract } from "../../../src/integrations/api-gateway/contract";
import {
	emitExternalApiDts,
	serializeExternalApiDts,
} from "../../../src/integrations/api-gateway/external-apis/emit-dts";
import type { ActionDefMap } from "../../../src/integrations/api-gateway/types";

const SOURCE_PATH = "TestPlugin/api-contract.json";
const REGEN_CMD = "pnpm --filter @real1ty-obsidian-plugins run emit-external-apis";

function buildEmit(actions: ActionDefMap, globalKey = "TestPlugin"): Promise<string> {
	const contract = emitContract({ globalKey, pluginVersion: "0.0.0", actions });
	return emitExternalApiDts({ contract, sourcePath: SOURCE_PATH, regenerateCommand: REGEN_CMD });
}

describe("emitExternalApiDts", () => {
	it("emits the API interface and window augmentation for an empty contract", async () => {
		const dts = await buildEmit({});

		expect(dts).toContain("export interface TestPluginApi {");
		expect(dts).toContain("declare global {");
		expect(dts).toContain("TestPlugin?: TestPluginApi;");
		expect(dts).toContain(`Source: ${SOURCE_PATH}`);
		expect(dts).toContain(`Regenerate: ${REGEN_CMD}`);
	});

	it("renders an action with no input/output as a zero-arg Promise<void>", async () => {
		const actions: ActionDefMap = {
			ping: defineAction({
				description: "Liveness check.",
				handler: () => undefined,
			}),
		};

		const dts = await buildEmit(actions);

		expect(dts).toContain("ping(): Promise<void>;");
		expect(dts).not.toContain("TestPluginPingInput");
		expect(dts).not.toContain("TestPluginPingOutput");
	});

	it("renders an input-only action with a typed parameter and Promise<void>", async () => {
		const actions: ActionDefMap = {
			notify: defineAction({
				description: "Fire and forget notify.",
				input: z.object({ message: z.string() }),
				handler: () => undefined,
			}),
		};

		const dts = await buildEmit(actions);

		expect(dts).toContain("export interface TestPluginNotifyInput");
		expect(dts).toContain("notify(input: TestPluginNotifyInput): Promise<void>;");
	});

	it("renders an output-only action with a parameterless typed return", async () => {
		const actions: ActionDefMap = {
			version: defineAction({
				description: "Return plugin version.",
				output: z.string(),
				handler: () => "1.0",
			}),
		};

		const dts = await buildEmit(actions);

		expect(dts).toContain("export type TestPluginVersionOutput = string");
		expect(dts).toContain("version(): Promise<TestPluginVersionOutput>;");
	});

	it("renders primitive output types as named aliases (not anonymous {})", async () => {
		const actions: ActionDefMap = {
			isReady: defineAction({
				description: "Boolean health.",
				output: z.boolean(),
				handler: () => true,
			}),
		};

		const dts = await buildEmit(actions);

		expect(dts).toContain("export type TestPluginIsReadyOutput = boolean");
		expect(dts).not.toContain("export type TestPluginIsReadyOutput = {}");
	});

	it("always uses Promise<T> regardless of handler sync/async", async () => {
		const actions: ActionDefMap = {
			syncOp: defineAction({
				description: "Sync handler.",
				output: z.number(),
				handler: () => 1,
			}),
			asyncOp: defineAction({
				description: "Async handler.",
				output: z.number(),
				handler: () => Promise.resolve(1),
			}),
		};

		const dts = await buildEmit(actions);

		expect(dts).toContain("syncOp(): Promise<TestPluginSyncOpOutput>;");
		expect(dts).toContain("asyncOp(): Promise<TestPluginAsyncOpOutput>;");
	});

	it("emits actions in alphabetical order matching the contract", async () => {
		const actions: ActionDefMap = {
			zeta: defineAction({ description: "Z", handler: () => undefined }),
			alpha: defineAction({ description: "A", handler: () => undefined }),
			mu: defineAction({ description: "M", handler: () => undefined }),
		};

		const dts = await buildEmit(actions);
		const idxA = dts.indexOf("alpha(");
		const idxM = dts.indexOf("mu(");
		const idxZ = dts.indexOf("zeta(");

		expect(idxA).toBeGreaterThan(-1);
		expect(idxA).toBeLessThan(idxM);
		expect(idxM).toBeLessThan(idxZ);
	});

	it("namespaces every emitted type with the contract globalKey", async () => {
		const actions: ActionDefMap = {
			getEvent: defineAction({
				description: "",
				input: z.object({ id: z.string() }),
				output: z.object({ id: z.string(), title: z.string() }),
				handler: () => ({ id: "1", title: "x" }),
			}),
		};

		const dts = await buildEmit(actions, "MyCalendar");

		expect(dts).toContain("MyCalendarGetEventInput");
		expect(dts).toContain("MyCalendarGetEventOutput");
		expect(dts).toContain("MyCalendarApi");
		expect(dts).toContain("MyCalendar?: MyCalendarApi;");
	});

	it("dedupes nested-type declarations shared across multiple actions", async () => {
		// Two actions whose schemas reference the same named sub-shape via `.describe()`.
		// Without dedup, json-schema-to-typescript emits two `export type Color = …`
		// declarations and TypeScript rejects with TS2300 (Duplicate identifier).
		const Color = z.enum(["red", "blue"]).describe("Color");
		const actions: ActionDefMap = {
			alpha: defineAction({
				description: "",
				input: z.object({ color: Color }),
				handler: () => undefined,
			}),
			beta: defineAction({
				description: "",
				input: z.object({ color: Color }),
				handler: () => undefined,
			}),
		};

		const dts = await buildEmit(actions);
		const colorDeclarations = dts.match(/^export type Color\b/gm) ?? [];
		expect(colorDeclarations.length, "Color must be declared at most once").toBeLessThanOrEqual(1);
	});
});

describe("serializeExternalApiDts", () => {
	it("ensures exactly one trailing newline so round-trips have zero diff churn", () => {
		expect(serializeExternalApiDts("abc")).toBe("abc\n");
		expect(serializeExternalApiDts("abc\n")).toBe("abc\n");
		expect(serializeExternalApiDts("abc\n\n\n")).toBe("abc\n");
	});
});
