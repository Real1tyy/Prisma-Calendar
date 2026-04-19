import { BehaviorSubject, Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type EventQuery, EventStore } from "../../src/core/event-store";
import type { CalendarEvent } from "../../src/types/calendar";
import type { IndexerEvent, RawEventSource } from "../../src/types/event-source";
import { createMockAllDayEvent, createMockTimedEvent, createRawEventSource } from "../fixtures";
import { createMockSingleCalendarSettingsStore } from "../setup";

describe("EventStore", () => {
	let eventStore: EventStore;
	let mockIndexer: any;
	let mockParser: any;
	let mockRecurringEventManager: any;
	let eventsSubject: Subject<IndexerEvent>;
	let indexingCompleteSubject: BehaviorSubject<boolean>;

	beforeEach(() => {
		eventsSubject = new Subject<IndexerEvent>();
		indexingCompleteSubject = new BehaviorSubject<boolean>(false);
		mockIndexer = {
			events$: eventsSubject.asObservable(),
			indexingComplete$: indexingCompleteSubject.asObservable(),
		};
		mockParser = {
			parseEventSource: vi.fn(),
		};
		mockRecurringEventManager = {
			generateAllVirtualInstances: vi.fn().mockReturnValue([]),
		};
		eventStore = new EventStore(
			mockIndexer,
			mockParser,
			mockRecurringEventManager,
			createMockSingleCalendarSettingsStore()
		);
	});

	const createMockEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => {
		const allDay = overrides?.allDay ?? false;
		const baseOverrides = {
			id: "test-event-1",
			ref: { filePath: "Events/meeting.md" },
			title: "Test Meeting",
			start: "2024-01-15T10:00:00",
			meta: {
				folder: "Events",
				originalStart: "2024-01-15 10:00",
				originalEnd: "2024-01-15 11:00",
			},
			...overrides,
		};

		if (allDay) {
			return createMockAllDayEvent(baseOverrides);
		}

		return createMockTimedEvent({
			...baseOverrides,
			end: ((overrides as any).end as string) ?? "2024-01-15T11:00:00",
		});
	};

	describe("event caching", () => {
		it("should update existing cached events", async () => {
			const event1 = createMockEvent({ title: "Original Title" });
			const event2 = createMockEvent({ title: "Updated Title" });

			eventStore.updateEvent("Events/meeting.md", event1);
			eventStore.updateEvent("Events/meeting.md", event2);

			const query: EventQuery = {
				start: "2024-01-15T00:00:00",
				end: "2024-01-16T00:00:00",
			};

			const events = await eventStore.getEvents(query);
			expect(events).toHaveLength(1);
			expect(events[0].title).toBe("Updated Title");
		});
	});

	describe("indexer event handling", () => {
		it("rebuilds the cached event when a file-changed event arrives with the same mtime but different frontmatter", async () => {
			// Regression: `app.fileManager.processFrontMatter` can rewrite a file's
			// frontmatter without bumping mtime. Bulk category renames trigger
			// exactly that — the VaultTable layer now emits a row-updated event
			// in this case, but EventStore's mtime-based early return used to
			// swallow the resulting file-changed event, so the calendar kept
			// rendering the old category name and color.
			const filePath = "Events/meeting.md";
			const sharedMtime = 1642204800000;

			mockParser.parseEventSource.mockImplementation((source: RawEventSource) =>
				createMockTimedEvent({
					id: filePath,
					ref: { filePath },
					title: "Team Meeting",
					start: "2024-01-15T10:00:00",
					end: "2024-01-15T11:00:00",
					meta: { ...source.frontmatter, folder: "Events" },
				})
			);

			eventsSubject.next({
				type: "file-changed",
				filePath,
				source: createRawEventSource({
					filePath,
					mtime: sharedMtime,
					folder: "Events",
					frontmatter: { Category: "Work" },
				}),
			});

			eventsSubject.next({
				type: "file-changed",
				filePath,
				source: createRawEventSource({
					filePath,
					mtime: sharedMtime,
					folder: "Events",
					frontmatter: { Category: "Job" },
				}),
			});

			const query: EventQuery = {
				start: "2024-01-15T00:00:00",
				end: "2024-01-16T00:00:00",
			};

			const events = await eventStore.getEvents(query);
			expect(events).toHaveLength(1);
			expect(events[0].meta).toMatchObject({ Category: "Job" });
		});
	});

	describe("event querying", () => {
		beforeEach(() => {
			// Set up some test events
			const event1 = createMockEvent({
				id: "event-1",
				title: "Morning Meeting",
				start: "2024-01-15T09:00:00",
				end: "2024-01-15T10:00:00",
			});

			const event2 = createMockEvent({
				id: "event-2",
				title: "Lunch Break",
				start: "2024-01-15T12:00:00",
				end: "2024-01-15T13:00:00",
			});

			const event3 = createMockEvent({
				id: "event-3",
				title: "Afternoon Meeting",
				start: "2024-01-16T14:00:00",
				end: "2024-01-16T15:00:00",
			});

			const allDayEvent = createMockEvent({
				id: "event-4",
				title: "Holiday",
				start: "2024-01-17T00:00:00",
				allDay: true,
			});

			eventStore.updateEvent("Events/meeting1.md", event1);
			eventStore.updateEvent("Events/lunch.md", event2);
			eventStore.updateEvent("Events/meeting2.md", event3);
			eventStore.updateEvent("Events/holiday.md", allDayEvent);
		});

		it("should return events within date range", async () => {
			const query: EventQuery = {
				start: "2024-01-15T00:00:00",
				end: "2024-01-16T00:00:00",
			};

			const events = await eventStore.getEvents(query);

			expect(events).toHaveLength(2);
			expect(events.map((e: any) => e.title)).toEqual(["Morning Meeting", "Lunch Break"]);
		});

		it("should return events sorted by start time", async () => {
			const query: EventQuery = {
				start: "2024-01-15T00:00:00",
				end: "2024-01-17T00:00:00",
			};

			const events = await eventStore.getEvents(query);

			expect(events).toHaveLength(3);

			// Should be sorted by start time
			const titles = events.map((e: any) => e.title);
			expect(titles).toEqual(["Morning Meeting", "Lunch Break", "Afternoon Meeting"]);
		});

		it("should handle partial overlaps", async () => {
			const query: EventQuery = {
				start: "2024-01-15T09:30:00", // Middle of first event
				end: "2024-01-15T12:30:00", // Middle of second event
			};

			const events = await eventStore.getEvents(query);

			expect(events).toHaveLength(2);
			expect(events.map((e: any) => e.title)).toEqual(["Morning Meeting", "Lunch Break"]);
		});

		it("should return empty array for non-matching date range", async () => {
			const query: EventQuery = {
				start: "2024-01-20T00:00:00",
				end: "2024-01-21T00:00:00",
			};

			const events = await eventStore.getEvents(query);

			expect(events).toHaveLength(0);
		});

		it("should handle invalid date ranges gracefully", async () => {
			const query: EventQuery = {
				start: "invalid-date",
				end: "2024-01-16T00:00:00",
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
			eventStore.updateEvent("Events/meeting.md", event);

			// Advance time to trigger debounced notification
			vi.advanceTimersByTime(150);

			expect(subscriber).toHaveBeenCalled();
			subscription.unsubscribe();
		});

		it("should notify subscribers when events are invalidated", () => {
			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event);
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
			eventStore.updateEvent("Events/meeting.md", event);

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
			eventStore.updateEvent("Events/meeting.md", event);
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
			eventStore.updateEvent("Events/meeting.md", event);
			vi.advanceTimersByTime(150);

			expect(subscriber).toHaveBeenCalledTimes(1);

			subscription.unsubscribe();
			eventStore.updateEvent("Events/meeting2.md", event);
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
			eventStore.updateEvent("Events/meeting.md", event);
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
				start: "2024-01-15T10:00:00",
				end: "2024-01-15T11:00:00",
				allDay: false,
				color: "#ff0000",
				meta: { folder: "Events" },
			});

			eventStore.updateEvent("Events/test.md", parsedEvent);

			const query: EventQuery = {
				start: "2024-01-15T00:00:00",
				end: "2024-01-16T00:00:00",
			};

			const events = await eventStore.getEvents(query);
			const event = events[0];

			expect(event.id).toBe("test-1");
			expect(event.title).toBe("Test Event");
			expect(event.start).toBe("2024-01-15T10:00:00");
			if (event.type === "timed") {
				expect(event.end).toBe("2024-01-15T11:00:00");
			}
			expect(event.allDay).toBe(false);
			expect(event.color).toBe("#ff0000");
			expect(event.meta).toEqual({ folder: "Events" });
		});
	});

	describe("Notification on Indexing Complete", () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		afterEach(() => {
			vi.useRealTimers();
		});

		it("should flush pending debounced refresh when indexing completes", () => {
			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			// Add multiple events rapidly (would normally be debounced)
			const event1 = createMockEvent({ id: "event-1", title: "Event 1" });
			const event2 = createMockEvent({ id: "event-2", title: "Event 2" });
			const event3 = createMockEvent({ id: "event-3", title: "Event 3" });

			eventStore.updateEvent("Events/event1.md", event1);
			eventStore.updateEvent("Events/event2.md", event2);
			eventStore.updateEvent("Events/event3.md", event3);

			// Without indexing complete, notifications would be debounced
			// Advance time only slightly (less than debounce timeout)
			vi.advanceTimersByTime(50);

			// Should not have been called yet due to debouncing
			expect(subscriber).not.toHaveBeenCalled();

			// Trigger indexing complete
			indexingCompleteSubject.next(true);

			// Should be notified immediately without waiting for full debounce
			expect(subscriber).toHaveBeenCalled();

			subscription.unsubscribe();
		});

		it("should only flush if there is a pending refresh", () => {
			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			// Trigger indexing complete without any pending changes
			indexingCompleteSubject.next(true);

			// Should not notify if there's nothing pending
			expect(subscriber).not.toHaveBeenCalled();

			subscription.unsubscribe();
		});

		it("should handle multiple indexing complete events", () => {
			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			// First batch of events
			const event1 = createMockEvent({ id: "event-1" });
			eventStore.updateEvent("Events/event1.md", event1);

			// First indexing complete
			indexingCompleteSubject.next(true);
			expect(subscriber).toHaveBeenCalledTimes(1);

			subscriber.mockClear();

			// Second batch of events
			const event2 = createMockEvent({ id: "event-2" });
			eventStore.updateEvent("Events/event2.md", event2);

			// Second indexing complete
			indexingCompleteSubject.next(true);
			expect(subscriber).toHaveBeenCalledTimes(1);

			subscription.unsubscribe();
		});

		it("should work correctly with debounced updates after indexing completes", () => {
			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			// Add events rapidly
			for (let i = 0; i < 5; i++) {
				const event = createMockEvent({ id: `event-${i}`, title: `Event ${i}` });
				eventStore.updateEvent(`Events/event${i}.md`, event);
			}

			// Trigger indexing complete - should flush immediately
			indexingCompleteSubject.next(true);
			expect(subscriber).toHaveBeenCalledTimes(1);

			subscriber.mockClear();

			// Add more events after indexing complete
			const newEvent = createMockEvent({ id: "new-event" });
			eventStore.updateEvent("Events/new.md", newEvent);

			// This should follow normal debouncing
			vi.advanceTimersByTime(150);
			expect(subscriber).toHaveBeenCalledTimes(1);

			subscription.unsubscribe();
		});
	});
});
