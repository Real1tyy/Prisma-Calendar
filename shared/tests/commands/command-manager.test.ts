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

		it("accepts an options object with maxHistorySize", async () => {
			const manager = new CommandManager({ maxHistorySize: 3, showNotices: true });

			for (let i = 0; i < 5; i++) {
				await manager.registerExecutedCommand(createMockCommand());
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
			const manager = new CommandManager({ maxHistorySize: 2 });

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
		it("adds to undo stack without calling execute", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand();

			await manager.registerExecutedCommand(cmd);

			expect(cmd.executeCalls).toBe(0);
			expect(manager.getUndoStackSize()).toBe(1);
		});

		it("clears redo stack", async () => {
			const manager = new CommandManager();
			await manager.executeCommand(createMockCommand());
			await manager.undo();
			expect(manager.canRedo()).toBe(true);

			await manager.registerExecutedCommand(createMockCommand());
			expect(manager.canRedo()).toBe(false);
		});

		it("trims undo stack when exceeding maxHistorySize", async () => {
			const manager = new CommandManager({ maxHistorySize: 2 });

			await manager.registerExecutedCommand(createMockCommand("A"));
			await manager.registerExecutedCommand(createMockCommand("B"));
			await manager.registerExecutedCommand(createMockCommand("C"));

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

			await manager.clearHistory();

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

	describe("serialization (concurrent undo/redo/execute)", () => {
		// Palette callbacks in Prisma-Calendar register as `void undo(plugin)`
		// — Obsidian ignores the return value, so two quick Ctrl+Z presses
		// both call CommandManager.undo() before the first settles. Pre-
		// serialization those two calls read the same `current()` and re-
		// entered MacroCommand.undoExecuted against the same `executedCommands`
		// array; the first call's reset wiped the slot the second was
		// iterating, surfacing as `command.getType()` on undefined. These
		// tests pin the serialized behaviour.

		// Allow queued microtasks to run between coordination steps.
		const tick = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));

		function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
			let resolve!: (v: T) => void;
			const promise = new Promise<T>((r) => {
				resolve = r;
			});
			return { promise, resolve };
		}

		it("serializes concurrent undo() calls into sequential execution", async () => {
			const manager = new CommandManager();
			const order: string[] = [];
			const gateA = deferred<void>();
			const gateB = deferred<void>();
			let startedA = false;
			let startedB = false;

			const mkCmd = (label: string, gate: Promise<void>, onStart: () => void): Command => ({
				async execute() {
					order.push(`exec-${label}`);
				},
				async undo() {
					order.push(`undo-start-${label}`);
					onStart();
					await gate;
					order.push(`undo-end-${label}`);
				},
				getType: () => label,
			});

			await manager.executeCommand(
				mkCmd("A", gateA.promise, () => {
					startedA = true;
				})
			);
			await manager.executeCommand(
				mkCmd("B", gateB.promise, () => {
					startedB = true;
				})
			);

			// Fire both undos before awaiting either — the second must not
			// observe history or executedCommands state from inside the first.
			const undoB = manager.undo();
			const undoA = manager.undo();

			await tick();
			expect(startedB).toBe(true);
			expect(startedA).toBe(false);

			gateB.resolve();
			await undoB;
			await tick();
			expect(startedA).toBe(true);
			expect(order).toEqual(["exec-A", "exec-B", "undo-start-B", "undo-end-B", "undo-start-A"]);

			gateA.resolve();
			await undoA;

			expect(order).toEqual(["exec-A", "exec-B", "undo-start-B", "undo-end-B", "undo-start-A", "undo-end-A"]);
			expect(manager.getUndoStackSize()).toBe(0);
			expect(manager.getRedoStackSize()).toBe(2);
		});

		it("whenIdle() resolves only after every queued op has settled", async () => {
			const manager = new CommandManager();
			const gate1 = deferred<void>();
			const gate2 = deferred<void>();
			const mkSlowCmd = (gate: Promise<void>): Command => ({
				async execute() {
					await gate;
				},
				async undo() {},
				getType: () => "Slow",
			});

			const exec1 = manager.executeCommand(mkSlowCmd(gate1.promise));
			const exec2 = manager.executeCommand(mkSlowCmd(gate2.promise));

			let idleResolved = false;
			const idle = manager.whenIdle().then(() => {
				idleResolved = true;
			});

			await tick();
			expect(idleResolved).toBe(false);

			gate1.resolve();
			await exec1;
			await tick();
			expect(idleResolved).toBe(false);

			gate2.resolve();
			await exec2;
			await idle;
			expect(idleResolved).toBe(true);
		});

		it("whenIdle() also drains work scheduled while it is awaiting", async () => {
			const manager = new CommandManager();
			const gate1 = deferred<void>();
			const gate2 = deferred<void>();

			const mkCmd = (gate: Promise<void>): Command => ({
				async execute() {
					await gate;
				},
				async undo() {},
				getType: () => "Mk",
			});

			const exec1 = manager.executeCommand(mkCmd(gate1.promise));
			let idleResolved = false;
			const idle = manager.whenIdle().then(() => {
				idleResolved = true;
			});

			// Schedule another op AFTER whenIdle() is mid-await — it must still
			// be observed before idle resolves.
			const exec2 = manager.executeCommand(mkCmd(gate2.promise));

			gate1.resolve();
			await exec1;
			await tick();
			expect(idleResolved).toBe(false);

			gate2.resolve();
			await exec2;
			await idle;
			expect(idleResolved).toBe(true);
		});

		it("a failing op does not stall subsequent operations", async () => {
			const manager = new CommandManager();
			const failing: Command = {
				async execute() {
					throw new Error("boom");
				},
				async undo() {},
				getType: () => "Failing",
			};
			const ok = createMockCommand("OK");

			const failing1 = manager.executeCommand(failing).catch((e) => e);
			const ok1 = manager.executeCommand(ok);

			const err = await failing1;
			expect((err as Error).message).toBe("boom");

			await ok1;
			expect(ok.executeCalls).toBe(1);
			expect(manager.getUndoStackSize()).toBe(1);
		});

		it("concurrent undo + redo arriving back-to-back execute serially in queue order", async () => {
			const manager = new CommandManager();
			const cmd = createMockCommand("Roundtrip");

			await manager.executeCommand(cmd);

			const undoP = manager.undo();
			const redoP = manager.redo();

			await Promise.all([undoP, redoP]);

			expect(cmd.undoCalls).toBe(1);
			expect(cmd.executeCalls).toBe(2);
			expect(manager.getUndoStackSize()).toBe(1);
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
});
