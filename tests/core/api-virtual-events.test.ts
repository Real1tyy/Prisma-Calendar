import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeEventReal, makeEventVirtual } from "../../src/core/api/event-crud";
import { VirtualEventStore } from "../../src/core/virtual-event-store";
import { createVirtualEventData } from "../fixtures";
import { createMockFile } from "../mocks/obsidian";
import { createMockSingleCalendarSettingsStore } from "../setup";

// ─── Helpers ─────────────────────────────────────────────────

function createMockVault() {
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

function createTestContext() {
	const vault = createMockVault();
	const settingsStore = createMockSingleCalendarSettingsStore({ directory: "calendar" });
	const app = {
		vault,
		workspace: { getActiveViewOfType: vi.fn().mockReturnValue(null) },
		metadataCache: {
			getFileCache: vi.fn().mockReturnValue({
				frontmatter: {
					"Start Date": "2025-03-15T09:00:00",
					"End Date": "2025-03-15T10:00:00",
					Category: "Work",
				},
			}),
		},
		fileManager: {
			trashFile: vi.fn().mockResolvedValue(undefined),
		},
	} as any;

	const store = new VirtualEventStore(app, settingsStore);

	const commandManager = {
		executeCommand: vi.fn().mockImplementation(async (cmd: { execute: () => Promise<void> }) => {
			await cmd.execute();
		}),
	};

	const bundle = {
		calendarId: "test-calendar",
		app,
		virtualEventStore: store,
		settingsStore: { currentSettings: settingsStore.value },
		commandManager,
		convertToVirtual: vi.fn().mockResolvedValue(undefined),
		convertToReal: vi.fn().mockResolvedValue(undefined),
		createEventFile: vi.fn().mockResolvedValue("calendar/New Event.md"),
	} as any;

	const plugin = {
		app,
		calendarBundles: [bundle],
		syncStore: { data: { lastUsedCalendarId: "test-calendar" } },
		rememberLastUsedCalendar: vi.fn(),
	} as any;

	return { vault, app, store, bundle, plugin };
}

// ─── makeEventVirtual ────────────────────────────────────────

describe("makeEventVirtual", () => {
	let ctx: ReturnType<typeof createTestContext>;

	beforeEach(() => {
		ctx = createTestContext();
	});

	afterEach(() => {
		ctx.store.destroy();
	});

	it("should call bundle.convertToVirtual with the file path", async () => {
		const fakeFile = createMockFile("calendar/meeting.md");
		ctx.vault.getAbstractFileByPath.mockImplementation((p: string) => (p === "calendar/meeting.md" ? fakeFile : null));

		const result = await makeEventVirtual(ctx.plugin, {
			filePath: "calendar/meeting.md",
		});

		expect(result).toBe(true);
		expect(ctx.bundle.convertToVirtual).toHaveBeenCalledWith("calendar/meeting.md");
	});

	it("should return false when no bundle is found", async () => {
		ctx.plugin.calendarBundles = [];

		const result = await makeEventVirtual(ctx.plugin, {
			filePath: "calendar/meeting.md",
		});

		expect(result).toBe(false);
	});

	it("should resolve the correct calendar by calendarId", async () => {
		const otherBundle = { ...ctx.bundle, calendarId: "other-calendar", convertToVirtual: vi.fn() };
		ctx.plugin.calendarBundles = [ctx.bundle, otherBundle];

		const fakeFile = createMockFile("calendar/meeting.md");
		ctx.vault.getAbstractFileByPath.mockImplementation((p: string) => (p === "calendar/meeting.md" ? fakeFile : null));

		await makeEventVirtual(ctx.plugin, {
			filePath: "calendar/meeting.md",
			calendarId: "other-calendar",
		});

		expect(otherBundle.convertToVirtual).toHaveBeenCalled();
		expect(ctx.bundle.convertToVirtual).not.toHaveBeenCalled();
	});
});

// ─── makeEventReal ───────────────────────────────────────────

describe("makeEventReal", () => {
	let ctx: ReturnType<typeof createTestContext>;

	beforeEach(async () => {
		ctx = createTestContext();
		ctx.vault.getAbstractFileByPath.mockReturnValue(null);
		await ctx.store.initialize();
	});

	afterEach(() => {
		ctx.store.destroy();
	});

	it("should call bundle.convertToReal with the virtual event ID", async () => {
		const added = await ctx.store.add(createVirtualEventData({ title: "Convert Me" }));

		const result = await makeEventReal(ctx.plugin, {
			virtualEventId: added.id,
		});

		expect(result).toBe(true);
		expect(ctx.bundle.convertToReal).toHaveBeenCalledWith(added.id);
	});

	it("should return false when virtual event does not exist", async () => {
		const result = await makeEventReal(ctx.plugin, {
			virtualEventId: "nonexistent",
		});

		expect(result).toBe(false);
		expect(ctx.bundle.convertToReal).not.toHaveBeenCalled();
	});

	it("should return false when no bundle is found", async () => {
		ctx.plugin.calendarBundles = [];

		const result = await makeEventReal(ctx.plugin, {
			virtualEventId: "some-id",
		});

		expect(result).toBe(false);
	});

	it("should resolve the correct calendar by calendarId", async () => {
		const otherStore = new VirtualEventStore(ctx.app, createMockSingleCalendarSettingsStore({ directory: "other" }));
		await otherStore.initialize();
		const added = await otherStore.add(createVirtualEventData({ title: "Other Calendar" }));

		const otherBundle = {
			...ctx.bundle,
			calendarId: "other-calendar",
			virtualEventStore: otherStore,
			convertToReal: vi.fn(),
		};
		ctx.plugin.calendarBundles = [ctx.bundle, otherBundle];

		const result = await makeEventReal(ctx.plugin, {
			virtualEventId: added.id,
			calendarId: "other-calendar",
		});

		expect(result).toBe(true);
		expect(otherBundle.convertToReal).toHaveBeenCalledWith(added.id);
		otherStore.destroy();
	});
});

// ─── CRUD round-trip through API layer ───────────────────────

describe("API round-trip: makeEventVirtual → makeEventReal", () => {
	let ctx: ReturnType<typeof createTestContext>;
	let virtualEventId: string;

	beforeEach(async () => {
		ctx = createTestContext();
		ctx.vault.getAbstractFileByPath.mockReturnValue(null);
		await ctx.store.initialize();

		const added = await ctx.store.add(
			createVirtualEventData({
				title: "Round Trip Event",
				start: "2025-03-15T09:00:00",
				end: "2025-03-15T10:00:00",
				properties: { Category: "Work", Location: "Office" },
			})
		);
		virtualEventId = added.id;
	});

	afterEach(() => {
		ctx.store.destroy();
	});

	it("should verify virtual event exists before makeEventReal", async () => {
		expect(ctx.store.getById(virtualEventId)).toBeDefined();

		const result = await makeEventReal(ctx.plugin, { virtualEventId });
		expect(result).toBe(true);
	});

	it("should reject makeEventReal for already-converted event", async () => {
		await ctx.store.remove(virtualEventId);

		const result = await makeEventReal(ctx.plugin, { virtualEventId });
		expect(result).toBe(false);
	});

	it("should handle sequential make-virtual then make-real on different events", async () => {
		const fakeFile = createMockFile("calendar/another.md");
		ctx.vault.getAbstractFileByPath.mockImplementation((p: string) => (p === "calendar/another.md" ? fakeFile : null));

		const virtualResult = await makeEventVirtual(ctx.plugin, { filePath: "calendar/another.md" });
		expect(virtualResult).toBe(true);

		const realResult = await makeEventReal(ctx.plugin, { virtualEventId });
		expect(realResult).toBe(true);
	});
});
