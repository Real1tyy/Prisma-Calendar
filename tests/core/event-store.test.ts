import { Subject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type EventQuery, EventStore } from "../../src/core/event-store";
import type { IndexerEvent } from "../../src/core/indexer";
import type { ParsedEvent } from "../../src/core/parser";
import { MockFixtures, TestScenarios } from "../fixtures/index";

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

	const createMockEvent = (overrides: Partial<ParsedEvent> = {}): ParsedEvent =>
		MockFixtures.parsedEvent(overrides);

	describe("Enhanced Tests", () => {
		it("should handle edge cases gracefully", async () => {
			const edgeCases = TestScenarios.eventEdgeCases();

			for (const event of edgeCases) {
				// Clear and add event
				eventStore.clear();
				eventStore.updateEvent(event.ref.filePath, event, Date.now());

				const result = await eventStore.getEvents({ start: "2024-01-01", end: "2024-12-31" });

				// Should return valid array with events that have string IDs
				expect(Array.isArray(result)).toBe(true);
				expect(result.every((e) => typeof e.id === "string")).toBe(true);
			}
		});

		it("should handle large numbers of events efficiently", async () => {
			const events = Array.from({ length: 100 }, () => MockFixtures.parsedEvent());
			const startTime = performance.now();

			// Clear and add events
			eventStore.clear();
			events.forEach((event, index) => {
				eventStore.updateEvent(event.ref.filePath, event, Date.now() + index);
			});

			const result = await eventStore.getEvents({ start: "2024-01-01", end: "2024-12-31" });
			const endTime = performance.now();

			// Should complete within reasonable time (500ms for 100 events)
			const duration = endTime - startTime;
			expect(duration).toBeLessThan(500);
			expect(Array.isArray(result)).toBe(true);
		});

		it("should maintain event uniqueness by file path", async () => {
			const events = Array.from({ length: 10 }, () => MockFixtures.parsedEvent());

			eventStore.clear();

			// Add events, some with same file paths to test replacement behavior
			events.forEach((event, index) => {
				eventStore.updateEvent(event.ref.filePath, event, Date.now() + index);
				// Add again with later timestamp to test replacement
				eventStore.updateEvent(event.ref.filePath, event, Date.now() + index + 1000);
			});

			const result = await eventStore.getEvents({ start: "2024-01-01", end: "2024-12-31" });
			const filePathCounts = new Map<string, number>();

			result.forEach((event) => {
				const count = filePathCounts.get(event.ref.filePath) || 0;
				filePathCounts.set(event.ref.filePath, count + 1);
			});

			// Should not have duplicate events for same file path
			const counts = Array.from(filePathCounts.values());
			expect(counts.every((count) => count === 1)).toBe(true);
		});
	});

	describe("event caching", () => {
		it("should update existing cached events", async () => {
			const event1 = createMockEvent({
				title: "Original Title",
				start: "2024-01-15T10:00:00Z",
				end: "2024-01-15T11:00:00Z",
			});
			const event2 = createMockEvent({
				title: "Updated Title",
				start: "2024-01-15T10:00:00Z",
				end: "2024-01-15T11:00:00Z",
			});

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

		it("should remove events when files are deleted", async () => {
			const event = createMockEvent({
				start: "2024-01-15T10:00:00Z",
				end: "2024-01-15T11:00:00Z",
			});
			eventStore.updateEvent("Events/meeting.md", event, Date.now());

			// Verify event is added
			let events = await eventStore.getEvents({ start: "2024-01-01", end: "2024-12-31" });
			expect(events).toHaveLength(1);

			// Remove event
			eventStore.invalidate("Events/meeting.md");

			// Verify event is removed
			events = await eventStore.getEvents({ start: "2024-01-01", end: "2024-12-31" });
			expect(events).toHaveLength(0);
		});
	});

	describe("event querying", () => {
		it("should filter events by date range", async () => {
			const event1 = createMockEvent({
				start: "2024-01-15T10:00:00.000Z",
				end: "2024-01-15T11:00:00.000Z",
			});
			const event2 = createMockEvent({
				start: "2024-02-15T10:00:00.000Z",
				end: "2024-02-15T11:00:00.000Z",
			});

			eventStore.updateEvent("Events/event1.md", event1, Date.now());
			eventStore.updateEvent("Events/event2.md", event2, Date.now());

			const query: EventQuery = {
				start: "2024-01-01T00:00:00.000Z",
				end: "2024-01-31T23:59:59.999Z",
			};

			const events = await eventStore.getEvents(query);
			expect(events).toHaveLength(1);
			expect(events[0].start).toBe("2024-01-15T10:00:00.000Z");
		});

		it("should handle empty results gracefully", async () => {
			const query: EventQuery = {
				start: "2025-01-01T00:00:00.000Z",
				end: "2025-01-31T23:59:59.999Z",
			};

			const events = await eventStore.getEvents(query);
			expect(events).toEqual([]);
		});
	});

	describe("subscription management", () => {
		it("should notify subscribers of changes", () => {
			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event, Date.now());

			expect(subscriber).toHaveBeenCalled();
			subscription.unsubscribe();
		});

		it("should handle unsubscribe correctly", () => {
			const subscriber = vi.fn();
			const subscription = eventStore.subscribe(subscriber);

			subscription.unsubscribe();

			const event = createMockEvent();
			eventStore.updateEvent("Events/meeting.md", event, Date.now());

			// Should not be called after unsubscribe
			expect(subscriber).not.toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("should handle invalid events gracefully", () => {
			expect(() => {
				eventStore.updateEvent("invalid-path", null as any, Date.now());
			}).not.toThrow();
		});

		it("should handle malformed queries gracefully", async () => {
			const invalidQuery = { start: "invalid-date", end: "invalid-date" } as any;

			expect(async () => {
				await eventStore.getEvents(invalidQuery);
			}).not.toThrow();
		});
	});

	describe("cleanup", () => {
		it("should cleanup resources when destroyed", () => {
			const subscriber = vi.fn();
			eventStore.subscribe(subscriber);

			eventStore.destroy();

			// Should not crash when trying to update after destroy
			expect(() => {
				const event = createMockEvent();
				eventStore.updateEvent("Events/meeting.md", event, Date.now());
			}).not.toThrow();
		});
	});
});
