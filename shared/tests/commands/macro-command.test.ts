import type { Command } from "../../src/core/commands/command";
import { MacroCommand } from "../../src/core/commands/macro-command";
import { silenceConsole } from "../../src/testing/silence-console";

function createMockCommand(
	type = "MockCommand",
	options?: { failExecute?: boolean; failUndo?: boolean; canUndo?: boolean }
): Command & { executeCalls: number; undoCalls: number } {
	const cmd = {
		executeCalls: 0,
		undoCalls: 0,
		async execute() {
			if (options?.failExecute) throw new Error(`${type} execute failed`);
			cmd.executeCalls++;
		},
		async undo() {
			if (options?.failUndo) throw new Error(`${type} undo failed`);
			cmd.undoCalls++;
		},
		getType() {
			return type;
		},
		...(options?.canUndo !== undefined ? { canUndo: () => options.canUndo } : {}),
	};
	return cmd;
}

describe("MacroCommand", () => {
	silenceConsole();

	describe("constructor and basic properties", () => {
		it("creates an empty macro", () => {
			const macro = new MacroCommand();

			expect(macro.isEmpty()).toBe(true);
			expect(macro.getCommandCount()).toBe(0);
			expect(macro.getType()).toBe("MacroCommand");
		});

		it("creates a macro with initial commands", () => {
			const cmds = [createMockCommand("A"), createMockCommand("B")];
			const macro = new MacroCommand(cmds);

			expect(macro.getCommandCount()).toBe(2);
			expect(macro.isEmpty()).toBe(false);
		});

		it("defensive-copies the initial commands array", () => {
			const cmds = [createMockCommand("A")];
			const macro = new MacroCommand(cmds);

			cmds.push(createMockCommand("B"));

			expect(macro.getCommandCount()).toBe(1);
		});
	});

	describe("addCommand", () => {
		it("appends a command to the macro", () => {
			const macro = new MacroCommand();
			macro.addCommand(createMockCommand("A"));
			macro.addCommand(createMockCommand("B"));

			expect(macro.getCommandCount()).toBe(2);
		});
	});

	describe("getCommands", () => {
		it("returns a copy of the commands array", () => {
			const cmd = createMockCommand("A");
			const macro = new MacroCommand([cmd]);

			const commands = macro.getCommands();

			expect(commands).toHaveLength(1);
			expect(commands[0].getType()).toBe("A");
		});
	});

	describe("fromExecuted", () => {
		it("creates a macro with pre-executed commands that can be undone", async () => {
			const cmds = [createMockCommand("A"), createMockCommand("B")];
			const macro = MacroCommand.fromExecuted(cmds);

			expect(macro.getCommandCount()).toBe(2);
			expect(await macro.canUndo()).toBe(true);
		});
	});

	describe("execute", () => {
		it("does nothing for an empty macro", async () => {
			const macro = new MacroCommand();
			await expect(macro.execute()).resolves.toBeUndefined();
		});

		it("executes all commands sequentially", async () => {
			const order: string[] = [];
			const cmdA: Command = {
				async execute() {
					order.push("A");
				},
				async undo() {},
				getType: () => "A",
			};
			const cmdB: Command = {
				async execute() {
					order.push("B");
				},
				async undo() {},
				getType: () => "B",
			};

			const macro = new MacroCommand([cmdA, cmdB]);
			await macro.execute();

			expect(order).toEqual(["A", "B"]);
		});

		it("tracks execution summary on full success", async () => {
			const cmds = [createMockCommand("A"), createMockCommand("B")];
			const macro = new MacroCommand(cmds);

			await macro.execute();

			const summary = macro.getExecutionSummary();
			expect(summary.successCount).toBe(2);
			expect(summary.failCount).toBe(0);
			expect(summary.errors).toHaveLength(0);
		});

		it("continues past failures and throws a partial-failure error", async () => {
			const cmdA = createMockCommand("A");
			const cmdB = createMockCommand("B", { failExecute: true });
			const cmdC = createMockCommand("C");
			const macro = new MacroCommand([cmdA, cmdB, cmdC]);

			await expect(macro.execute()).rejects.toThrow("Completed 2/3 operations. 1 failed");

			const summary = macro.getExecutionSummary();
			expect(summary.successCount).toBe(2);
			expect(summary.failCount).toBe(1);
			expect(cmdA.executeCalls).toBe(1);
			expect(cmdC.executeCalls).toBe(1);
		});

		it("throws when all commands fail", async () => {
			const cmds = [createMockCommand("A", { failExecute: true }), createMockCommand("B", { failExecute: true })];
			const macro = new MacroCommand(cmds);

			await expect(macro.execute()).rejects.toThrow("All 2 operations failed");
		});

		it("rolls back executed commands when rollbackOnError is true", async () => {
			const cmdA = createMockCommand("A");
			const cmdB = createMockCommand("B", { failExecute: true });
			const macro = new MacroCommand([cmdA, cmdB], { rollbackOnError: true });

			await expect(macro.execute()).rejects.toThrow("B execute failed");

			expect(cmdA.executeCalls).toBe(1);
			expect(cmdA.undoCalls).toBe(1);
		});
	});

	describe("undo", () => {
		it("undoes executed commands in reverse order", async () => {
			const order: string[] = [];
			const cmdA: Command = {
				async execute() {},
				async undo() {
					order.push("A");
				},
				getType: () => "A",
			};
			const cmdB: Command = {
				async execute() {},
				async undo() {
					order.push("B");
				},
				getType: () => "B",
			};

			const macro = new MacroCommand([cmdA, cmdB]);
			await macro.execute();
			await macro.undo();

			expect(order).toEqual(["B", "A"]);
		});

		it("handles undo errors gracefully and continues", async () => {
			const cmdA = createMockCommand("A");
			const cmdB = createMockCommand("B", { failUndo: true });
			const macro = new MacroCommand([cmdA, cmdB]);

			await macro.execute();
			await macro.undo();

			expect(cmdA.undoCalls).toBe(1);
		});

		it("does nothing when no commands have been executed", async () => {
			const macro = new MacroCommand([createMockCommand("A")]);
			await expect(macro.undo()).resolves.toBeUndefined();
		});
	});

	describe("canUndo", () => {
		it("returns false when no commands have been executed", async () => {
			const macro = new MacroCommand();
			expect(await macro.canUndo()).toBe(false);
		});

		it("returns true when all executed commands are undoable", async () => {
			const cmds = [createMockCommand("A"), createMockCommand("B")];
			const macro = new MacroCommand(cmds);

			await macro.execute();

			expect(await macro.canUndo()).toBe(true);
		});

		it("returns false when any executed command reports canUndo as false", async () => {
			const cmdA = createMockCommand("A");
			const cmdB = createMockCommand("B", { canUndo: false });
			const macro = new MacroCommand([cmdA, cmdB]);

			await macro.execute();

			expect(await macro.canUndo()).toBe(false);
		});
	});

	describe("executeWithProgress", () => {
		it("calls progress callback for each command", async () => {
			const cmds = [createMockCommand("A"), createMockCommand("B"), createMockCommand("C")];
			const macro = new MacroCommand(cmds);
			const progressCalls: Array<[number, number]> = [];

			await macro.executeWithProgress((completed, total) => {
				progressCalls.push([completed, total]);
			});

			expect(progressCalls).toEqual([
				[1, 3],
				[2, 3],
				[3, 3],
			]);
		});

		it("reports progress even for failed commands", async () => {
			const cmds = [createMockCommand("A"), createMockCommand("B", { failExecute: true })];
			const macro = new MacroCommand(cmds);
			const progressCalls: Array<[number, number]> = [];

			await macro.executeWithProgress((completed, total) => {
				progressCalls.push([completed, total]);
			});

			expect(progressCalls).toEqual([
				[1, 2],
				[2, 2],
			]);
		});

		it("rolls back on error when rollbackOnError is true", async () => {
			const cmdA = createMockCommand("A");
			const cmdB = createMockCommand("B", { failExecute: true });
			const macro = new MacroCommand([cmdA, cmdB], { rollbackOnError: true });

			await expect(macro.executeWithProgress(() => {})).rejects.toThrow("B execute failed");

			expect(cmdA.undoCalls).toBe(1);
		});
	});

	describe("undoWithProgress", () => {
		it("calls progress callback for each undone command", async () => {
			const cmds = [createMockCommand("A"), createMockCommand("B")];
			const macro = new MacroCommand(cmds);
			await macro.execute();

			const progressCalls: Array<[number, number]> = [];
			await macro.undoWithProgress((completed, total) => {
				progressCalls.push([completed, total]);
			});

			expect(progressCalls).toEqual([
				[1, 2],
				[2, 2],
			]);
		});
	});

	describe("getExecutionSummary", () => {
		it("returns zero counts before execution", () => {
			const macro = new MacroCommand([createMockCommand("A")]);
			const summary = macro.getExecutionSummary();

			expect(summary.successCount).toBe(0);
			expect(summary.failCount).toBe(0);
			expect(summary.errors).toHaveLength(0);
		});
	});
});
