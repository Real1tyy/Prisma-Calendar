import type { Plugin, TFile } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SerializableSchema } from "../../src/core/vault-table/create-mapped-schema";
import { TableView } from "../../src/core/vault-table/table-view";
import type { VaultTable } from "../../src/core/vault-table/vault-table";

type TestData = { name: string; category: string };

function createMockPlugin() {
	const plugin = {
		registerEvent: vi.fn(),
		app: {
			workspace: {
				on: vi.fn(),
				getActiveViewOfType: vi.fn(),
			},
		},
	} as unknown as Plugin;

	return plugin;
}

function createMockTable(directory: string) {
	return {
		directory,
		waitUntilReady: vi.fn().mockResolvedValue(undefined),
	} as unknown as VaultTable<TestData, SerializableSchema<TestData>>;
}

describe("TableView", () => {
	let plugin: Plugin;
	let table: VaultTable<TestData, SerializableSchema<TestData>>;
	let renderFn: ReturnType<typeof vi.fn>;
	let triggerFileOpen: (file: TFile | null) => void;

	beforeEach(() => {
		plugin = createMockPlugin();
		table = createMockTable("people");
		renderFn = vi.fn();

		(plugin.app.workspace.on as ReturnType<typeof vi.fn>).mockImplementation(
			(event: string, cb: (file: TFile | null) => void) => {
				if (event === "file-open") {
					triggerFileOpen = cb;
				}
				return { event, cb };
			}
		);

		new TableView(plugin, table, renderFn);

		const onCall = (plugin.app.workspace.on as ReturnType<typeof vi.fn>).mock.calls[0];
		triggerFileOpen = onCall[1] as (file: TFile | null) => void;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should register a file-open event handler on construction", () => {
		expect(plugin.registerEvent).toHaveBeenCalledOnce();
	});

	describe("onFileOpen behavior", () => {
		it("should do nothing when file is null", async () => {
			triggerFileOpen(null);
			await vi.waitFor(() => {});

			expect(table.waitUntilReady).not.toHaveBeenCalled();
			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should do nothing for a non-folder-note file", async () => {
			const file = { path: "people/alice.md" } as TFile;
			triggerFileOpen(file);
			await vi.waitFor(() => {});

			expect(table.waitUntilReady).not.toHaveBeenCalled();
			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should do nothing for a folder note in a different directory", async () => {
			const file = { path: "projects/projects.md" } as TFile;
			triggerFileOpen(file);
			await vi.waitFor(() => {});

			expect(table.waitUntilReady).not.toHaveBeenCalled();
			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should do nothing when no MarkdownView is active", async () => {
			const file = { path: "people/people.md" } as TFile;
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(null);

			triggerFileOpen(file);
			await vi.waitFor(() => {});

			expect(renderFn).not.toHaveBeenCalled();
		});

		it("should create a container, prepend it, and call render for the table folder note", async () => {
			const file = { path: "people/people.md" } as TFile;
			const contentEl = document.createElement("div");
			const mockView = { contentEl };
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(mockView);

			triggerFileOpen(file);

			await vi.waitFor(() => {
				expect(renderFn).toHaveBeenCalledOnce();
			});

			const container = renderFn.mock.calls[0][0] as HTMLElement;
			expect(container.classList.contains("vault-table-view")).toBe(true);
			expect(contentEl.firstChild).toBe(container);
			expect(renderFn).toHaveBeenCalledWith(container, table);
		});

		it("should remove the previous container when a new file is opened", async () => {
			const contentEl = document.createElement("div");
			const mockView = { contentEl };
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(mockView);

			const file = { path: "people/people.md" } as TFile;
			triggerFileOpen(file);

			await vi.waitFor(() => {
				expect(renderFn).toHaveBeenCalledOnce();
			});

			const firstContainer = renderFn.mock.calls[0][0] as HTMLElement;
			expect(contentEl.contains(firstContainer)).toBe(true);

			triggerFileOpen(null);

			expect(contentEl.contains(firstContainer)).toBe(false);
		});

		it("should remove old container and create new one when re-opening the folder note", async () => {
			const contentEl = document.createElement("div");
			const mockView = { contentEl };
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(mockView);

			const file = { path: "people/people.md" } as TFile;

			triggerFileOpen(file);
			await vi.waitFor(() => {
				expect(renderFn).toHaveBeenCalledTimes(1);
			});

			const firstContainer = renderFn.mock.calls[0][0] as HTMLElement;

			triggerFileOpen(file);
			await vi.waitFor(() => {
				expect(renderFn).toHaveBeenCalledTimes(2);
			});

			expect(contentEl.contains(firstContainer)).toBe(false);

			const secondContainer = renderFn.mock.calls[1][0] as HTMLElement;
			expect(contentEl.contains(secondContainer)).toBe(true);
		});

		it("should wait until the table is ready before rendering", async () => {
			let resolveReady: () => void;
			(table.waitUntilReady as ReturnType<typeof vi.fn>).mockReturnValue(
				new Promise<void>((resolve) => {
					resolveReady = resolve;
				})
			);

			const contentEl = document.createElement("div");
			const mockView = { contentEl };
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(mockView);

			const file = { path: "people/people.md" } as TFile;
			triggerFileOpen(file);

			await vi.waitFor(() => {
				expect(table.waitUntilReady).toHaveBeenCalled();
			});

			expect(renderFn).not.toHaveBeenCalled();

			resolveReady!();

			await vi.waitFor(() => {
				expect(renderFn).toHaveBeenCalledOnce();
			});
		});
	});

	describe("folder note detection", () => {
		it("should only activate for folder notes matching the table directory", async () => {
			const contentEl = document.createElement("div");
			const mockView = { contentEl };
			(plugin.app.workspace.getActiveViewOfType as ReturnType<typeof vi.fn>).mockReturnValue(mockView);

			triggerFileOpen({ path: "people/alice.md" } as TFile);
			await vi.waitFor(() => {});
			expect(renderFn).not.toHaveBeenCalled();

			triggerFileOpen({ path: "people/subfolder/subfolder.md" } as TFile);
			await vi.waitFor(() => {});
			expect(renderFn).not.toHaveBeenCalled();

			triggerFileOpen({ path: "people/people.md" } as TFile);
			await vi.waitFor(() => {
				expect(renderFn).toHaveBeenCalledOnce();
			});
		});
	});
});
