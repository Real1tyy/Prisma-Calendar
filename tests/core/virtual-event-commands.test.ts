import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	ConvertToRealCommand,
	ConvertToVirtualCommand,
	CreateVirtualEventCommand,
	DeleteVirtualEventCommand,
} from "../../src/core/commands/virtual-event-commands";
import { VirtualEventStore } from "../../src/core/virtual-event-store";
import { createVirtualEventData } from "../fixtures";
import { createMockFile } from "../mocks/obsidian";
import { createMockSingleCalendarSettingsStore } from "../setup";

// ─── Helpers ─────────────────────────────────────────────────

function createMockVaultForCommands() {
	const fileContents = new Map<string, string>();

	const vault = {
		getAbstractFileByPath: vi.fn(),
		on: vi.fn().mockReturnValue({ id: "mock-ref" }),
		offref: vi.fn(),
		read: vi.fn().mockImplementation(async (file: { path: string }) => fileContents.get(file.path) ?? ""),
		modify: vi.fn().mockImplementation(async (file: { path: string }, content: string) => {
			fileContents.set(file.path, content);
		}),
		create: vi.fn().mockImplementation(async (path: string, content: string) => {
			fileContents.set(path, content);
			const file = createMockFile(path);
			vault.getAbstractFileByPath.mockImplementation((p: string) => (p === path ? file : null));
			return file;
		}),
		createFolder: vi.fn().mockResolvedValue(undefined),
		adapter: { exists: vi.fn().mockResolvedValue(true) },
	};

	return vault;
}

function createMockApp(vault: ReturnType<typeof createMockVaultForCommands>) {
	return {
		vault,
		workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) },
		metadataCache: {
			getFileCache: vi.fn().mockReturnValue(null),
		},
		fileManager: {
			trashFile: vi.fn().mockResolvedValue(undefined),
		},
	} as any;
}

function createStoreAndBundle(vault: ReturnType<typeof createMockVaultForCommands>) {
	const settingsStore = createMockSingleCalendarSettingsStore({ directory: "calendar" });
	const app = createMockApp(vault);
	const store = new VirtualEventStore(app, settingsStore);

	const bundle = {
		virtualEventStore: store,
		settingsStore: { currentSettings: settingsStore.value },
		createEventFile: vi.fn().mockResolvedValue("calendar/New Event-202503151200.md"),
	} as any;

	return { app, store, bundle, settingsStore };
}

// ─── CreateVirtualEventCommand ───────────────────────────────

describe("CreateVirtualEventCommand", () => {
	let vault: ReturnType<typeof createMockVaultForCommands>;
	let store: VirtualEventStore;
	let bundle: any;

	beforeEach(async () => {
		vault = createMockVaultForCommands();
		vault.getAbstractFileByPath.mockReturnValue(null);
		({ store, bundle } = createStoreAndBundle(vault));
		await store.initialize();
	});

	afterEach(() => {
		store.destroy();
	});

	it("should add a virtual event on execute", async () => {
		const command = new CreateVirtualEventCommand(bundle, {
			title: "Virtual Meeting",
			start: "2025-03-15T09:00:00",
			end: "2025-03-15T10:00:00",
			allDay: false,
			properties: { Category: "Work" },
		});

		await command.execute();

		expect(store.getAll()).toHaveLength(1);
		expect(store.getAll()[0].title).toBe("Virtual Meeting");
		expect(store.getAll()[0].properties).toEqual({ Category: "Work" });
	});

	it("should remove the virtual event on undo", async () => {
		const command = new CreateVirtualEventCommand(bundle, {
			title: "Will Undo",
			start: "2025-03-15T09:00:00",
			end: null,
			allDay: false,
			properties: {},
		});

		await command.execute();
		expect(store.getAll()).toHaveLength(1);

		await command.undo();
		expect(store.getAll()).toHaveLength(0);
	});

	it("should report canUndo correctly", async () => {
		const command = new CreateVirtualEventCommand(bundle, {
			title: "Check Undo",
			start: "2025-03-15T09:00:00",
			end: null,
			allDay: false,
			properties: {},
		});

		expect(command.canUndo()).toBe(false);

		await command.execute();
		expect(command.canUndo()).toBe(true);

		await command.undo();
		expect(command.canUndo()).toBe(false);
	});

	it("should return correct type", () => {
		const command = new CreateVirtualEventCommand(bundle, {
			title: "T",
			start: "",
			end: null,
			allDay: false,
			properties: {},
		});
		expect(command.getType()).toBe("create-virtual-event");
	});
});

// ─── DeleteVirtualEventCommand ───────────────────────────────

describe("DeleteVirtualEventCommand", () => {
	let vault: ReturnType<typeof createMockVaultForCommands>;
	let store: VirtualEventStore;
	let bundle: any;

	beforeEach(async () => {
		vault = createMockVaultForCommands();
		vault.getAbstractFileByPath.mockReturnValue(null);
		({ store, bundle } = createStoreAndBundle(vault));
		await store.initialize();
	});

	afterEach(() => {
		store.destroy();
	});

	it("should remove the virtual event on execute", async () => {
		const added = await store.add(createVirtualEventData({ title: "To Delete" }));

		const command = new DeleteVirtualEventCommand(bundle, added.id);
		await command.execute();

		expect(store.getById(added.id)).toBeUndefined();
	});

	it("should restore the virtual event with same ID on undo", async () => {
		const added = await store.add(
			createVirtualEventData({
				title: "Restore Me",
				properties: { Category: "Important" },
			})
		);
		const originalId = added.id;

		const command = new DeleteVirtualEventCommand(bundle, added.id);
		await command.execute();
		await command.undo();

		const restored = store.getById(originalId);
		expect(restored).toBeDefined();
		expect(restored!.title).toBe("Restore Me");
		expect(restored!.properties).toEqual({ Category: "Important" });
	});

	it("should round-trip: execute → undo → execute produces same result", async () => {
		const added = await store.add(createVirtualEventData({ title: "Round Trip" }));

		const command = new DeleteVirtualEventCommand(bundle, added.id);
		await command.execute();
		expect(store.getAll()).toHaveLength(0);

		await command.undo();
		expect(store.getAll()).toHaveLength(1);

		// Re-create command for second delete (same id still valid)
		const command2 = new DeleteVirtualEventCommand(bundle, added.id);
		await command2.execute();
		expect(store.getAll()).toHaveLength(0);
	});

	it("should throw when virtual event does not exist", async () => {
		const command = new DeleteVirtualEventCommand(bundle, "nonexistent");
		await expect(command.execute()).rejects.toThrow("Virtual event not found");
	});

	it("should report canUndo correctly", async () => {
		const added = await store.add(createVirtualEventData());

		const command = new DeleteVirtualEventCommand(bundle, added.id);
		expect(command.canUndo()).toBe(false);

		await command.execute();
		expect(command.canUndo()).toBe(true);

		await command.undo();
		expect(command.canUndo()).toBe(false);
	});
});

// ─── ConvertToVirtualCommand ─────────────────────────────────

describe("ConvertToVirtualCommand", () => {
	let vault: ReturnType<typeof createMockVaultForCommands>;
	let app: any;
	let store: VirtualEventStore;
	let bundle: any;

	const FILE_PATH = "calendar/meeting.md";
	const FILE_CONTENT = "---\nStart Date: 2025-03-15T09:00:00\n---\nMeeting notes";
	const MOCK_FRONTMATTER = {
		"Start Date": "2025-03-15T09:00:00",
		"End Date": "2025-03-15T10:00:00",
		"All Day": false,
		Category: "Work",
	};

	function setupFileWithFrontmatter(frontmatter: Record<string, unknown> = MOCK_FRONTMATTER) {
		const fakeFile = createMockFile(FILE_PATH);
		vault.getAbstractFileByPath.mockImplementation((p: string) => (p === FILE_PATH ? fakeFile : null));
		vault.read.mockResolvedValue(FILE_CONTENT);
		app.metadataCache.getFileCache.mockReturnValue({ frontmatter });
		return fakeFile;
	}

	beforeEach(async () => {
		vault = createMockVaultForCommands();
		vault.getAbstractFileByPath.mockReturnValue(null);
		({ app, store, bundle } = createStoreAndBundle(vault));
		await store.initialize();
	});

	afterEach(() => {
		store.destroy();
	});

	it("should trash file and add virtual entry on execute", async () => {
		const fakeFile = setupFileWithFrontmatter();
		const command = new ConvertToVirtualCommand(app, bundle, FILE_PATH);

		await command.execute();

		expect(app.fileManager.trashFile).toHaveBeenCalledWith(fakeFile);
		expect(store.getAll()).toHaveLength(1);
		expect(store.getAll()[0].title).toBe("meeting");
	});

	it("should recreate file and remove virtual entry on undo", async () => {
		setupFileWithFrontmatter();
		const command = new ConvertToVirtualCommand(app, bundle, FILE_PATH);

		await command.execute();

		vault.getAbstractFileByPath.mockReturnValue(null);
		await command.undo();

		expect(vault.create).toHaveBeenCalledWith(FILE_PATH, FILE_CONTENT);
		expect(store.getAll()).toHaveLength(0);
	});

	it("should store original file content as memento", async () => {
		setupFileWithFrontmatter();
		const command = new ConvertToVirtualCommand(app, bundle, FILE_PATH);

		await command.execute();
		vault.getAbstractFileByPath.mockReturnValue(null);
		vault.create.mockClear();
		await command.undo();

		expect(vault.create).toHaveBeenCalledWith(FILE_PATH, FILE_CONTENT);
	});
});

// ─── ConvertToRealCommand ────────────────────────────────────

describe("ConvertToRealCommand", () => {
	let vault: ReturnType<typeof createMockVaultForCommands>;
	let app: any;
	let store: VirtualEventStore;
	let bundle: any;

	const CREATED_PATH = "calendar/New Event-202503151200.md";

	beforeEach(async () => {
		vault = createMockVaultForCommands();
		vault.getAbstractFileByPath.mockReturnValue(null);
		({ app, store, bundle } = createStoreAndBundle(vault));
		await store.initialize();
	});

	afterEach(() => {
		store.destroy();
	});

	it("should remove virtual entry and create file on execute", async () => {
		const added = await store.add(
			createVirtualEventData({
				title: "Become Real",
				properties: { Status: "todo" },
			})
		);

		const command = new ConvertToRealCommand(app, bundle, added.id);
		await command.execute();

		expect(store.getById(added.id)).toBeUndefined();
		expect(bundle.createEventFile).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Become Real",
				preservedFrontmatter: { Status: "todo" },
			})
		);
	});

	it("should trash created file and restore virtual entry on undo", async () => {
		const added = await store.add(
			createVirtualEventData({
				title: "Undo Real",
				properties: { Priority: "High" },
			})
		);
		const originalId = added.id;

		const command = new ConvertToRealCommand(app, bundle, added.id);
		await command.execute();

		const fakeFile = createMockFile(CREATED_PATH);
		vault.getAbstractFileByPath.mockImplementation((p: string) => (p === CREATED_PATH ? fakeFile : null));

		await command.undo();

		expect(app.fileManager.trashFile).toHaveBeenCalledWith(fakeFile);
		const restored = store.getById(originalId);
		expect(restored).toBeDefined();
		expect(restored!.title).toBe("Undo Real");
		expect(restored!.properties).toEqual({ Priority: "High" });
	});

	it("should throw when virtual event does not exist", async () => {
		const command = new ConvertToRealCommand(app, bundle, "nonexistent");
		await expect(command.execute()).rejects.toThrow("Virtual event not found");
	});

	it("should preserve virtual event data through execute → undo round-trip", async () => {
		const added = await store.add(
			createVirtualEventData({
				title: "Full Round Trip",
				start: "2025-06-01T14:00:00",
				end: "2025-06-01T15:30:00",
				allDay: false,
				properties: { Category: "Personal", Tags: ["important"] },
			})
		);

		const command = new ConvertToRealCommand(app, bundle, added.id);
		await command.execute();

		vault.getAbstractFileByPath.mockImplementation((p: string) =>
			p === CREATED_PATH ? createMockFile(CREATED_PATH) : null
		);

		await command.undo();

		const restored = store.getById(added.id)!;
		expect(restored.title).toBe("Full Round Trip");
		expect(restored.start).toBe("2025-06-01T14:00:00");
		expect(restored.end).toBe("2025-06-01T15:30:00");
		expect(restored.allDay).toBe(false);
		expect(restored.properties).toEqual({ Category: "Personal", Tags: ["important"] });
	});
});
