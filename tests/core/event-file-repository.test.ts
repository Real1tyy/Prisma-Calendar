import type { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { IndexerEvent } from "../../src/types/event-source";
import {
	createAllDayFrontmatter,
	createRepoSettingsStore,
	createTimedFrontmatter,
	TestableEventFileRepository,
} from "../fixtures/event-file-repository-fixtures";
import { createMockApp } from "../setup";

describe("EventFileRepository", () => {
	let repo: TestableEventFileRepository;
	let settingsStore: BehaviorSubject<any>;
	let mockApp: any;

	beforeEach(() => {
		mockApp = createMockApp();
		settingsStore = createRepoSettingsStore();
		repo = new TestableEventFileRepository(mockApp, settingsStore);
	});

	afterEach(() => {
		repo.destroy();
	});

	// ─── CRUD Operations ─────────────────────────────────────────

	describe("CRUD via VaultTable", () => {
		it("should create a row in the vault table", async () => {
			await repo.create("meeting", createTimedFrontmatter(), "Some notes");

			expect(repo.mockTable.has("meeting")).toBe(true);
			const ops = repo.mockTable.getOperationsOfType("create");
			expect(ops).toHaveLength(1);
			expect(ops[0].key).toBe("meeting");
		});

		it("should update a row by key", async () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter());

			await repo.update("meeting", { Title: "Updated Meeting" });

			const ops = repo.mockTable.getOperationsOfType("update");
			expect(ops).toHaveLength(1);
			expect((ops[0] as any).data).toEqual({ Title: "Updated Meeting" });
		});

		it("should update a row by file path", async () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter());

			await repo.updateByPath("Events/meeting.md", { Title: "Updated" });

			const ops = repo.mockTable.getOperationsOfType("update");
			expect(ops).toHaveLength(1);
			expect(ops[0].key).toBe("meeting");
		});

		it("should delete a row by key", async () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter());

			await repo.delete("meeting");

			expect(repo.mockTable.has("meeting")).toBe(false);
			const ops = repo.mockTable.getOperationsOfType("delete");
			expect(ops).toHaveLength(1);
		});

		it("should delete a row by file path", async () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter());

			await repo.deleteByPath("Events/meeting.md");

			expect(repo.mockTable.has("meeting")).toBe(false);
		});

		it("should throw when updating a non-existent row", async () => {
			await expect(repo.update("nonexistent", { Title: "X" })).rejects.toThrow();
		});

		it("should throw when deleting a non-existent row", async () => {
			await expect(repo.delete("nonexistent")).rejects.toThrow();
		});
	});

	// ─── Read Operations ─────────────────────────────────────────

	describe("read operations", () => {
		it("should get frontmatter by path", () => {
			const fm = createTimedFrontmatter();
			repo.mockTable.seed("meeting", fm);

			const result = repo.getByPath("Events/meeting.md");
			expect(result).toEqual(fm);
		});

		it("should return undefined for unknown path", () => {
			expect(repo.getByPath("Events/unknown.md")).toBeUndefined();
		});

		it("should get a row by path", () => {
			const fm = createTimedFrontmatter();
			repo.mockTable.seed("meeting", fm);

			const row = repo.getRowByPath("Events/meeting.md");
			expect(row).toBeDefined();
			expect(row!.data).toEqual(fm);
			expect(row!.id).toBe("meeting");
		});

		it("should return all rows", () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter());
			repo.mockTable.seed("holiday", createAllDayFrontmatter());

			const rows = repo.getAllRows();
			expect(rows).toHaveLength(2);
		});

		it("should check existence by key", () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter());

			expect(repo.has("meeting")).toBe(true);
			expect(repo.has("nonexistent")).toBe(false);
		});

		it("should convert file paths to keys", () => {
			expect(repo.toKey("Events/meeting.md")).toBe("meeting");
			expect(repo.toKey("Deep/Nested/path.md")).toBe("path");
		});
	});

	// ─── Frontmatter Operations ──────────────────────────────────

	describe("frontmatter operations", () => {
		it("should update frontmatter via updater function", async () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter({ Status: "pending" }));

			const result = await repo.updateFrontmatterByPath("Events/meeting.md", (fm) => {
				fm["Status"] = "done";
			});

			expect(result["Status"]).toBe("done");
			const row = repo.mockTable.get("meeting");
			expect(row!.data["Status"]).toBe("done");
		});

		it("should throw when updating frontmatter of non-existent file", async () => {
			await expect(repo.updateFrontmatterByPath("Events/unknown.md", () => {})).rejects.toThrow("Event file not found");
		});

		it("should create a snapshot of a row", async () => {
			const fm = createTimedFrontmatter();
			const row = repo.mockTable.seed("meeting", fm, "Body content");
			mockApp.vault.read.mockResolvedValue("---\nTitle: Team Meeting\n---\nBody content");

			const snapshot = await repo.snapshotByPath("Events/meeting.md");

			expect(snapshot.key).toBe("meeting");
			expect(snapshot.data).toEqual(fm);
			expect(snapshot.filePath).toBe(row.filePath);
		});

		it("should throw when snapshotting a non-existent file", async () => {
			await expect(repo.snapshotByPath("Events/unknown.md")).rejects.toThrow("Event file not found");
		});

		it("should restore a snapshot to an existing row", async () => {
			const fm = createTimedFrontmatter();
			const row = repo.mockTable.seed("meeting", fm);

			await repo.restoreSnapshot({
				key: "meeting",
				data: fm,
				content: "---\nTitle: Team Meeting\n---\nRestored body",
				filePath: row.filePath,
			});

			expect(mockApp.vault.modify).toHaveBeenCalledWith(row.file, "---\nTitle: Team Meeting\n---\nRestored body");
		});

		it("should create a new file when restoring a snapshot for a deleted row", async () => {
			await repo.restoreSnapshot({
				key: "deleted-event",
				data: createTimedFrontmatter(),
				content: "---\nTitle: Team Meeting\n---\nRestored",
				filePath: "Events/deleted-event.md",
			});

			expect(mockApp.vault.create).toHaveBeenCalledWith("Events/deleted-event.md", expect.any(String));
		});
	});

	// ─── Event Emission ──────────────────────────────────────────

	describe("event emission from VaultTable", () => {
		it("should emit file-changed event for timed events on row-created", async () => {
			const events: IndexerEvent[] = [];
			repo.events$.subscribe((e) => events.push(e));
			await repo.start();

			await repo.mockTable.create({
				fileName: "meeting",
				data: createTimedFrontmatter(),
			});

			await vi.waitFor(() => expect(events.length).toBeGreaterThan(0));
			const fileChanged = events.find((e) => e.type === "file-changed");
			expect(fileChanged).toBeDefined();
			expect(fileChanged!.source).toBeDefined();
			expect(fileChanged!.source!.filePath).toContain("meeting");
			expect(fileChanged!.source!.isUntracked).toBe(false);
		});

		it("should emit file-changed event for all-day events on row-created", async () => {
			const events: IndexerEvent[] = [];
			repo.events$.subscribe((e) => events.push(e));
			await repo.start();

			await repo.mockTable.create({
				fileName: "holiday",
				data: createAllDayFrontmatter(),
			});

			await vi.waitFor(() => expect(events.length).toBeGreaterThan(0));
			const fileChanged = events.find((e) => e.type === "file-changed");
			expect(fileChanged).toBeDefined();
			expect(fileChanged!.source!.isAllDay).toBe(true);
		});

		it("should emit untracked-file-changed for files without date properties", async () => {
			const events: IndexerEvent[] = [];
			repo.events$.subscribe((e) => events.push(e));
			await repo.start();

			await repo.mockTable.create({
				fileName: "note",
				data: { Title: "Random Note" },
			});

			await vi.waitFor(() => expect(events.length).toBeGreaterThan(0));
			const untracked = events.find((e) => e.type === "untracked-file-changed");
			expect(untracked).toBeDefined();
			expect(untracked!.source!.isUntracked).toBe(true);
		});

		it("should emit file-deleted event on row-deleted", async () => {
			const events: IndexerEvent[] = [];
			repo.events$.subscribe((e) => events.push(e));
			await repo.start();

			repo.mockTable.seed("meeting", createTimedFrontmatter());
			await repo.mockTable.delete("meeting");

			await vi.waitFor(() => expect(events.length).toBeGreaterThan(0));
			const deleted = events.find((e) => e.type === "file-deleted");
			expect(deleted).toBeDefined();
			expect(deleted!.filePath).toContain("meeting");
		});

		it("should include oldFrontmatter and diff on row-updated", async () => {
			const events: IndexerEvent[] = [];
			repo.events$.subscribe((e) => events.push(e));
			await repo.start();

			repo.mockTable.seed("meeting", createTimedFrontmatter());
			await repo.mockTable.update("meeting", { Title: "Updated Meeting" });

			await vi.waitFor(() => expect(events.length).toBeGreaterThan(0));
			const fileChanged = events.find((e) => e.type === "file-changed");
			expect(fileChanged).toBeDefined();
			expect(fileChanged!.oldFrontmatter).toBeDefined();
			expect(fileChanged!.oldFrontmatter!["Title"]).toBe("Team Meeting");
		});

		it("should emit indexingComplete when table is ready", async () => {
			const readyStates: boolean[] = [];
			repo.indexingComplete$.subscribe((r) => readyStates.push(r));

			await repo.start();
			repo.mockTable.emitReady(true);

			expect(readyStates).toContain(true);
		});
	});

	// ─── Recurring Event Detection ───────────────────────────────

	describe("recurring event detection", () => {
		it("should emit recurring-event-found for files with RRULE", async () => {
			const events: IndexerEvent[] = [];
			repo.events$.subscribe((e) => events.push(e));
			await repo.start();

			await repo.mockTable.create({
				fileName: "weekly-standup",
				data: {
					"Start Date": "2024-06-15T10:00:00",
					"End Date": "2024-06-15T10:30:00",
					Recurrence: "weekly",
					RecurrenceId: "rrule-123",
					Title: "Weekly Standup",
				},
			});

			await vi.waitFor(() => expect(events.length).toBeGreaterThan(0));
			const recurring = events.find((e) => e.type === "recurring-event-found");
			expect(recurring).toBeDefined();
			expect(recurring!.recurringEvent).toBeDefined();
			expect(recurring!.recurringEvent!.rRuleId).toBe("rrule-123");
		});

		it("should NOT emit recurring-event-found for non-recurring files", async () => {
			const events: IndexerEvent[] = [];
			repo.events$.subscribe((e) => events.push(e));
			await repo.start();

			await repo.mockTable.create({
				fileName: "meeting",
				data: createTimedFrontmatter(),
			});

			await vi.waitFor(() => events.some((e) => e.type === "file-changed"));
			const recurring = events.find((e) => e.type === "recurring-event-found");
			expect(recurring).toBeUndefined();
		});
	});

	// ─── Operation Log Tracking ──────────────────────────────────

	describe("operation log tracking", () => {
		it("should track create operations", async () => {
			await repo.create("event-1", createTimedFrontmatter());
			await repo.create("event-2", createAllDayFrontmatter());

			const creates = repo.mockTable.getOperationsOfType("create");
			expect(creates).toHaveLength(2);
			expect(creates[0].key).toBe("event-1");
			expect(creates[1].key).toBe("event-2");
		});

		it("should track update operations with previous data", async () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter({ Status: "pending" }));

			await repo.update("meeting", { Status: "done" });

			const updates = repo.mockTable.getOperationsOfType("update");
			expect(updates).toHaveLength(1);
			expect((updates[0] as any).previousData.Status).toBe("pending");
		});

		it("should track delete operations with previous data", async () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter({ Title: "To Be Deleted" }));

			await repo.delete("meeting");

			const deletes = repo.mockTable.getOperationsOfType("delete");
			expect(deletes).toHaveLength(1);
			expect((deletes[0] as any).previousData.Title).toBe("To Be Deleted");
		});

		it("should track mixed operations in order", async () => {
			await repo.create("event-1", createTimedFrontmatter());
			await repo.update("event-1", { Title: "Updated" });
			await repo.delete("event-1");

			const allOps = repo.mockTable.getOperations();
			expect(allOps).toHaveLength(3);
			expect(allOps.map((op: { type: string }) => op.type)).toEqual(["create", "update", "delete"]);
		});

		it("should clear operation log independently of data", () => {
			repo.mockTable.seed("meeting", createTimedFrontmatter());
			repo.mockTable.clearOperations();

			expect(repo.mockTable.getOperations()).toHaveLength(0);
			expect(repo.mockTable.has("meeting")).toBe(true);
		});
	});

	// ─── Seed (test setup without side effects) ──────────────────

	describe("seed operations", () => {
		it("should seed data without recording operations", () => {
			repo.mockTable.seed("event-1", createTimedFrontmatter());

			expect(repo.mockTable.has("event-1")).toBe(true);
			expect(repo.mockTable.getOperations()).toHaveLength(0);
		});

		it("should seed data without emitting events", () => {
			const events: any[] = [];
			repo.mockTable.events$.subscribe((e) => events.push(e));

			repo.mockTable.seed("event-1", createTimedFrontmatter());

			expect(events).toHaveLength(0);
		});

		it("should seed multiple rows at once", () => {
			repo.mockTable.seedMany([
				{ key: "event-1", data: createTimedFrontmatter() },
				{ key: "event-2", data: createAllDayFrontmatter() },
				{ key: "event-3", data: createTimedFrontmatter({ Title: "Event 3" }) },
			]);

			expect(repo.mockTable.count()).toBe(3);
			expect(repo.mockTable.getOperations()).toHaveLength(0);
		});
	});

	// ─── Lifecycle ───────────────────────────────────────────────

	describe("lifecycle", () => {
		it("should start and signal readiness", async () => {
			const readyStates: boolean[] = [];
			repo.indexingComplete$.subscribe((r) => readyStates.push(r));

			await repo.start();

			expect(readyStates).toContain(true);
		});

		it("should clean up on destroy", () => {
			const events: IndexerEvent[] = [];
			repo.events$.subscribe({
				next: (e: IndexerEvent) => events.push(e),
				complete: () => events.push({ type: "file-deleted", filePath: "__complete__" }),
			});

			repo.destroy();

			expect(events.some((e) => e.filePath === "__complete__")).toBe(true);
		});
	});
});
