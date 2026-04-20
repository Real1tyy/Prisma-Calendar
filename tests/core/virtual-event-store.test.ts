import { DateTime } from "luxon";
import type { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VIRTUAL_EVENTS_CODE_FENCE } from "../../src/constants";
import { toVirtualInput, VirtualEventStore } from "../../src/core/virtual-event-store";
import type { VirtualEventData } from "../../src/types/calendar";
import type { EventSaveData } from "../../src/types/event-boundaries";
import { createVirtualEventData } from "../fixtures";
import { createMockFile } from "../mocks/obsidian";
import { createMockSingleCalendarSettingsStore } from "../setup";

// ─── Helpers ─────────────────────────────────────────────────

function buildCodeFence(events: VirtualEventData[]): string {
	return `\`\`\`${VIRTUAL_EVENTS_CODE_FENCE}\n${JSON.stringify(events, null, 2)}\n\`\`\``;
}

function createMockVaultForStore() {
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

function createStore(
	vault: ReturnType<typeof createMockVaultForStore>,
	settingsStore?: BehaviorSubject<any>
): VirtualEventStore {
	const store = settingsStore ?? createMockSingleCalendarSettingsStore();
	const app = { vault, workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) } } as any;
	return new VirtualEventStore(app, store);
}

function makeSaveData(overrides: Partial<EventSaveData> = {}): EventSaveData {
	return {
		filePath: "events/meeting.md",
		title: "Team Meeting",
		start: "2025-03-15T09:00:00",
		end: "2025-03-15T10:00:00",
		allDay: false,
		virtual: true,
		preservedFrontmatter: {},
		...overrides,
	};
}

// ─── toVirtualInput ──────────────────────────────────────────

describe("toVirtualInput", () => {
	it("should map EventSaveData fields to VirtualEventData shape", () => {
		const saveData = makeSaveData({
			title: "Review",
			start: "2025-06-01T14:00:00",
			end: "2025-06-01T15:00:00",
			allDay: false,
			preservedFrontmatter: { Category: "Work" },
		});

		const result = toVirtualInput(saveData);

		expect(result).toEqual({
			title: "Review",
			start: "2025-06-01T14:00:00",
			end: "2025-06-01T15:00:00",
			allDay: false,
			properties: { Category: "Work" },
		});
	});

	it("should map preservedFrontmatter to properties", () => {
		const saveData = makeSaveData({
			preservedFrontmatter: { Status: "todo", Priority: "high" },
		});

		const result = toVirtualInput(saveData);

		expect(result.properties).toEqual({ Status: "todo", Priority: "high" });
	});

	it("should pass null end through", () => {
		const saveData = makeSaveData({ end: null });

		const result = toVirtualInput(saveData);

		expect(result.end).toBeNull();
	});

	it("should strip filePath and virtual from the output", () => {
		const saveData = makeSaveData({ filePath: "events/x.md", virtual: true });

		const result = toVirtualInput(saveData);

		expect(result).not.toHaveProperty("filePath");
		expect(result).not.toHaveProperty("virtual");
	});
});

// ─── VirtualEventStore ───────────────────────────────────────

describe("VirtualEventStore", () => {
	let vault: ReturnType<typeof createMockVaultForStore>;
	let settingsStore: BehaviorSubject<any>;
	let store: VirtualEventStore;

	beforeEach(() => {
		vault = createMockVaultForStore();
		settingsStore = createMockSingleCalendarSettingsStore({ directory: "calendar" });
		store = createStore(vault, settingsStore);
	});

	afterEach(() => {
		store.destroy();
	});

	describe("getFilePath", () => {
		it("should combine directory and fileName", () => {
			expect(store.getFilePath()).toMatch(/^calendar\/.+\.md$/);
		});

		it("should use root when directory is empty", () => {
			const rootStore = createStore(vault, createMockSingleCalendarSettingsStore({ directory: "" }));
			expect(rootStore.getFilePath()).not.toContain("/");
			expect(rootStore.getFilePath()).toMatch(/\.md$/);
			rootStore.destroy();
		});
	});

	describe("initialize + load", () => {
		it("should register vault modify listener", async () => {
			await store.initialize();

			expect(vault.on).toHaveBeenCalledWith("modify", expect.any(Function));
		});

		it("should load events from existing file with code fence", async () => {
			const events = [createVirtualEventData({ id: "e1", title: "Loaded Event" })];
			const fakeFile = createMockFile(store.getFilePath());
			vault.getAbstractFileByPath.mockReturnValue(fakeFile);
			vault.read.mockResolvedValue(buildCodeFence(events));

			await store.initialize();

			expect(store.getAll()).toHaveLength(1);
			expect(store.getAll()[0].title).toBe("Loaded Event");
		});

		it("should load empty array when file does not exist", async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);

			await store.initialize();

			expect(store.getAll()).toEqual([]);
		});

		it("should load empty array when file content has no code fence", async () => {
			vault.getAbstractFileByPath.mockReturnValue(createMockFile(store.getFilePath()));
			vault.read.mockResolvedValue("# Some markdown\nNo code fence here.");

			await store.initialize();

			expect(store.getAll()).toEqual([]);
		});

		it("should load empty array when code fence has malformed JSON", async () => {
			vault.getAbstractFileByPath.mockReturnValue(createMockFile(store.getFilePath()));
			vault.read.mockResolvedValue(`\`\`\`${VIRTUAL_EVENTS_CODE_FENCE}\n{broken json\n\`\`\``);

			await store.initialize();

			expect(store.getAll()).toEqual([]);
		});
	});

	describe("CRUD operations", () => {
		beforeEach(async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			await store.initialize();
		});

		it("should add an event and assign a UUID", async () => {
			const result = await store.add({
				title: "New Event",
				start: "2025-03-15T09:00:00",
				end: "2025-03-15T10:00:00",
				allDay: false,
				properties: {},
			});

			expect(result.id).toBeDefined();
			expect(result.id).not.toBe("");
			expect(result.title).toBe("New Event");
			expect(store.getAll()).toHaveLength(1);
		});

		it("should add from EventSaveData via addFromEventData", async () => {
			const saveData = makeSaveData({
				title: "From Save Data",
				preservedFrontmatter: { Category: "Personal" },
			});

			const result = await store.addFromEventData(saveData);

			expect(result.title).toBe("From Save Data");
			expect(result.properties).toEqual({ Category: "Personal" });
		});

		it("should retrieve an event by ID", async () => {
			const added = await store.add({
				title: "Findable",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			const found = store.getById(added.id);

			expect(found).toBeDefined();
			expect(found!.title).toBe("Findable");
		});

		it("should return undefined for non-existent ID", () => {
			expect(store.getById("nonexistent")).toBeUndefined();
		});

		it("should update an existing event by ID", async () => {
			const added = await store.add({
				title: "Original",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			await store.update(added.id, { title: "Updated" });

			expect(store.getById(added.id)!.title).toBe("Updated");
		});

		it("should update from EventSaveData via updateFromEventData", async () => {
			const added = await store.add({
				title: "Original",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			await store.updateFromEventData(
				added.id,
				makeSaveData({
					title: "Updated via SaveData",
					start: "2025-03-16T10:00:00",
					end: "2025-03-16T11:00:00",
				})
			);

			const updated = store.getById(added.id)!;
			expect(updated.title).toBe("Updated via SaveData");
			expect(updated.start).toBe("2025-03-16T10:00:00");
			expect(updated.end).toBe("2025-03-16T11:00:00");
		});

		it("should preserve ID when updating", async () => {
			const added = await store.add({
				title: "Keep ID",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});
			const originalId = added.id;

			await store.update(added.id, { title: "Changed" });

			expect(store.getById(originalId)).toBeDefined();
		});

		it("should remove an event by ID", async () => {
			const added = await store.add({
				title: "To Remove",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			await store.remove(added.id);

			expect(store.getById(added.id)).toBeUndefined();
			expect(store.getAll()).toHaveLength(0);
		});

		it("should not affect other events when removing one", async () => {
			const first = await store.add({
				title: "First",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});
			const second = await store.add({
				title: "Second",
				start: "2025-03-16T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			await store.remove(first.id);

			expect(store.getAll()).toHaveLength(1);
			expect(store.getById(second.id)).toBeDefined();
		});
	});

	describe("getInRange", () => {
		beforeEach(async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			await store.initialize();

			await store.add({
				title: "March 10 Event",
				start: "2025-03-10T09:00:00",
				end: "2025-03-10T10:00:00",
				allDay: false,
				properties: {},
			});
			await store.add({
				title: "March 15 Event",
				start: "2025-03-15T09:00:00",
				end: "2025-03-15T10:00:00",
				allDay: false,
				properties: {},
			});
			await store.add({
				title: "March 20 Event",
				start: "2025-03-20T09:00:00",
				end: "2025-03-20T10:00:00",
				allDay: false,
				properties: {},
			});
		});

		it("should return events within the range", () => {
			const results = store.getInRange(
				DateTime.fromISO("2025-03-14T00:00:00"),
				DateTime.fromISO("2025-03-16T00:00:00")
			);

			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("March 15 Event");
		});

		it("should return all events when range covers all", () => {
			const results = store.getInRange(
				DateTime.fromISO("2025-03-01T00:00:00"),
				DateTime.fromISO("2025-03-31T00:00:00")
			);

			expect(results).toHaveLength(3);
		});

		it("should return empty array when no events in range", () => {
			const results = store.getInRange(
				DateTime.fromISO("2025-04-01T00:00:00"),
				DateTime.fromISO("2025-04-30T00:00:00")
			);

			expect(results).toHaveLength(0);
		});

		it("should use start as end for events with null end", async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			const noEndStore = createStore(vault, createMockSingleCalendarSettingsStore({ directory: "cal" }));
			await noEndStore.initialize();

			await noEndStore.add({
				title: "No End",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			const results = noEndStore.getInRange(
				DateTime.fromISO("2025-03-15T00:00:00"),
				DateTime.fromISO("2025-03-16T00:00:00")
			);

			expect(results).toHaveLength(1);
			noEndStore.destroy();
		});

		it("should include events that span across the range boundary", async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			const spanStore = createStore(vault, createMockSingleCalendarSettingsStore({ directory: "cal" }));
			await spanStore.initialize();

			await spanStore.add({
				title: "Multi-day",
				start: "2025-03-14T18:00:00",
				end: "2025-03-16T06:00:00",
				allDay: false,
				properties: {},
			});

			const results = spanStore.getInRange(
				DateTime.fromISO("2025-03-15T00:00:00"),
				DateTime.fromISO("2025-03-15T23:59:59")
			);

			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("Multi-day");
			spanStore.destroy();
		});
	});

	describe("save — file I/O", () => {
		it("should create file on initialize when it does not exist", async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);

			await store.initialize();

			expect(vault.create).toHaveBeenCalledWith(
				store.getFilePath(),
				expect.stringContaining(VIRTUAL_EVENTS_CODE_FENCE)
			);
		});

		it("should persist through the repository on modify", async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			await store.initialize();

			await store.add({
				title: "First",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			await store.add({
				title: "Second",
				start: "2025-03-16T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			expect(store.getAll()).toHaveLength(2);
			expect(vault.modify).toHaveBeenCalled();
		});
	});

	describe("changes$ observable", () => {
		it("should emit current events on subscription", () => {
			const values: VirtualEventData[][] = [];
			const sub = store.changes$.subscribe((v) => values.push(v));

			expect(values).toHaveLength(1);
			expect(values[0]).toEqual([]);
			sub.unsubscribe();
		});

		it("should emit after add", async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			await store.initialize();
			const values: VirtualEventData[][] = [];
			const sub = store.changes$.subscribe((v) => values.push(v));

			await store.add({
				title: "Observable Test",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			expect(values.length).toBeGreaterThanOrEqual(2);
			const latest = values[values.length - 1];
			expect(latest).toHaveLength(1);
			expect(latest[0].title).toBe("Observable Test");
			sub.unsubscribe();
		});

		it("should emit after remove", async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			await store.initialize();
			const added = await store.add({
				title: "Will Remove",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			const values: VirtualEventData[][] = [];
			const sub = store.changes$.subscribe((v) => values.push(v));

			await store.remove(added.id);

			const latest = values[values.length - 1];
			expect(latest).toHaveLength(0);
			sub.unsubscribe();
		});
	});

	describe("round-trip: add → remove → re-add preserves data", () => {
		beforeEach(async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			await store.initialize();
		});

		it("should preserve all fields through add → get → remove → re-add cycle", async () => {
			const input = {
				title: "Round Trip",
				start: "2025-06-01T14:00:00",
				end: "2025-06-01T15:30:00",
				allDay: false,
				properties: { Category: "Work", Priority: "High", Tags: ["urgent", "review"] },
			};

			const added = await store.add(input);
			const snapshot = { ...store.getById(added.id)! };

			await store.remove(added.id);
			expect(store.getById(added.id)).toBeUndefined();

			const reAdded = await store.add(input);

			expect(reAdded.title).toBe(snapshot.title);
			expect(reAdded.start).toBe(snapshot.start);
			expect(reAdded.end).toBe(snapshot.end);
			expect(reAdded.allDay).toBe(snapshot.allDay);
			expect(reAdded.properties).toEqual(snapshot.properties);
		});

		it("should preserve all-day event data through add → remove → re-add", async () => {
			const input = {
				title: "All Day Round Trip",
				start: "2025-12-25T00:00:00",
				end: null,
				allDay: true,
				properties: { Type: "Holiday" },
			};

			const added = await store.add(input);
			await store.remove(added.id);
			const reAdded = await store.add(input);

			expect(reAdded.allDay).toBe(true);
			expect(reAdded.end).toBeNull();
			expect(reAdded.properties).toEqual({ Type: "Holiday" });
		});

		it("should handle multiple add/remove cycles without state corruption", async () => {
			const events = [];
			for (const title of ["Alpha", "Beta", "Gamma"]) {
				events.push(await store.add({ title, start: "2025-03-15T09:00:00", end: null, allDay: false, properties: {} }));
			}

			expect(store.getAll()).toHaveLength(3);

			await store.remove(events[1].id);
			expect(store.getAll()).toHaveLength(2);
			expect(store.getAll().map((e) => e.title)).toEqual(["Alpha", "Gamma"]);

			await store.remove(events[0].id);
			expect(store.getAll()).toHaveLength(1);
			expect(store.getAll()[0].title).toBe("Gamma");

			const delta = await store.add({
				title: "Delta",
				start: "2025-03-16T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});

			expect(store.getAll()).toHaveLength(2);
			expect(store.getAll().map((e) => e.title)).toEqual(["Gamma", "Delta"]);

			await store.remove(events[2].id);
			await store.remove(delta.id);
			expect(store.getAll()).toHaveLength(0);
		});
	});

	describe("round-trip: EventSaveData → store → retrieve preserves data", () => {
		beforeEach(async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			await store.initialize();
		});

		it("should preserve all EventSaveData fields through addFromEventData → getById", async () => {
			const saveData = makeSaveData({
				title: "From Modal",
				start: "2025-04-10T08:30:00",
				end: "2025-04-10T09:45:00",
				allDay: false,
				preservedFrontmatter: {
					Category: "Personal",
					Status: "todo",
					Participants: ["Alice", "Bob"],
				},
			});

			const added = await store.addFromEventData(saveData);
			const retrieved = store.getById(added.id)!;

			expect(retrieved.title).toBe(saveData.title);
			expect(retrieved.start).toBe(saveData.start);
			expect(retrieved.end).toBe(saveData.end);
			expect(retrieved.allDay).toBe(saveData.allDay);
			expect(retrieved.properties).toEqual(saveData.preservedFrontmatter);
		});

		it("should preserve data through addFromEventData → updateFromEventData → getById", async () => {
			const original = makeSaveData({
				title: "Original Title",
				start: "2025-04-10T08:00:00",
				end: "2025-04-10T09:00:00",
				preservedFrontmatter: { Category: "Work" },
			});
			const added = await store.addFromEventData(original);

			const updated = makeSaveData({
				title: "Updated Title",
				start: "2025-04-11T10:00:00",
				end: "2025-04-11T11:30:00",
				preservedFrontmatter: { Category: "Personal", Location: "Home" },
			});
			await store.updateFromEventData(added.id, updated);

			const retrieved = store.getById(added.id)!;
			expect(retrieved.id).toBe(added.id);
			expect(retrieved.title).toBe("Updated Title");
			expect(retrieved.start).toBe("2025-04-11T10:00:00");
			expect(retrieved.end).toBe("2025-04-11T11:30:00");
			expect(retrieved.properties).toEqual({ Category: "Personal", Location: "Home" });
		});
	});

	describe("round-trip: file persistence", () => {
		it("should produce identical data after save → load cycle", async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			await store.initialize();

			const added = await store.add({
				title: "Persist Me",
				start: "2025-07-01T12:00:00",
				end: "2025-07-01T13:00:00",
				allDay: false,
				properties: { Category: "Work", Tags: ["important"] },
			});

			// Fresh store loading from the same vault (content-tracking mock preserves writes)
			const freshStore = createStore(vault, createMockSingleCalendarSettingsStore({ directory: "calendar" }));
			await freshStore.initialize();

			const loaded = freshStore.getAll();
			expect(loaded).toHaveLength(1);
			expect(loaded[0].id).toBe(added.id);
			expect(loaded[0].title).toBe("Persist Me");
			expect(loaded[0].start).toBe("2025-07-01T12:00:00");
			expect(loaded[0].end).toBe("2025-07-01T13:00:00");
			expect(loaded[0].allDay).toBe(false);
			expect(loaded[0].properties).toEqual({ Category: "Work", Tags: ["important"] });
			freshStore.destroy();
		});

		it("should preserve multiple events through save → load cycle", async () => {
			vault.getAbstractFileByPath.mockReturnValue(null);
			await store.initialize();

			await store.add({ title: "First", start: "2025-07-01T09:00:00", end: null, allDay: false, properties: {} });
			await store.add({
				title: "Second",
				start: "2025-07-02T10:00:00",
				end: "2025-07-02T11:00:00",
				allDay: false,
				properties: { Status: "done" },
			});
			await store.add({ title: "Third", start: "2025-07-03T00:00:00", end: null, allDay: true, properties: {} });

			const freshStore = createStore(vault, createMockSingleCalendarSettingsStore({ directory: "calendar" }));
			await freshStore.initialize();

			const loaded = freshStore.getAll();
			expect(loaded).toHaveLength(3);
			expect(loaded.map((e) => e.title)).toEqual(["First", "Second", "Third"]);
			expect(loaded[1].properties).toEqual({ Status: "done" });
			expect(loaded[2].allDay).toBe(true);
			freshStore.destroy();
		});
	});

	describe("empty directory guard", () => {
		it("should not bind or create a file when directory is empty on initialize", async () => {
			const emptyDirStore = createStore(vault, createMockSingleCalendarSettingsStore({ directory: "" }));
			await emptyDirStore.initialize();

			expect(vault.create).not.toHaveBeenCalled();
			expect(vault.on).not.toHaveBeenCalled();
			expect(emptyDirStore.getAll()).toEqual([]);
			emptyDirStore.destroy();
		});

		it("should unbind and clear events when directory changes to empty", async () => {
			const settings = createMockSingleCalendarSettingsStore({ directory: "calendar" });
			const guardStore = createStore(vault, settings);
			vault.getAbstractFileByPath.mockReturnValue(null);
			await guardStore.initialize();

			await guardStore.add({
				title: "Existing",
				start: "2025-03-15T09:00:00",
				end: null,
				allDay: false,
				properties: {},
			});
			expect(guardStore.getAll()).toHaveLength(1);

			settings.next({ ...settings.value, directory: "" });

			expect(guardStore.getAll()).toEqual([]);
			guardStore.destroy();
		});

		it("should bind when directory changes from empty to non-empty", async () => {
			const settings = createMockSingleCalendarSettingsStore({ directory: "" });
			const guardStore = createStore(vault, settings);
			await guardStore.initialize();

			expect(vault.create).not.toHaveBeenCalled();

			settings.next({ ...settings.value, directory: "events" });

			await vi.waitFor(() => {
				expect(vault.create).toHaveBeenCalled();
			});
			guardStore.destroy();
		});
	});

	describe("destroy", () => {
		it("should unregister vault listener", async () => {
			await store.initialize();

			store.destroy();

			expect(vault.offref).toHaveBeenCalled();
		});

		it("should complete the changes$ observable", () => {
			let completed = false;
			store.changes$.subscribe({ complete: () => (completed = true) });

			store.destroy();

			expect(completed).toBe(true);
		});
	});
});
