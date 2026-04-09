import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventStore } from "../../src/core/event-store";
import type { CalendarEvent } from "../../src/types/calendar";
import type { IndexerEvent } from "../../src/types/event-source";
import {
	createMockParser,
	createMockRecurringEventManager,
	createRepoSettings,
	TestableEventFileRepository,
} from "../fixtures/event-file-repository-fixtures";
import { createMockApp } from "../setup";

describe("Integration: EventFileRepository → EventStore", () => {
	let repo: TestableEventFileRepository;
	let eventStore: EventStore;
	let settingsStore: BehaviorSubject<any>;
	let mockApp: any;
	let mockParser: ReturnType<typeof createMockParser>;

	beforeEach(async () => {
		mockApp = createMockApp();
		settingsStore = new BehaviorSubject(createRepoSettings());
		repo = new TestableEventFileRepository(mockApp, settingsStore);
		mockParser = createMockParser();

		eventStore = new EventStore(repo, mockParser as any, createMockRecurringEventManager() as any, settingsStore);
		await repo.start();
	});

	afterEach(() => {
		eventStore.destroy();
		repo.destroy();
	});

	it("should process a complete event lifecycle: create → update → delete", async () => {
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

		mockParser.parseEventSource.mockClear();
		await repo.mockTable.update("meeting", { Title: "Updated Meeting" });

		await vi.waitFor(() => expect(mockParser.parseEventSource).toHaveBeenCalled());

		await repo.mockTable.delete("meeting");

		await vi.waitFor(() => expect(eventStore.getEventByPath("Events/meeting.md")).toBeNull());

		const ops = repo.mockTable.getOperations();
		expect(ops.map((op: { type: string }) => op.type)).toEqual(["create", "update", "delete"]);
	});

	it("should handle file deletion correctly", async () => {
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

		expect(eventStore.getEventByPath("Events/bad-event.md")).toBeNull();
	});
});
