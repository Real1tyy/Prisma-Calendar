import type { Command } from "../../src/core/commands/command";

class TestCommand implements Command {
	executed = false;
	undone = false;
	private type: string;
	private undoable: boolean;

	constructor(type = "TestCommand", undoable = true) {
		this.type = type;
		this.undoable = undoable;
	}

	async execute(): Promise<void> {
		this.executed = true;
	}

	async undo(): Promise<void> {
		this.undone = true;
	}

	getType(): string {
		return this.type;
	}

	canUndo(): boolean {
		return this.undoable;
	}
}

class FailingCommand implements Command {
	async execute(): Promise<void> {
		throw new Error("Execute failed");
	}

	async undo(): Promise<void> {
		throw new Error("Undo failed");
	}

	getType(): string {
		return "FailingCommand";
	}
}

describe("Command interface", () => {
	it("executes successfully", async () => {
		const command = new TestCommand();

		await command.execute();

		expect(command.executed).toBe(true);
	});

	it("undoes successfully", async () => {
		const command = new TestCommand();

		await command.undo();

		expect(command.undone).toBe(true);
	});

	it("returns its type", () => {
		const command = new TestCommand("CreateTask");
		expect(command.getType()).toBe("CreateTask");
	});

	it("reports undoable state via canUndo", () => {
		const undoable = new TestCommand("A", true);
		const notUndoable = new TestCommand("B", false);

		expect(undoable.canUndo()).toBe(true);
		expect(notUndoable.canUndo()).toBe(false);
	});

	it("works without canUndo (optional method)", async () => {
		const command: Command = {
			async execute() {},
			async undo() {},
			getType() {
				return "Minimal";
			},
		};

		expect(command.canUndo).toBeUndefined();
		await expect(command.execute()).resolves.toBeUndefined();
	});

	it("propagates errors from execute", async () => {
		const command = new FailingCommand();
		await expect(command.execute()).rejects.toThrow("Execute failed");
	});

	it("propagates errors from undo", async () => {
		const command = new FailingCommand();
		await expect(command.undo()).rejects.toThrow("Undo failed");
	});
});
