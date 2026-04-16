import type { Plugin, TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SerializableSchema } from "../../src/core/vault-table/create-mapped-schema";
import { NoteDecorator } from "../../src/core/vault-table/note-decorator";
import type { VaultTable, VaultTableRow } from "../../src/core/vault-table/vault-table";

type TestData = { title: string; status: string };

function createMockPlugin() {
	const fileOpenCallbacks: Array<(file: TFile | null) => void> = [];

	const plugin = {
		registerEvent: vi.fn(),
		app: {
			workspace: {
				on: vi.fn((event: string, cb: (file: TFile | null) => void) => {
					if (event === "file-open") {
						fileOpenCallbacks.push(cb);
					}
					return { event, cb };
				}),
				getActiveViewOfType: vi.fn(),
			},
		},
	} as unknown as Plugin;

	return { plugin, fileOpenCallbacks };
}

function createMockTable(directory: string) {
	return {
		directory,
		waitUntilReady: vi.fn().mockResolvedValue(undefined),
		get: vi.fn(),
		getHydrated: vi.fn(),
	} as unknown as VaultTable<TestData, SerializableSchema<TestData>>;
}

describe("NoteDecorator", () => {
	let plugin: Plugin;
	let fileOpenCallbacks: Array<(file: TFile | null) => void>;
	let table: VaultTable<TestData, SerializableSchema<TestData>>;
	let renderFn: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		const mock = createMockPlugin();
		plugin = mock.plugin;
		fileOpenCallbacks = mock.fileOpenCallbacks;
		table = createMockTable("projects");
		renderFn = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should register a file-open event handler on construction", () => {
		new NoteDecorator(plugin, table, renderFn);

		expect(plugin.registerEvent).toHaveBeenCalledOnce();
	});

	it("should capture the file-open callback from workspace.on", () => {
		new NoteDecorator(plugin, table, renderFn);

		const registerCall = (plugin.registerEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(registerCall).toBeDefined();
	});

	describe("onFileOpen behavior", () => {
		let triggerFileOpen: (file: TFile | null) => void;

		beforeEach(() => {
			(plugin.app.workspace.on as ReturnType<typeof vi.fn>).mockImplementation(
				(event: string, cb: (file: TFile | null) => void) => {
					if (event === "file-open") {
						fileOpenCallbacks.push(cb);
					}
					return { event, cb };
				}
			);

			(plugin.registerEvent as ReturnType<typeof vi.fn>).mockImplementation(() => {});

			new NoteDecorator(plugin, table, renderFn);

			const onCall = (plugin.app.workspace.on as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(onCall[0]).toBe("file-open");
			triggerFileOpen = onCall[1] as (file: TFile | null) => void;
		});

		it("should do nothing when file is null", async () => {
			triggerFileOpen(null);
			await vi.waitFor(() => {});

			expect(table.waitUntilReady).not.toHaveBeenCalled();
			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should do nothing when file is outside the table directory", async () => {
			const file = { path: "other-folder/note.md" } as TFile;
			triggerFileOpen(file);
			await vi.waitFor(() => {});

			expect(table.waitUntilReady).not.toHaveBeenCalled();
			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should skip folder notes that match the table directory", async () => {
			const file = { path: "projects/projects.md" } as TFile;
			triggerFileOpen(file);
			await vi.waitFor(() => {});

			expect(table.waitUntilReady).not.toHaveBeenCalled();
			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should do nothing when no MarkdownView is active", async () => {
			const file = { path: "projects/task-a.md" } as TFile;
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(null);

			triggerFileOpen(file);
			await vi.waitFor(() => {});

			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should do nothing when the file is not in the table", async () => {
			const file = { path: "projects/task-a.md" } as TFile;
			const mockView = { contentEl: document.createElement("div") };
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(mockView);
			(table.get as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

			triggerFileOpen(file);

			await vi.waitFor(() => {
				expect(table.waitUntilReady).toHaveBeenCalled();
			});

			expect(table.get).toHaveBeenCalledWith("task-a");
			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should do nothing when hydrated row is not found", async () => {
			const file = { path: "projects/task-a.md" } as TFile;
			const mockView = { contentEl: document.createElement("div") };
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(mockView);
			(table.get as ReturnType<typeof vi.fn>).mockReturnValue({ id: "task-a" });
			(table.getHydrated as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

			triggerFileOpen(file);

			await vi.waitFor(() => {
				expect(table.getHydrated).toHaveBeenCalledWith("task-a");
			});

			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should create a container, prepend it, and call render when everything succeeds", async () => {
			const file = { path: "projects/task-a.md" } as TFile;
			const contentEl = document.createElement("div");
			const mockView = { contentEl };
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(mockView);

			const hydratedRow = {
				id: "task-a",
				data: { title: "Team Meeting", status: "active" },
				relations: {},
			} as unknown as VaultTableRow<TestData>;

			(table.get as ReturnType<typeof vi.fn>).mockReturnValue({ id: "task-a" });
			(table.getHydrated as ReturnType<typeof vi.fn>).mockResolvedValue(hydratedRow);

			triggerFileOpen(file);

			await vi.waitFor(() => {
				expect(renderFn).toHaveBeenCalledOnce();
			});

			const container = renderFn.mock.calls[0][0] as HTMLElement;
			expect(container.classList.contains("vault-table-note-decorator")).toBe(true);
			expect(contentEl.firstChild).toBe(container);
			expect(renderFn).toHaveBeenCalledWith(container, hydratedRow);
		});

		it("should remove the previous container when a new file is opened", async () => {
			const contentEl = document.createElement("div");
			const mockView = { contentEl };
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(mockView);

			const hydratedRow = {
				id: "task-a",
				data: { title: "Team Meeting", status: "active" },
				relations: {},
			} as unknown as VaultTableRow<TestData>;

			(table.get as ReturnType<typeof vi.fn>).mockReturnValue({ id: "task-a" });
			(table.getHydrated as ReturnType<typeof vi.fn>).mockResolvedValue(hydratedRow);

			const file1 = { path: "projects/task-a.md" } as TFile;
			triggerFileOpen(file1);

			await vi.waitFor(() => {
				expect(renderFn).toHaveBeenCalledOnce();
			});

			const firstContainer = renderFn.mock.calls[0][0] as HTMLElement;
			expect(contentEl.contains(firstContainer)).toBe(true);

			triggerFileOpen(null);

			expect(contentEl.contains(firstContainer)).toBe(false);
		});
	});
});
