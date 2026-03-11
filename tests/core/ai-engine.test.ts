import { describe, expect, it, vi } from "vitest";

import {
	buildCommandForOperation,
	executeOperations,
	gatherCategoryContext,
	parseOperations,
} from "../../src/core/ai/ai-engine";
import type { CalendarBundle } from "../../src/core/calendar-bundle";
import type { AIOperation } from "../../src/types/ai-operation-schemas";

// ─── Shared Fixtures ────────────────────────────────────────────────

const VALID_CREATE: AIOperation = {
	type: "create",
	title: "Team Meeting",
	start: "2025-03-15T09:00:00",
	end: "2025-03-15T10:00:00",
};

const VALID_CREATE_FULL: AIOperation = {
	type: "create",
	title: "Workout",
	start: "2025-03-15T06:00:00",
	end: "2025-03-15T07:00:00",
	allDay: false,
	categories: ["Fitness"],
	location: "Gym",
	participants: ["Alice", "Bob"],
};

const VALID_EDIT: AIOperation = {
	type: "edit",
	filePath: "events/meeting.md",
	title: "Updated Meeting",
};

const VALID_EDIT_FULL: AIOperation = {
	type: "edit",
	filePath: "events/meeting.md",
	title: "Renamed Meeting",
	start: "2025-03-15T14:00:00",
	end: "2025-03-15T15:00:00",
	allDay: false,
	categories: ["Work"],
	location: "Room 42",
	participants: ["Charlie"],
};

const VALID_DELETE: AIOperation = { type: "delete", filePath: "events/old.md" };

const MIXED_OPS: AIOperation[] = [VALID_CREATE, VALID_EDIT, VALID_DELETE];

function wrapInCodeBlock(json: string, lang = "json"): string {
	return `\`\`\`${lang}\n${json}\n\`\`\``;
}

function wrapWithProse(json: string): string {
	return `Here are the events I created:\n\n${wrapInCodeBlock(json)}\n\nLet me know if you want changes.`;
}

function toJson(ops: unknown): string {
	return JSON.stringify(ops);
}

function makeCategoryBundle(
	categories: string[],
	presets?: Array<{ id: string; name: string; categories: string[] }>
): CalendarBundle {
	return {
		categoryTracker: { getCategories: () => categories },
		settingsStore: {
			currentSettings: { categoryAssignmentPresets: presets },
		},
	} as unknown as CalendarBundle;
}

function makeMockPlugin() {
	const mockBundle = { calendarId: "test-cal" };
	const mockCommand = { execute: vi.fn() };
	return {
		plugin: {
			apiManager: {
				buildCreateEventCommand: vi.fn(() => ({ command: mockCommand, bundle: mockBundle })),
				buildEditEventCommand: vi.fn(() => ({ command: mockCommand, bundle: mockBundle })),
				buildDeleteEventCommand: vi.fn(() => ({ command: mockCommand, bundle: mockBundle })),
			},
		} as any,
		mockCommand,
		mockBundle,
	};
}

function makeExecutionPlugin(batchExecution: boolean) {
	const executeCommand = vi.fn().mockResolvedValue(undefined);
	const mockBundle = {
		calendarId: "test-cal",
		commandManager: { executeCommand },
	};
	const mockCommand = { execute: vi.fn() };

	return {
		plugin: {
			settingsStore: {
				currentSettings: { ai: { aiBatchExecution: batchExecution } },
			},
			apiManager: {
				buildCreateEventCommand: vi.fn(() => ({ command: mockCommand, bundle: mockBundle })),
				buildEditEventCommand: vi.fn(() => ({ command: mockCommand, bundle: mockBundle })),
				buildDeleteEventCommand: vi.fn(() => ({ command: mockCommand, bundle: mockBundle })),
			},
		} as any,
		executeCommand,
		mockBundle,
		mockCommand,
	};
}

// ─── parseOperations ────────────────────────────────────────────────

describe("parseOperations", () => {
	describe("raw JSON input", () => {
		it("should parse a single create operation", () => {
			const result = parseOperations(toJson([VALID_CREATE]));
			expect(result).toHaveLength(1);
			expect(result![0].type).toBe("create");
		});

		it("should parse mixed operation types", () => {
			const result = parseOperations(toJson(MIXED_OPS));
			expect(result).toHaveLength(3);
			expect(result!.map((op) => op.type)).toEqual(["create", "edit", "delete"]);
		});

		it("should preserve all optional fields", () => {
			const result = parseOperations(toJson([VALID_CREATE_FULL]));
			expect(result).toHaveLength(1);
			const op = result![0] as AIOperation & { type: "create" };
			expect(op.categories).toEqual(["Fitness"]);
			expect(op.location).toBe("Gym");
			expect(op.participants).toEqual(["Alice", "Bob"]);
			expect(op.allDay).toBe(false);
		});

		it("should parse an empty array", () => {
			expect(parseOperations("[]")).toEqual([]);
		});

		it("should handle whitespace-padded JSON", () => {
			const result = parseOperations(`  \n  ${toJson([VALID_CREATE])}  \n  `);
			expect(result).toHaveLength(1);
		});
	});

	describe("markdown code block extraction", () => {
		it("should extract from ```json block", () => {
			const result = parseOperations(wrapInCodeBlock(toJson([VALID_CREATE]), "json"));
			expect(result).toHaveLength(1);
		});

		it("should extract from ``` block without language tag", () => {
			const result = parseOperations(wrapInCodeBlock(toJson([VALID_CREATE]), ""));
			expect(result).toHaveLength(1);
		});

		it("should extract from block surrounded by prose", () => {
			const result = parseOperations(wrapWithProse(toJson([VALID_CREATE])));
			expect(result).toHaveLength(1);
		});

		it("should use first code block when multiple exist", () => {
			const response =
				wrapInCodeBlock(toJson([VALID_CREATE]), "json") +
				"\n\nHere's another:\n\n" +
				wrapInCodeBlock(toJson([VALID_DELETE]), "json");
			const result = parseOperations(response);
			expect(result).toHaveLength(1);
			expect(result![0].type).toBe("create");
		});

		it("should handle code block with extra whitespace inside", () => {
			const response = "```json\n\n" + toJson([VALID_CREATE]) + "\n\n```";
			const result = parseOperations(response);
			expect(result).toHaveLength(1);
		});

		it("should handle code block with no newline after opening fence", () => {
			const response = "```json" + toJson([VALID_CREATE]) + "```";
			const result = parseOperations(response);
			expect(result).toHaveLength(1);
		});
	});

	describe("invalid inputs", () => {
		it.each([
			["plain text", "Here are your events for the week"],
			["partial JSON", '[{"type":"cre'],
			["markdown without code block", "- Event 1\n- Event 2"],
			["HTML", "<div>events</div>"],
			["empty string", ""],
			["only whitespace", "   \n\t  "],
			["number", "42"],
			["null", "null"],
			["boolean", "true"],
		])("should return null for %s", (_label, input) => {
			expect(parseOperations(input)).toBeNull();
		});

		it("should return null for an object instead of array", () => {
			expect(parseOperations(toJson(VALID_CREATE))).toBeNull();
		});

		it("should return null when one operation in array is invalid", () => {
			expect(parseOperations(toJson([VALID_CREATE, { type: "create" }]))).toBeNull();
		});

		it("should return null for create missing required fields", () => {
			expect(parseOperations(toJson([{ type: "create", title: "Event" }]))).toBeNull();
		});

		it("should return null for delete missing filePath", () => {
			expect(parseOperations(toJson([{ type: "delete" }]))).toBeNull();
		});

		it("should return null for unknown operation type", () => {
			expect(parseOperations(toJson([{ type: "archive", filePath: "e.md" }]))).toBeNull();
		});

		it("should return null for invalid datetime format in code block", () => {
			const bad = [{ type: "create", title: "Event", start: "2025-03-15", end: "2025-03-16" }];
			expect(parseOperations(wrapInCodeBlock(toJson(bad)))).toBeNull();
		});

		it("should return null for code block containing non-JSON", () => {
			expect(parseOperations(wrapInCodeBlock("not json at all"))).toBeNull();
		});

		it("should return null for nested array", () => {
			expect(parseOperations(toJson([[VALID_CREATE]]))).toBeNull();
		});

		it("should return null for array of strings", () => {
			expect(parseOperations(toJson(["create", "delete"]))).toBeNull();
		});

		it("should return null for array of nulls", () => {
			expect(parseOperations(toJson([null, null]))).toBeNull();
		});
	});

	describe("large/stress inputs", () => {
		it("should parse a large batch of operations", () => {
			const ops = Array.from({ length: 50 }, (_, i) => ({
				type: "create",
				title: `Event ${i}`,
				start: "2025-03-15T09:00:00",
				end: "2025-03-15T10:00:00",
			}));
			const result = parseOperations(toJson(ops));
			expect(result).toHaveLength(50);
		});

		it("should handle operations with long string values", () => {
			const longTitle = "A".repeat(500);
			const op = { ...VALID_CREATE, title: longTitle };
			const result = parseOperations(toJson([op]));
			expect(result).toHaveLength(1);
			expect((result![0] as AIOperation & { type: "create" }).title).toBe(longTitle);
		});

		it("should handle operations with many categories", () => {
			const op = { ...VALID_CREATE, categories: Array.from({ length: 100 }, (_, i) => `Category ${i}`) };
			const result = parseOperations(toJson([op]));
			expect(result).toHaveLength(1);
			expect((result![0] as AIOperation & { type: "create" }).categories).toHaveLength(100);
		});
	});
});

// ─── gatherCategoryContext ──────────────────────────────────────────

describe("gatherCategoryContext", () => {
	it("should return null when no categories and no presets", () => {
		expect(gatherCategoryContext(makeCategoryBundle([], []))).toBeNull();
	});

	it("should return null when no categories and undefined presets", () => {
		expect(gatherCategoryContext(makeCategoryBundle([]))).toBeNull();
	});

	it("should return categories when they exist", () => {
		const result = gatherCategoryContext(makeCategoryBundle(["Work", "Personal"]));
		expect(result).not.toBeNull();
		expect(result!.availableCategories).toEqual(["Work", "Personal"]);
		expect(result!.presets).toEqual([]);
	});

	it("should return presets when they exist", () => {
		const presets = [{ id: "1", name: "Default", categories: ["Work", "Fitness"] }];
		const result = gatherCategoryContext(makeCategoryBundle([], presets));
		expect(result).not.toBeNull();
		expect(result!.availableCategories).toEqual([]);
		expect(result!.presets).toEqual(presets);
	});

	it("should return both categories and presets", () => {
		const presets = [{ id: "1", name: "Preset A", categories: ["Fitness"] }];
		const result = gatherCategoryContext(makeCategoryBundle(["Work"], presets));
		expect(result!.availableCategories).toEqual(["Work"]);
		expect(result!.presets).toHaveLength(1);
	});

	it("should handle many categories", () => {
		const cats = Array.from({ length: 50 }, (_, i) => `Category ${i}`);
		const result = gatherCategoryContext(makeCategoryBundle(cats));
		expect(result!.availableCategories).toHaveLength(50);
	});

	it("should handle multiple presets", () => {
		const presets = [
			{ id: "1", name: "Morning", categories: ["Fitness"] },
			{ id: "2", name: "Work", categories: ["Work", "Meeting"] },
			{ id: "3", name: "Evening", categories: ["Personal"] },
		];
		const result = gatherCategoryContext(makeCategoryBundle([], presets));
		expect(result!.presets).toHaveLength(3);
	});
});

// ─── buildCommandForOperation ───────────────────────────────────────

describe("buildCommandForOperation", () => {
	it("should delegate create to buildCreateEventCommand", () => {
		const { plugin } = makeMockPlugin();
		buildCommandForOperation(plugin, VALID_CREATE);
		expect(plugin.apiManager.buildCreateEventCommand).toHaveBeenCalledTimes(1);
		expect(plugin.apiManager.buildEditEventCommand).not.toHaveBeenCalled();
		expect(plugin.apiManager.buildDeleteEventCommand).not.toHaveBeenCalled();
	});

	it("should delegate edit to buildEditEventCommand", () => {
		const { plugin } = makeMockPlugin();
		buildCommandForOperation(plugin, VALID_EDIT);
		expect(plugin.apiManager.buildEditEventCommand).toHaveBeenCalledTimes(1);
		expect(plugin.apiManager.buildCreateEventCommand).not.toHaveBeenCalled();
	});

	it("should delegate delete to buildDeleteEventCommand", () => {
		const { plugin } = makeMockPlugin();
		buildCommandForOperation(plugin, VALID_DELETE);
		expect(plugin.apiManager.buildDeleteEventCommand).toHaveBeenCalledTimes(1);
		expect(plugin.apiManager.buildCreateEventCommand).not.toHaveBeenCalled();
	});

	it("should pass all create fields including optionals", () => {
		const { plugin } = makeMockPlugin();
		buildCommandForOperation(plugin, VALID_CREATE_FULL);
		expect(plugin.apiManager.buildCreateEventCommand).toHaveBeenCalledWith({
			title: "Workout",
			start: "2025-03-15T06:00:00",
			end: "2025-03-15T07:00:00",
			allDay: false,
			categories: ["Fitness"],
			location: "Gym",
			participants: ["Alice", "Bob"],
		});
	});

	it("should pass undefined for missing optional create fields", () => {
		const { plugin } = makeMockPlugin();
		buildCommandForOperation(plugin, VALID_CREATE);
		expect(plugin.apiManager.buildCreateEventCommand).toHaveBeenCalledWith(
			expect.objectContaining({
				allDay: undefined,
				categories: undefined,
				location: undefined,
				participants: undefined,
			})
		);
	});

	it("should pass all edit fields including optionals", () => {
		const { plugin } = makeMockPlugin();
		buildCommandForOperation(plugin, VALID_EDIT_FULL);
		expect(plugin.apiManager.buildEditEventCommand).toHaveBeenCalledWith({
			filePath: "events/meeting.md",
			title: "Renamed Meeting",
			start: "2025-03-15T14:00:00",
			end: "2025-03-15T15:00:00",
			allDay: false,
			categories: ["Work"],
			location: "Room 42",
			participants: ["Charlie"],
		});
	});

	it("should pass only filePath for delete", () => {
		const { plugin } = makeMockPlugin();
		buildCommandForOperation(plugin, VALID_DELETE);
		expect(plugin.apiManager.buildDeleteEventCommand).toHaveBeenCalledWith({
			filePath: "events/old.md",
		});
	});

	it("should return null when create builder returns null", () => {
		const { plugin } = makeMockPlugin();
		plugin.apiManager.buildCreateEventCommand.mockReturnValue(null);
		expect(buildCommandForOperation(plugin, VALID_CREATE)).toBeNull();
	});

	it("should return null when edit builder returns null", () => {
		const { plugin } = makeMockPlugin();
		plugin.apiManager.buildEditEventCommand.mockReturnValue(null);
		expect(buildCommandForOperation(plugin, VALID_EDIT)).toBeNull();
	});

	it("should return null when delete builder returns null", () => {
		const { plugin } = makeMockPlugin();
		plugin.apiManager.buildDeleteEventCommand.mockReturnValue(null);
		expect(buildCommandForOperation(plugin, VALID_DELETE)).toBeNull();
	});

	it("should return command and bundle from the builder", () => {
		const { plugin, mockCommand, mockBundle } = makeMockPlugin();
		const result = buildCommandForOperation(plugin, VALID_CREATE);
		expect(result).toEqual({ command: mockCommand, bundle: mockBundle });
	});
});

// ─── executeOperations ──────────────────────────────────────────────

describe("executeOperations", () => {
	const TWO_CREATE_OPS: AIOperation[] = [
		{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
		{ type: "create", title: "Event B", start: "2025-03-15T10:00:00", end: "2025-03-15T11:00:00" },
	];

	describe("empty operations", () => {
		it("should return zeros for empty array in individual mode", async () => {
			const { plugin } = makeExecutionPlugin(false);
			expect(await executeOperations(plugin, [])).toEqual({ succeeded: 0, failed: 0, total: 0 });
		});

		it("should return zeros for empty array in batch mode", async () => {
			const { plugin } = makeExecutionPlugin(true);
			expect(await executeOperations(plugin, [])).toEqual({ succeeded: 0, failed: 0, total: 0 });
		});
	});

	describe("individual execution", () => {
		it("should execute each operation separately", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(false);
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 2, failed: 0, total: 2 });
			expect(executeCommand).toHaveBeenCalledTimes(2);
		});

		it("should count all as failed when build returns null", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(false);
			plugin.apiManager.buildCreateEventCommand.mockReturnValue(null);
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 0, failed: 2, total: 2 });
			expect(executeCommand).not.toHaveBeenCalled();
		});

		it("should count all as failed when execution throws", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(false);
			executeCommand.mockRejectedValue(new Error("Disk full"));
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 0, failed: 2, total: 2 });
		});

		it("should isolate failures — first succeeds, second fails", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(false);
			executeCommand.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Failed"));
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 1, failed: 1, total: 2 });
		});

		it("should isolate failures — first fails, second succeeds", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(false);
			executeCommand.mockRejectedValueOnce(new Error("Failed")).mockResolvedValueOnce(undefined);
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 1, failed: 1, total: 2 });
		});

		it("should handle mixed operation types", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(false);
			const result = await executeOperations(plugin, MIXED_OPS);
			expect(result).toEqual({ succeeded: 3, failed: 0, total: 3 });
			expect(executeCommand).toHaveBeenCalledTimes(3);
		});

		it("should handle single operation", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(false);
			const result = await executeOperations(plugin, [VALID_DELETE]);
			expect(result).toEqual({ succeeded: 1, failed: 0, total: 1 });
			expect(executeCommand).toHaveBeenCalledTimes(1);
		});

		it("should handle build failure mixed with execution failure", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(false);
			plugin.apiManager.buildCreateEventCommand
				.mockReturnValueOnce(null)
				.mockReturnValueOnce({ command: { execute: vi.fn() }, bundle: { commandManager: { executeCommand } } });
			executeCommand.mockRejectedValueOnce(new Error("Failed"));
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 0, failed: 2, total: 2 });
		});
	});

	describe("batch execution", () => {
		it("should execute all operations in a single MacroCommand", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(true);
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 2, failed: 0, total: 2 });
			expect(executeCommand).toHaveBeenCalledTimes(1);
		});

		it("should fail entire batch when MacroCommand throws", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(true);
			executeCommand.mockRejectedValue(new Error("Batch failed"));
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 0, failed: 2, total: 2 });
		});

		it("should track build failures separately from batch execution", async () => {
			const { plugin, executeCommand, mockBundle, mockCommand } = makeExecutionPlugin(true);
			plugin.apiManager.buildCreateEventCommand
				.mockReturnValueOnce({ command: mockCommand, bundle: mockBundle })
				.mockReturnValueOnce(null);
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 1, failed: 1, total: 2 });
			expect(executeCommand).toHaveBeenCalledTimes(1);
		});

		it("should fail all when all builds fail", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(true);
			plugin.apiManager.buildCreateEventCommand.mockReturnValue(null);
			const result = await executeOperations(plugin, TWO_CREATE_OPS);
			expect(result).toEqual({ succeeded: 0, failed: 2, total: 2 });
			expect(executeCommand).not.toHaveBeenCalled();
		});

		it("should handle mixed operation types in batch", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(true);
			const result = await executeOperations(plugin, MIXED_OPS);
			expect(result).toEqual({ succeeded: 3, failed: 0, total: 3 });
			expect(executeCommand).toHaveBeenCalledTimes(1);
		});

		it("should handle single operation in batch", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(true);
			const result = await executeOperations(plugin, [VALID_CREATE]);
			expect(result).toEqual({ succeeded: 1, failed: 0, total: 1 });
			expect(executeCommand).toHaveBeenCalledTimes(1);
		});

		it("should handle large batch", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(true);
			const ops: AIOperation[] = Array.from({ length: 20 }, (_, i) => ({
				type: "create" as const,
				title: `Event ${i}`,
				start: "2025-03-15T09:00:00",
				end: "2025-03-15T10:00:00",
			}));
			const result = await executeOperations(plugin, ops);
			expect(result).toEqual({ succeeded: 20, failed: 0, total: 20 });
			expect(executeCommand).toHaveBeenCalledTimes(1);
		});
	});

	describe("invariants", () => {
		it("should always have succeeded + failed === total", async () => {
			const { plugin, executeCommand } = makeExecutionPlugin(false);
			executeCommand
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error("Fail"))
				.mockResolvedValueOnce(undefined);
			const ops: AIOperation[] = [
				{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
				{ type: "create", title: "Event B", start: "2025-03-15T10:00:00", end: "2025-03-15T11:00:00" },
				{ type: "create", title: "Event C", start: "2025-03-15T11:00:00", end: "2025-03-15T12:00:00" },
			];
			const result = await executeOperations(plugin, ops);
			expect(result.succeeded + result.failed).toBe(result.total);
			expect(result.total).toBe(3);
		});

		it("should always have succeeded + failed === total in batch mode", async () => {
			const { plugin, mockBundle, mockCommand } = makeExecutionPlugin(true);
			plugin.apiManager.buildCreateEventCommand
				.mockReturnValueOnce({ command: mockCommand, bundle: mockBundle })
				.mockReturnValueOnce(null)
				.mockReturnValueOnce({ command: mockCommand, bundle: mockBundle });
			const ops: AIOperation[] = [
				{ type: "create", title: "Event A", start: "2025-03-15T09:00:00", end: "2025-03-15T10:00:00" },
				{ type: "create", title: "Event B", start: "2025-03-15T10:00:00", end: "2025-03-15T11:00:00" },
				{ type: "create", title: "Event C", start: "2025-03-15T11:00:00", end: "2025-03-15T12:00:00" },
			];
			const result = await executeOperations(plugin, ops);
			expect(result.succeeded + result.failed).toBe(result.total);
		});
	});
});
