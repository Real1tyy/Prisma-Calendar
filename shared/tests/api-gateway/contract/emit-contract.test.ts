import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineAction, emitContract, serializeContract } from "../../../src/integrations/api-gateway/contract";
import type { ActionDefMap } from "../../../src/integrations/api-gateway/types";

const TaskInputSchema = z.object({
	title: z.string(),
	priority: z.number().int().optional(),
});

const TaskOutputSchema = z.object({
	id: z.string(),
	title: z.string(),
	createdAt: z.string(),
});

function buildActions(): ActionDefMap {
	return {
		createTask: defineAction({
			description: "Create a new task. Returns the created task.",
			input: TaskInputSchema,
			output: TaskOutputSchema,
			handler: () => ({ id: "1", title: "Task", createdAt: "2026-05-14" }),
			parseParams: (raw) => ({
				title: raw["title"] ?? "",
				priority: raw["priority"] ? Number(raw["priority"]) : undefined,
			}),
		}),
		listTasks: defineAction({
			description: "List all tasks. No params.",
			output: z.array(TaskOutputSchema),
			handler: () => [],
		}),
	};
}

describe("emitContract", () => {
	it("emits a deterministic contract from the action map", () => {
		const contract = emitContract({
			globalKey: "Tasks",
			pluginVersion: "1.0.0",
			actions: buildActions(),
		});

		expect(contract.contractVersion).toBe(1);
		expect(contract.globalKey).toBe("Tasks");
		expect(contract.pluginVersion).toBe("1.0.0");

		// Sorted action keys — load-bearing for drift detection.
		expect(Object.keys(contract.actions)).toEqual(["createTask", "listTasks"]);

		const createTask = contract.actions["createTask"];
		expect(createTask.description).toBe("Create a new task. Returns the created task.");
		expect(createTask.urlAccessible).toBe(true);
		expect(createTask.http).toEqual({ method: "POST", path: "/create-task" });
		expect(createTask.input).toMatchObject({ type: "object", properties: { title: { type: "string" } } });
		expect(createTask.output).toMatchObject({ type: "object", properties: { id: { type: "string" } } });

		const listTasks = contract.actions["listTasks"];
		expect(listTasks.urlAccessible).toBe(false);
		expect(listTasks.http).toEqual({ method: "GET", path: "/list-tasks" });
		expect(listTasks.input).toBeNull();
		expect(listTasks.output).toMatchObject({ type: "array" });
	});

	it("produces identical output across runs (no timestamps, sorted keys)", () => {
		const a = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions: buildActions() });
		const b = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions: buildActions() });

		expect(serializeContract(a)).toBe(serializeContract(b));
	});

	it("preserves null input/output when no schema is declared", () => {
		const actions: ActionDefMap = {
			noSchemas: {
				handler: () => undefined,
				description: "Schemaless action — emitter must record null, not omit the keys.",
			},
		};

		const contract = emitContract({ globalKey: "X", pluginVersion: "0.0.1", actions });
		expect(contract.actions["noSchemas"]?.input).toBeNull();
		expect(contract.actions["noSchemas"]?.output).toBeNull();
	});

	it("omits http when the action opts out via http.disabled", () => {
		const actions: ActionDefMap = {
			internal: defineAction({
				description: "Window-only — not exposed over HTTP.",
				handler: () => null,
				http: { disabled: true },
			}),
		};
		const contract = emitContract({ globalKey: "X", pluginVersion: "0.0.1", actions });
		expect(contract.actions["internal"]?.http).toBeUndefined();
	});

	it("marks an action urlAccessible when only an input ZodObject is declared (no parseParams)", () => {
		const actions: ActionDefMap = {
			schemaOnly: defineAction({
				description: "Window+URL via derived coercer.",
				input: z.object({ id: z.string(), flag: z.boolean().optional() }),
				output: z.boolean(),
				handler: () => true,
			}),
			windowOnly: defineAction({
				description: "No input schema — window-only.",
				output: z.boolean(),
				handler: () => true,
			}),
		};
		const contract = emitContract({ globalKey: "X", pluginVersion: "0.0.1", actions });
		expect(contract.actions["schemaOnly"]?.urlAccessible).toBe(true);
		expect(contract.actions["schemaOnly"]?.http).toEqual({ method: "POST", path: "/schema-only" });
		expect(contract.actions["windowOnly"]?.urlAccessible).toBe(false);
		expect(contract.actions["windowOnly"]?.http).toEqual({ method: "GET", path: "/window-only" });
	});

	it("emits trailing newline on serialised output (matches Prettier defaults)", () => {
		const contract = emitContract({ globalKey: "Tasks", pluginVersion: "1.0.0", actions: buildActions() });
		const serialised = serializeContract(contract);
		expect(serialised.endsWith("\n")).toBe(true);
		expect(serialised).not.toContain("~standard");
	});
});
