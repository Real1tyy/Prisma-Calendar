/**
 * Integration coverage for settings → event flow.
 *
 * EventFileRepository reads `settings.skipProp` to set `source.metadata.skip`.
 * Parser propagates that onto `event.skipped`. EventStore then routes the event
 * into the non-skipped or skipped BTree, which determines whether `getEvents()`
 * or `getSkippedEvents()` returns it.
 *
 * These tests verify the full pipeline: frontmatter → metadata → event.skipped →
 * query routing, and that updates and deletes keep the two BTrees in sync.
 */
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EventStore } from "../../src/core/event-store";
import {
	createMockParser,
	createMockRecurringEventManager,
	createRepoSettings,
	createTimedFrontmatter,
	TestableEventFileRepository,
} from "../fixtures/event-file-repository-fixtures";
import { createMockApp } from "../setup";

const RANGE = { start: "2024-06-01T00:00:00", end: "2024-06-30T00:00:00" };

function seedTimed(fileName: string, extras: Record<string, unknown> = {}) {
	return {
		fileName,
		data: createTimedFrontmatter({ Title: fileName, ...extras }),
	};
}

describe("Integration: settings propagation through parser → event-store routing", () => {
	let repo: TestableEventFileRepository;
	let eventStore: EventStore;
	let parser: ReturnType<typeof createMockParser>;
	let settingsStore: BehaviorSubject<ReturnType<typeof createRepoSettings>>;
	let app: ReturnType<typeof createMockApp>;

	beforeEach(async () => {
		app = createMockApp();
		settingsStore = new BehaviorSubject(createRepoSettings({ skipProp: "Skip" }));
		repo = new TestableEventFileRepository(app as any, settingsStore as any);
		parser = createMockParser();

		eventStore = new EventStore(repo, parser as any, createMockRecurringEventManager() as any, settingsStore as any);
		await repo.start();
	});

	afterEach(() => {
		eventStore.destroy();
		repo.destroy();
	});

	it("routes an event with skipProp=true into the skipped BTree, not the default one", async () => {
		await repo.mockTable.create(seedTimed("archived", { Skip: true }));
		await repo.mockTable.create(seedTimed("active"));

		await vi.waitFor(() => expect(parser.parseEventSource).toHaveBeenCalledTimes(2));

		const visible = await eventStore.getEvents(RANGE);
		const hidden = eventStore.getSkippedEvents(RANGE);

		expect(visible.map((e) => e.title)).toEqual(["active"]);
		expect(hidden.map((e) => e.title)).toEqual(["archived"]);
	});

	it("moves an event between BTrees when Skip flag flips on", async () => {
		await repo.mockTable.create(seedTimed("meeting"));
		await vi.waitFor(() => expect(parser.parseEventSource).toHaveBeenCalled());
		expect(await eventStore.getEvents(RANGE)).toHaveLength(1);
		expect(eventStore.getSkippedEvents(RANGE)).toHaveLength(0);

		parser.parseEventSource.mockClear();
		await repo.mockTable.update("meeting", { Skip: true } as Record<string, unknown>);
		await vi.waitFor(() => expect(parser.parseEventSource).toHaveBeenCalled());

		expect(await eventStore.getEvents(RANGE)).toHaveLength(0);
		expect(eventStore.getSkippedEvents(RANGE)).toHaveLength(1);
	});

	it("moves an event back to visible when Skip flips off", async () => {
		await repo.mockTable.create(seedTimed("task", { Skip: true }));
		await vi.waitFor(() => expect(parser.parseEventSource).toHaveBeenCalled());
		expect(eventStore.getSkippedEvents(RANGE)).toHaveLength(1);

		parser.parseEventSource.mockClear();
		await repo.mockTable.update("task", { Skip: false } as Record<string, unknown>);
		await vi.waitFor(() => expect(parser.parseEventSource).toHaveBeenCalled());

		expect(await eventStore.getEvents(RANGE)).toHaveLength(1);
		expect(eventStore.getSkippedEvents(RANGE)).toHaveLength(0);
	});

	it("removes a skipped event from its BTree on delete", async () => {
		await repo.mockTable.create(seedTimed("archived", { Skip: true }));
		await vi.waitFor(() => expect(parser.parseEventSource).toHaveBeenCalled());
		expect(eventStore.getSkippedEvents(RANGE)).toHaveLength(1);

		await repo.mockTable.delete("archived");

		await vi.waitFor(() => expect(eventStore.getSkippedEvents(RANGE)).toHaveLength(0));
		expect(await eventStore.getEvents(RANGE)).toHaveLength(0);
	});

	it("counts skipped events in range without returning the array", async () => {
		await repo.mockTable.create(seedTimed("a", { Skip: true }));
		await repo.mockTable.create(seedTimed("b", { Skip: true }));
		await repo.mockTable.create(seedTimed("c", { Skip: false }));

		await vi.waitFor(() => expect(parser.parseEventSource).toHaveBeenCalledTimes(3));

		expect(eventStore.countSkippedEvents(RANGE)).toBe(2);
	});

	it("returns physical (skipped + non-skipped) via getPhysicalEvents sorted by start", async () => {
		await repo.mockTable.create(
			seedTimed("earlier", {
				"Start Date": "2024-06-15T09:00:00",
				"End Date": "2024-06-15T10:00:00",
				Skip: true,
			})
		);
		await repo.mockTable.create(
			seedTimed("later", {
				"Start Date": "2024-06-15T14:00:00",
				"End Date": "2024-06-15T15:00:00",
			})
		);

		await vi.waitFor(() => expect(parser.parseEventSource).toHaveBeenCalledTimes(2));

		const all = eventStore.getPhysicalEvents(RANGE);
		expect(all.map((e) => e.title)).toEqual(["earlier", "later"]);
	});
});
