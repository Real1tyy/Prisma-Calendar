import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type EventQuery, EventStore } from "../../src/core/event-store";
import type { IndexerEvent } from "../../src/core/indexer";
import type { ParsedEvent } from "../../src/core/parser";

describe("EventStore", () => {
	let eventStore: EventStore;
	let mockIndexer: any;
	let mockParser: any;
	let mockRecurringEventManager: any;
	let eventsSubject: Subject<IndexerEvent>;

	beforeEach(() => {
		eventsSubject = new Subject<IndexerEvent>();
		mockIndexer = {
			events$: eventsSubject.asObservable(),
		};
		mockParser = {
			parseEventSource: vi.fn(),
		};
		mockRecurringEventManager = {
			generateAllVirtualInstances: vi.fn().mockResolvedValue([]),
		};
		eventStore = new EventStore(mockIndexer, mockParser, mockRecurringEventManager);
	});

	const createMockEvent = (overrides: Partial<ParsedEvent> = {}): ParsedEvent => ({
		id: "test-event-1",
		ref: { filePath: "Events/meeting.md" },
		title: "Test Meeting",
		start: "2024-01-15T10:00:00.000Z",
		end: "2024-01-15T11:00:00.000Z",
		allDay: false,
		isVirtual: false,
		skipped: false,
		color: undefined,
		meta: {
			folder: "Events",
			originalStart: "2024-01-15 10:00",
			originalEnd: "2024-01-15 11:00",
		},
		...overrides,
	});

	describe("event caching", () => {
		it("should update existing cached events", async () => {
			const event1 = createMockEvent({ title: "Original Title" });
			const event2 = createMockEvent({ title: "Updated Title" });

			eventStore.updateEvent("Events/meeting.md", event1, 1642204800000);
			eventStore.updateEvent("Events/meeting.md", event2, 1642204801000);

			const query: EventQuery = {
				start: "2024-01-15T00:00:00.000Z",
				end: "2024-01-16T00:00:00.000Z",
			};

			const events = await eventStore.getEvents(query);
			expect(events).toHaveLength(1);
			expect(events[0].title).toBe("Updated Title");
		});

		it("should check if events are up to date", () => {
			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event, 1642204800000);

			expect(eventStore.isUpToDate("Events/meeting.md", 1642204800000)).toBe(true);
			expect(eventStore.isUpToDate("Events/meeting.md", 1642204801000)).toBe(false);
			expect(eventStore.isUpToDate("Events/other.md", 1642204800000)).toBe(false);
		});
	});

	describe("event querying", () => {
		beforeEach(() => {
			// Set up some test events
			const event1 = createMockEvent({
				id: "event-1",
				title: "Morning Meeting",
				start: "2024-01-15T09:00:00.000Z",
				end: "2024-01-15T10:00:00.000Z",
			});

			const event2 = createMockEvent({
				id: "event-2",
				title: "Lunch Break",
				start: "2024-01-15T12:00:00.000Z",
				end: "2024-01-15T13:00:00.000Z",
			});

			const event3 = createMockEvent({
				id: "event-3",
				title: "Afternoon Meeting",
				start: "2024-01-16T14:00:00.000Z",
				end: "2024-01-16T15:00:00.000Z",
			});

			const allDayEvent = createMockEvent({
				id: "event-4",
				title: "Holiday",
				start: "2024-01-17T00:00:00.000Z",
				end: "2024-01-17T23:59:59.999Z",
				allDay: true,
			});

			eventStore.updateEvent("Events/meeting1.md", event1, 1642204800000);
			eventStore.updateEvent("Events/lunch.md", event2, 1642204800001);
			eventStore.updateEvent("Events/meeting2.md", event3, 1642204800002);
			eventStore.updateEvent("Events/holiday.md", allDayEvent, 1642204800003);
		});

		it("should return events within date range", async () => {
			const query: EventQuery = {
				start: "2024-01-15T00:00:00.000Z",
				end: "2024-01-16T00:00:00.000Z",
			};

			const events = await eventStore.getEvents(query);

			expect(events).toHaveLength(2);
			expect(events.map((e: any) => e.title)).toEqual(["Morning Meeting", "Lunch Break"]);
		});

		it("should return events sorted by start time", async () => {
			const query: EventQuery = {
				start: "2024-01-15T00:00:00.000Z",
				end: "2024-01-17T00:00:00.000Z",
			};

			const events = await eventStore.getEvents(query);

			expect(events).toHaveLength(3);

			// Should be sorted by start time
			const titles = events.map((e: any) => e.title);
			expect(titles).toEqual(["Morning Meeting", "Lunch Break", "Afternoon Meeting"]);
		});

		it("should handle partial overlaps", async () => {
			const query: EventQuery = {
				start: "2024-01-15T09:30:00.000Z", // Middle of first event
				end: "2024-01-15T12:30:00.000Z", // Middle of second event
			};

			const events = await eventStore.getEvents(query);

			expect(events).toHaveLength(2);
			expect(events.map((e: any) => e.title)).toEqual(["Morning Meeting", "Lunch Break"]);
		});

		it("should return empty array for non-matching date range", async () => {
			const query: EventQuery = {
				start: "2024-01-20T00:00:00.000Z",
				end: "2024-01-21T00:00:00.000Z",
			};

			const events = await eventStore.getEvents(query);

			expect(events).toHaveLength(0);
		});

		it("should handle invalid date ranges gracefully", async () => {
			const query: EventQuery = {
				start: "invalid-date",
				end: "2024-01-16T00:00:00.000Z",
			};

			const events = await eventStore.getEvents(query);

			expect(events).toHaveLength(0);
		});
	});

	describe("RxJS subscriptions", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should notify subscribers when events are updated", () => {
			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event, 1642204800000);

			// Advance time to trigger debounced notification
			vi.advanceTimersByTime(150);

			expect(subscriber).toHaveBeenCalled();
			subscription.unsubscribe();
		});

		it("should notify subscribers when events are invalidated", () => {
			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event, 1642204800000);
			vi.advanceTimersByTime(150);

			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			eventStore.invalidate("Events/meeting.md");
			vi.advanceTimersByTime(150);

			expect(subscriber).toHaveBeenCalled();
			subscription.unsubscribe();
		});

		it("should notify subscribers when cache is cleared", () => {
			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event, 1642204800000);

			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			eventStore.clear();

			expect(subscriber).toHaveBeenCalled();
			subscription.unsubscribe();
		});

		it("should not notify subscribers when invalidating non-existent events", () => {
			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			eventStore.invalidate("Events/non-existent.md");
			vi.advanceTimersByTime(150);

			expect(subscriber).not.toHaveBeenCalled();
			subscription.unsubscribe();
		});

		it("should allow multiple subscribers", () => {
			const subscriber1 = vi.fn();
			const subscriber2 = vi.fn();

			const subscription1 = eventStore.subscribe(subscriber1);
			const subscription2 = eventStore.subscribe(subscriber2);

			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event, 1642204800000);
			vi.advanceTimersByTime(150);

			expect(subscriber1).toHaveBeenCalled();
			expect(subscriber2).toHaveBeenCalled();

			subscription1.unsubscribe();
			subscription2.unsubscribe();
		});

		it("should stop notifying after unsubscribe", () => {
			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event, 1642204800000);
			vi.advanceTimersByTime(150);

			expect(subscriber).toHaveBeenCalledTimes(1);

			subscription.unsubscribe();
			eventStore.updateEvent("Events/meeting2.md", event, 1642204800001);
			vi.advanceTimersByTime(150);

			// Should still be 1, not called again after unsubscribe
			expect(subscriber).toHaveBeenCalledTimes(1);
		});

		it("should handle multiple subscribers correctly", () => {
			const subscriber1 = vi.fn();
			const subscriber2 = vi.fn();

			const subscription1 = eventStore.subscribe(subscriber1);
			const subscription2 = eventStore.subscribe(subscriber2);

			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event, 1642204800000);
			vi.advanceTimersByTime(150);

			expect(subscriber1).toHaveBeenCalled();
			expect(subscriber2).toHaveBeenCalled();

			subscription1.unsubscribe();
			subscription2.unsubscribe();
		});

		it("should provide access to changes$ observable", () => {
			expect(eventStore.changes$).toBeDefined();
			expect(typeof eventStore.changes$.subscribe).toBe("function");
		});
	});

	describe("data structure integrity", () => {
		it("should convert ParsedEvent to VaultEvent correctly", async () => {
			const parsedEvent = createMockEvent({
				id: "test-1",
				title: "Test Event",
				start: "2024-01-15T10:00:00.000Z",
				end: "2024-01-15T11:00:00.000Z",
				allDay: false,
				color: "#ff0000",
				meta: { folder: "Events" },
			});

			eventStore.updateEvent("Events/test.md", parsedEvent, 1642204800000);

			const query: EventQuery = {
				start: "2024-01-15T00:00:00.000Z",
				end: "2024-01-16T00:00:00.000Z",
			};

			const events = await eventStore.getEvents(query);
			const event = events[0];

			expect(event.id).toBe("test-1");
			expect(event.title).toBe("Test Event");
			expect(event.start).toBe("2024-01-15T10:00:00.000Z");
			expect(event.end).toBe("2024-01-15T11:00:00.000Z");
			expect(event.allDay).toBe(false);
			expect(event.color).toBe("#ff0000");
			expect(event.meta).toEqual({ folder: "Events" });
		});
	});
});
