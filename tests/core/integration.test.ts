import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MockVaultTable } from "../../../shared/src/testing/mocks/vault-table";
import { EventFileRepository } from "../../src/core/event-file-repository";
import { EventStore } from "../../src/core/event-store";
import type { Frontmatter } from "../../src/types";
import type { CalendarEvent } from "../../src/types/calendar";
import type { IndexerEvent } from "../../src/types/event-source";
import { createParserSettings } from "../fixtures";
import { createMockApp } from "../setup";

// ─── Test Subclass ───────────────────────────────────────────

class TestableEventFileRepository extends EventFileRepository {
	readonly mockTable: MockVaultTable<Frontmatter>;

	constructor(app: any, settingsStore: BehaviorSubject<any>, syncStore: any = null) {
		super(app, settingsStore, syncStore);
		this.mockTable = new MockVaultTable(settingsStore.value.directory);
		(this as any).table = this.mockTable;
	}

	protected override createTable(): any {
		return new MockVaultTable("temp");
	}
}

// ─── Helpers ─────────────────────────────────────────────────

function createSettings(overrides: Record<string, unknown> = {}) {
	return createParserSettings({
		directory: "Events",
		statusProperty: "Status",
		doneValue: "done",
		rruleProp: "Recurrence",
		rruleIdProp: "RecurrenceId",
		rruleSpecProp: "RecurrenceSpec",
		skipProp: "Skip",
		calendarTitleProp: "",
		autoAssignZettelId: "disabled",
		markPastInstancesAsDone: false,
		...overrides,
	});
}

function mockParserReturningCalendarEvents() {
	return {
		parseEventSource: vi.fn().mockImplementation((source: any) => {
			if (source.isUntracked) return null;
			return {
				id: `id-${source.filePath}`,
				ref: { filePath: source.filePath },
				title: source.frontmatter.Title || "Untitled",
				start: source.frontmatter["Start Date"] || source.frontmatter.Date || "2024-01-01T00:00:00",
				end: source.frontmatter["End Date"] || source.frontmatter["Start Date"] || "2024-01-01T01:00:00",
				type: source.isAllDay ? "allDay" : "timed",
				allDay: source.isAllDay,
				skipped: false,
				color: "",
				meta: source.frontmatter,
				metadata: source.metadata,
				virtualKind: "none" as const,
			};
		}),
	};
}

// ─── Integration Tests ───────────────────────────────────────

describe("Integration: EventFileRepository → EventStore", () => {
	let repo: TestableEventFileRepository;
	let eventStore: EventStore;
	let settingsStore: BehaviorSubject<any>;
	let mockApp: any;
	let mockParser: ReturnType<typeof mockParserReturningCalendarEvents>;

	beforeEach(async () => {
		mockApp = createMockApp();
		settingsStore = new BehaviorSubject(createSettings());
		repo = new TestableEventFileRepository(mockApp, settingsStore);

		mockParser = mockParserReturningCalendarEvents();

		const mockRecurringEventManager = {
			generateAllVirtualInstances: vi.fn().mockReturnValue([]),
		};

		eventStore = new EventStore(repo, mockParser as any, mockRecurringEventManager as any, settingsStore);
		await repo.start();
	});

	afterEach(() => {
		eventStore.destroy();
		repo.destroy();
	});

	it("should process a complete event lifecycle: create → update → delete", async () => {
		// 1. Create
		await repo.mockTable.create({
			fileName: "meeting",
			data: {
				"Start Date": "2024-06-15T10:00:00",
				"End Date": "2024-06-15T11:00:00",
				Title: "Team Meeting",
			},
		});

		await vi.waitFor(() => expect(mockParser.parseEventSource).toHaveBeenCalled());
		expect(eventStore.getEventByPath("Events/meeting.md")).toBeDefined();

		// 2. Update
		mockParser.parseEventSource.mockClear();
		await repo.mockTable.update("meeting", { Title: "Updated Meeting" });

		await vi.waitFor(() => expect(mockParser.parseEventSource).toHaveBeenCalled());

		// 3. Delete
		await repo.mockTable.delete("meeting");

		await vi.waitFor(() => expect(eventStore.getEventByPath("Events/meeting.md")).toBeNull());

		// Verify operation log
		const ops = repo.mockTable.getOperations();
		expect(ops.map((op: { type: string }) => op.type)).toEqual(["create", "update", "delete"]);
	});

	it("should handle file deletion correctly", async () => {
		// Pre-seed and cache an event
		repo.mockTable.seed("meeting", {
			"Start Date": "2024-06-15T10:00:00",
			"End Date": "2024-06-15T11:00:00",
			Title: "To Delete",
		});

		const cachedEvent: CalendarEvent = {
			id: "id-Events/meeting.md",
			ref: { filePath: "Events/meeting.md" },
			title: "To Delete",
			start: "2024-06-15T10:00:00",
			end: "2024-06-15T11:00:00",
			type: "timed",
			allDay: false,
			skipped: false,
			color: "",
			meta: {},
			metadata: {} as any,
			virtualKind: "none" as const,
		};
		eventStore.updateEvent("Events/meeting.md", cachedEvent, 999);
		expect(eventStore.getEventByPath("Events/meeting.md")).toBeDefined();

		// Delete triggers file-deleted IndexerEvent → EventStore invalidates
		await repo.mockTable.delete("meeting");

		await vi.waitFor(() => expect(eventStore.getEventByPath("Events/meeting.md")).toBeNull());
	});

	it("should correctly classify all-day vs timed events", async () => {
		await repo.mockTable.create({
			fileName: "timed-event",
			data: {
				"Start Date": "2024-06-15T10:00:00",
				"End Date": "2024-06-15T11:00:00",
				Title: "Timed",
			},
		});

		await repo.mockTable.create({
			fileName: "all-day-event",
			data: {
				Date: "2024-06-15",
				"All Day": true,
				Title: "All Day",
			},
		});

		await vi.waitFor(() => expect(mockParser.parseEventSource).toHaveBeenCalledTimes(2));

		const calls = mockParser.parseEventSource.mock.calls;
		const timedCall = calls.find((c: any) => c[0].frontmatter.Title === "Timed")!;
		const allDayCall = calls.find((c: any) => c[0].frontmatter.Title === "All Day")!;

		expect(timedCall[0].isAllDay).toBe(false);
		expect(timedCall[0].isUntracked).toBe(false);
		expect(allDayCall[0].isAllDay).toBe(true);
		expect(allDayCall[0].isUntracked).toBe(false);
	});

	it("should emit untracked-file-changed for files without date properties", async () => {
		const events: IndexerEvent[] = [];
		repo.events$.subscribe((e) => events.push(e));

		await repo.mockTable.create({
			fileName: "random-note",
			data: { Title: "Just a note", someKey: "someValue" },
		});

		await vi.waitFor(() => expect(events.length).toBeGreaterThan(0));

		const untracked = events.find((e) => e.type === "untracked-file-changed");
		expect(untracked).toBeDefined();
		expect(untracked!.source!.isUntracked).toBe(true);
	});

	it("should handle concurrent file changes", async () => {
		const promises = Array.from({ length: 10 }, (_, i) =>
			repo.mockTable.create({
				fileName: `event-${i}`,
				data: {
					"Start Date": `2024-06-${String(i + 1).padStart(2, "0")}T10:00:00`,
					"End Date": `2024-06-${String(i + 1).padStart(2, "0")}T11:00:00`,
					Title: `Event ${i}`,
				},
			})
		);

		await Promise.all(promises);

		await vi.waitFor(() => expect(mockParser.parseEventSource).toHaveBeenCalledTimes(10));
		expect(repo.mockTable.count()).toBe(10);
		expect(repo.mockTable.getOperationsOfType("create")).toHaveLength(10);
	});

	it("should handle malformed frontmatter gracefully (parser returns null)", async () => {
		mockParser.parseEventSource.mockReturnValueOnce(null);

		await repo.mockTable.create({
			fileName: "bad-event",
			data: {
				"Start Date": "not-a-date",
				Title: "Bad Event",
			},
		});

		await vi.waitFor(() => expect(mockParser.parseEventSource).toHaveBeenCalled());

		// Event should not be cached
		expect(eventStore.getEventByPath("Events/bad-event.md")).toBeNull();
	});
});
