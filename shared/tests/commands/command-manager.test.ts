import type { Command } from "../../src/core/commands/command";
import { CommandManager } from "../../src/core/commands/command-manager";
import { silenceConsole } from "../../src/testing/silence-console";

function createMockCommand(type = "MockCommand"): Command & { executeCalls: number; undoCalls: number } {
	const cmd = {
		executeCalls: 0,
		undoCalls: 0,
		async execute() {
			cmd.executeCalls++;
		},
		async undo() {
			cmd.undoCalls++;
		},
		getType() {
			return type;
		},
	};
	return cmd;
}

function createFailingCommand(type = "FailingCommand"): Command {
	return {
		async execute() {
			throw new Error("Execute failed");
		},
		async undo() {
			throw new Error("Undo failed");
		},
		getType() {
			return type;
		},
	};
}

describe("CommandManager", () => {
	silenceConsole();

	describe("constructor", () => {
		it("uses default maxHistorySize of 50", () => {
			const manager = new CommandManager();
			expect(manager.getUndoStackSize()).toBe(0);
			expect(manager.getRedoStackSize()).toBe(0);
		});

		it("accepts a numeric maxHistorySize", () => {
			const manager = new CommandManager(5);

			for (let i = 0; i < 7; i++) {
				manager.registerExecutedCommand(createMockCommand());
			}

			expect(manager.getUndoStackSize()).toBe(5);
		});

		it("accepts an options object", () => {
			const manager = new CommandManager({ maxHistorySize: 3, showNotices: true });

			for (let i = 0; i < 5; i++) {
				manager.registerExecutedCommand(createMockCommand());
			}

			expect(manager.getUndoStackSize()).toBe(3);
		});
	});

	describe("executeCommand", () => {
		it("executes the command and adds it to the undo stack", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand();

			await manager.executeCommand(cmd);

			expect(cmd.executeCalls).toBe(1);
			expect(manager.getUndoStackSize()).toBe(1);
		});

		it("clears the redo stack on new execution", async () => {
			const manager = new CommandManager();
			const cmd1 = createMockCommand("First");
			const cmd2 = createMockCommand("Second");

			await manager.executeCommand(cmd1);
			await manager.undo();
			expect(manager.canRedo()).toBe(true);

			await manager.executeCommand(cmd2);
			expect(manager.canRedo()).toBe(false);
		});

		it("trims undo stack when exceeding maxHistorySize", async () => {
			const manager = new CommandManager(2);

			await manager.executeCommand(createMockCommand("A"));
			await manager.executeCommand(createMockCommand("B"));
			await manager.executeCommand(createMockCommand("C"));

			expect(manager.getUndoStackSize()).toBe(2);
			expect(manager.peekUndo()).toBe("C");
		});

		it("rethrows errors from command execution", async () => {
			const manager = new CommandManager();
			const cmd = createFailingCommand();

			await expect(manager.executeCommand(cmd)).rejects.toThrow("Execute failed");
			expect(manager.getUndoStackSize()).toBe(0);
		});
	});

	describe("registerExecutedCommand", () => {
		it("adds to undo stack without calling execute", () => {
			const manager = new CommandManager();
			const cmd = createMockCommand();

			manager.registerExecutedCommand(cmd);

			expect(cmd.executeCalls).toBe(0);
			expect(manager.getUndoStackSize()).toBe(1);
		});

		it("clears redo stack", async () => {
			const manager = new CommandManager();
			await manager.executeCommand(createMockCommand());
			await manager.undo();
			expect(manager.canRedo()).toBe(true);

			manager.registerExecutedCommand(createMockCommand());
			expect(manager.canRedo()).toBe(false);
		});

		it("trims undo stack when exceeding maxHistorySize", () => {
			const manager = new CommandManager(2);

			manager.registerExecutedCommand(createMockCommand("A"));
			manager.registerExecutedCommand(createMockCommand("B"));
			manager.registerExecutedCommand(createMockCommand("C"));

			expect(manager.getUndoStackSize()).toBe(2);
		});
	});

	describe("undo", () => {
		it("returns false on empty undo stack", async () => {
			const manager = new CommandManager();
			const result = await manager.undo();
			expect(result).toBe(false);
		});

		it("undoes the last command and moves it to redo stack", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand();

			await manager.executeCommand(cmd);
			const result = await manager.undo();

			expect(result).toBe(true);
			expect(cmd.undoCalls).toBe(1);
			expect(manager.getUndoStackSize()).toBe(0);
			expect(manager.getRedoStackSize()).toBe(1);
		});

		it("discards command when canUndo returns false", async () => {
			const manager = new CommandManager();
			const cmd: Command = {
				async execute() {},
				async undo() {},
				getType: () => "Guarded",
				canUndo: () => false,
			};

			await manager.executeCommand(cmd);
			const result = await manager.undo();

			expect(result).toBe(false);
			expect(manager.getUndoStackSize()).toBe(0);
			expect(manager.getRedoStackSize()).toBe(0);
		});

		it("discards command when undo throws", async () => {
			const manager = new CommandManager();
			const cmd: Command = {
				async execute() {},
				async undo() {
					throw new Error("Undo failed");
				},
				getType: () => "FailUndo",
			};

			await manager.executeCommand(cmd);
			const result = await manager.undo();

			expect(result).toBe(false);
			expect(manager.getUndoStackSize()).toBe(0);
			expect(manager.getRedoStackSize()).toBe(0);
		});

		it("shows notices when showNotices is enabled", async () => {
			const manager = new CommandManager({ showNotices: true });
			await manager.undo();
		});
	});

	describe("redo", () => {
		it("returns false on empty redo stack", async () => {
			const manager = new CommandManager();
			const result = await manager.redo();
			expect(result).toBe(false);
		});

		it("re-executes the command and moves it back to undo stack", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand();

			await manager.executeCommand(cmd);
			await manager.undo();
			const result = await manager.redo();

			expect(result).toBe(true);
			expect(cmd.executeCalls).toBe(2);
			expect(manager.getUndoStackSize()).toBe(1);
			expect(manager.getRedoStackSize()).toBe(0);
		});

		it("discards command when redo throws", async () => {
			const manager = new CommandManager();
			const cmd: Command = {
				executeCalled: false,
				async execute() {
					if ((this as { executeCalled: boolean }).executeCalled) throw new Error("Redo failed");
					(this as { executeCalled: boolean }).executeCalled = true;
				},
				async undo() {},
				getType: () => "FailRedo",
			} as Command & { executeCalled: boolean };

			await manager.executeCommand(cmd);
			await manager.undo();
			const result = await manager.redo();

			expect(result).toBe(false);
			expect(manager.getRedoStackSize()).toBe(0);
			expect(manager.getUndoStackSize()).toBe(0);
		});

		it("shows notices when showNotices is enabled", async () => {
			const manager = new CommandManager({ showNotices: true });
			await manager.redo();
		});
	});

	describe("canUndo / canRedo", () => {
		it("returns false when stacks are empty", () => {
			const manager = new CommandManager();
			expect(manager.canUndo()).toBe(false);
			expect(manager.canRedo()).toBe(false);
		});

		it("reflects stack state correctly", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand();

			await manager.executeCommand(cmd);
			expect(manager.canUndo()).toBe(true);
			expect(manager.canRedo()).toBe(false);

			await manager.undo();
			expect(manager.canUndo()).toBe(false);
			expect(manager.canRedo()).toBe(true);
		});
	});

	describe("clearHistory", () => {
		it("clears both stacks", async () => {
			const manager = new CommandManager();

			await manager.executeCommand(createMockCommand());
			await manager.executeCommand(createMockCommand());
			await manager.undo();

			manager.clearHistory();

			expect(manager.getUndoStackSize()).toBe(0);
			expect(manager.getRedoStackSize()).toBe(0);
		});
	});

	describe("peekUndo / peekRedo", () => {
		it("returns null when stacks are empty", () => {
			const manager = new CommandManager();
			expect(manager.peekUndo()).toBeNull();
			expect(manager.peekRedo()).toBeNull();
		});

		it("returns the type of the top command", async () => {
			const manager = new CommandManager();

			await manager.executeCommand(createMockCommand("CreateTask"));
			expect(manager.peekUndo()).toBe("CreateTask");

			await manager.undo();
			expect(manager.peekRedo()).toBe("CreateTask");
		});
	});

	describe("setMaxHistorySize", () => {
		it("trims the undo stack to the new size", async () => {
			const manager = new CommandManager(10);

			for (let i = 0; i < 8; i++) {
				await manager.executeCommand(createMockCommand(`Cmd${i}`));
			}

			manager.setMaxHistorySize(3);
			expect(manager.getUndoStackSize()).toBe(3);
		});
	});

	describe("popUndoCommand / popRedoCommand", () => {
		it("pops from the undo stack", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand("PopMe");

			await manager.executeCommand(cmd);
			const popped = manager.popUndoCommand();

			expect(popped?.getType()).toBe("PopMe");
			expect(manager.getUndoStackSize()).toBe(0);
		});

		it("pops from the redo stack", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand("RedoPop");

			await manager.executeCommand(cmd);
			await manager.undo();
			const popped = manager.popRedoCommand();

			expect(popped?.getType()).toBe("RedoPop");
			expect(manager.getRedoStackSize()).toBe(0);
		});

		it("returns undefined from empty stacks", () => {
			const manager = new CommandManager();
			expect(manager.popUndoCommand()).toBeUndefined();
			expect(manager.popRedoCommand()).toBeUndefined();
		});
	});

	describe("pushToUndoStack / pushToRedoStack", () => {
		it("pushes directly to undo stack with size trimming", () => {
			const manager = new CommandManager(2);

			manager.pushToUndoStack(createMockCommand("A"));
			manager.pushToUndoStack(createMockCommand("B"));
			manager.pushToUndoStack(createMockCommand("C"));

			expect(manager.getUndoStackSize()).toBe(2);
			expect(manager.peekUndo()).toBe("C");
		});

		it("pushes directly to redo stack", () => {
			const manager = new CommandManager();
			manager.pushToRedoStack(createMockCommand("A"));
			expect(manager.getRedoStackSize()).toBe(1);
		});
	});

	describe("stateful undo/redo sequences", () => {
		it("should maintain correct state through A→B→C, undo×2, redo, undo×3, redo×3", async () => {
			const manager = new CommandManager();
			const state = { value: 0 };
			const mkCmd = (from: number, to: number) => ({
				async execute() {
					state.value = to;
				},
				async undo() {
					state.value = from;
				},
				getType: () => `${from}→${to}`,
			});

			await manager.executeCommand(mkCmd(0, 1));
			await manager.executeCommand(mkCmd(1, 2));
			await manager.executeCommand(mkCmd(2, 3));
			expect(state.value).toBe(3);

			await manager.undo();
			await manager.undo();
			expect(state.value).toBe(1);

			await manager.redo();
			expect(state.value).toBe(2);

			await manager.undo();
			expect(state.value).toBe(1);
			await manager.undo();
			expect(state.value).toBe(0);
			expect(manager.canUndo()).toBe(false);

			await manager.redo();
			expect(state.value).toBe(1);
			await manager.redo();
			expect(state.value).toBe(2);
			await manager.redo();
			expect(state.value).toBe(3);
			expect(manager.canRedo()).toBe(false);
		});

		it("should handle rapid undo/redo cycles without losing commands", async () => {
			const manager = new CommandManager();
			const state = { value: 0 };
			const mkCmd = (from: number, to: number) => ({
				async execute() {
					state.value = to;
				},
				async undo() {
					state.value = from;
				},
				getType: () => `${from}→${to}`,
			});

			await manager.executeCommand(mkCmd(0, 1));

			for (let i = 0; i < 20; i++) {
				await manager.undo();
				expect(state.value).toBe(0);
				expect(manager.getUndoStackSize()).toBe(0);
				expect(manager.getRedoStackSize()).toBe(1);

				await manager.redo();
				expect(state.value).toBe(1);
				expect(manager.getUndoStackSize()).toBe(1);
				expect(manager.getRedoStackSize()).toBe(0);
			}
		});

		it("should discard failed command and keep earlier commands accessible", async () => {
			const manager = new CommandManager();

			const cmdA: Command = {
				async execute() {},
				async undo() {},
				getType: () => "A",
			};
			const cmdB: Command = {
				async execute() {},
				async undo() {},
				getType: () => "B",
				canUndo: () => false,
			};
			const cmdC: Command = {
				async execute() {},
				async undo() {},
				getType: () => "C",
			};

			await manager.executeCommand(cmdA);
			await manager.executeCommand(cmdB);
			await manager.executeCommand(cmdC);

			await manager.undo();
			expect(manager.peekUndo()).toBe("B");

			const result = await manager.undo();
			expect(result).toBe(false);
			expect(manager.getUndoStackSize()).toBe(1);
			expect(manager.peekUndo()).toBe("A");

			await manager.undo();
			expect(manager.getUndoStackSize()).toBe(0);
		});

		it("should handle new command after partial undo clearing redo correctly", async () => {
			const manager = new CommandManager();
			const state = { value: 0 };
			const mkCmd = (from: number, to: number) => ({
				async execute() {
					state.value = to;
				},
				async undo() {
					state.value = from;
				},
				getType: () => `${from}→${to}`,
			});

			await manager.executeCommand(mkCmd(0, 1));
			await manager.executeCommand(mkCmd(1, 2));
			await manager.executeCommand(mkCmd(2, 3));

			await manager.undo();
			await manager.undo();
			expect(state.value).toBe(1);

			await manager.executeCommand(mkCmd(1, 99));
			expect(state.value).toBe(99);
			expect(manager.canRedo()).toBe(false);
			expect(manager.getUndoStackSize()).toBe(2);

			await manager.undo();
			expect(state.value).toBe(1);
			await manager.undo();
			expect(state.value).toBe(0);
			expect(manager.canUndo()).toBe(false);
		});
	});

	describe("removeFromUndoStack / removeFromRedoStack", () => {
		it("removes a specific command from the undo stack", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand("Target");

			await manager.executeCommand(cmd);
			const removed = manager.removeFromUndoStack(cmd);

			expect(removed).toBe(true);
			expect(manager.getUndoStackSize()).toBe(0);
		});

		it("returns false if command is not in the undo stack", () => {
			const manager = new CommandManager();
			const cmd = createMockCommand();

			expect(manager.removeFromUndoStack(cmd)).toBe(false);
		});

		it("removes a specific command from the redo stack", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand("Target");

			await manager.executeCommand(cmd);
			await manager.undo();
			const removed = manager.removeFromRedoStack(cmd);

			expect(removed).toBe(true);
			expect(manager.getRedoStackSize()).toBe(0);
		});

		it("returns false if command is not in the redo stack", () => {
			const manager = new CommandManager();
			const cmd = createMockCommand();

			expect(manager.removeFromRedoStack(cmd)).toBe(false);
		});
	});
});
