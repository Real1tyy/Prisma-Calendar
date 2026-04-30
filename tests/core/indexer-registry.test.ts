/**
 * IndexerRegistry — verifies refCount lifecycle and calendarId-keyed isolation.
 *
 * The registry is a singleton that hands out infrastructure (file repo,
 * parser, event store, trackers) keyed by calendarId. Each calendar gets
 * its own infrastructure regardless of directory, and the underlying
 * services may only be destroyed once the last reference releases.
 */
import type { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IndexerRegistry } from "../../src/core/indexer-registry";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { createRepoSettingsStore } from "../fixtures/event-file-repository-fixtures";
import { createMockApp } from "../setup";

type MockApp = ReturnType<typeof createMockApp>;

function settingsFor(directory: string): BehaviorSubject<SingleCalendarConfig> {
	return createRepoSettingsStore({ directory });
}

describe("IndexerRegistry", () => {
	let app: MockApp;
	let registry: IndexerRegistry;

	beforeEach(() => {
		app = createMockApp();
		IndexerRegistry.getInstance(app as any).destroy();
		registry = IndexerRegistry.getInstance(app as any);
	});

	afterEach(() => {
		registry.destroy();
	});

	describe("singleton", () => {
		it("returns the same instance on repeated calls", () => {
			const a = IndexerRegistry.getInstance(app as any);
			const b = IndexerRegistry.getInstance(app as any);
			expect(a).toBe(b);
		});

		it("re-creates the singleton after destroy()", () => {
			const before = IndexerRegistry.getInstance(app as any);
			before.destroy();
			const after = IndexerRegistry.getInstance(app as any);
			expect(after).not.toBe(before);
		});
	});

	describe("per-calendar isolation", () => {
		it("same directory, different calendarIds get separate infrastructure", () => {
			const settingsA = settingsFor("Events");
			const settingsB = settingsFor("Events");

			const a = registry.getOrCreateIndexer("cal-a", settingsA);
			const b = registry.getOrCreateIndexer("cal-b", settingsB);

			expect(a.fileRepository).not.toBe(b.fileRepository);
			expect(a.parser).not.toBe(b.parser);
			expect(a.eventStore).not.toBe(b.eventStore);
			expect(a.recurringEventManager).not.toBe(b.recurringEventManager);
			expect(a.categoryTracker).not.toBe(b.categoryTracker);
		});

		it("same calendarId returns the same infrastructure", () => {
			const a = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			const b = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));

			expect(a.fileRepository).toBe(b.fileRepository);
			expect(a.parser).toBe(b.parser);
			expect(a.eventStore).toBe(b.eventStore);
			expect(a.recurringEventManager).toBe(b.recurringEventManager);
			expect(a.categoryTracker).toBe(b.categoryTracker);
		});

		it("different calendarIds always get separate infrastructure regardless of directory", () => {
			const a = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			const b = registry.getOrCreateIndexer("cal-b", settingsFor("Tasks"));

			expect(a.fileRepository).not.toBe(b.fileRepository);
			expect(a.eventStore).not.toBe(b.eventStore);
		});

		it("wires recurringEventManager with eventStore and categoryTracker on creation", () => {
			const indexer = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));

			expect(indexer.recurringEventManager).toBeDefined();
			expect(indexer.eventStore).toBeDefined();
			expect(indexer.categoryTracker).toBeDefined();
		});
	});

	describe("releaseIndexer", () => {
		it("does NOT destroy infrastructure when other references still hold", () => {
			const settings = settingsFor("Events");
			const shared = registry.getOrCreateIndexer("cal-a", settings);
			registry.getOrCreateIndexer("cal-a", settings);

			const destroySpy = vi.spyOn(shared.eventStore, "destroy");
			registry.releaseIndexer("cal-a", "Events");

			expect(destroySpy).not.toHaveBeenCalled();
		});

		it("destroys infrastructure when the last reference releases", () => {
			const shared = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));

			const eventStoreDestroy = vi.spyOn(shared.eventStore, "destroy");
			const repoDestroy = vi.spyOn(shared.fileRepository, "destroy");
			const parserDestroy = vi.spyOn(shared.parser, "destroy");
			const trackerDestroy = vi.spyOn(shared.categoryTracker, "destroy");

			registry.releaseIndexer("cal-a", "Events");

			expect(eventStoreDestroy).toHaveBeenCalledTimes(1);
			expect(repoDestroy).toHaveBeenCalledTimes(1);
			expect(parserDestroy).toHaveBeenCalledTimes(1);
			expect(trackerDestroy).toHaveBeenCalledTimes(1);
		});

		it("creates fresh infrastructure after fully released", () => {
			const first = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			registry.releaseIndexer("cal-a", "Events");

			const second = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			expect(second.eventStore).not.toBe(first.eventStore);
		});

		it("is a no-op for unknown calendarId", () => {
			expect(() => registry.releaseIndexer("nobody", "DoesNotExist")).not.toThrow();
		});
	});

	describe("destroy", () => {
		it("destroys every entry and clears the registry", () => {
			const a = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			const b = registry.getOrCreateIndexer("cal-b", settingsFor("Tasks"));
			const aDestroy = vi.spyOn(a.eventStore, "destroy");
			const bDestroy = vi.spyOn(b.eventStore, "destroy");

			registry.destroy();

			expect(aDestroy).toHaveBeenCalledTimes(1);
			expect(bDestroy).toHaveBeenCalledTimes(1);

			// After destroy(), the next getInstance() returns a fresh registry with no entries:
			// re-fetching for the same directory must yield NEW infrastructure.
			const fresh = IndexerRegistry.getInstance(app as any);
			const reborn = fresh.getOrCreateIndexer("cal-a", settingsFor("Events"));
			expect(reborn.eventStore).not.toBe(a.eventStore);
		});
	});
});
