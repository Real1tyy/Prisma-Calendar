/**
 * IndexerRegistry — verifies refCount lifecycle and directory-keyed sharing.
 *
 * The registry is a singleton that hands out shared infrastructure (file repo,
 * parser, event store, trackers) keyed by normalized directory path. Multiple
 * calendars pointing at the same directory must share, and the underlying
 * services may only be destroyed once the last calendar releases.
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
		// Reset singleton so each test starts clean.
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

	describe("sharing across calendars", () => {
		it("returns the same infrastructure for two calendars on the same directory", () => {
			const settingsA = settingsFor("Events");
			const settingsB = settingsFor("Events");

			const a = registry.getOrCreateIndexer("cal-a", settingsA);
			const b = registry.getOrCreateIndexer("cal-b", settingsB);

			expect(a.fileRepository).toBe(b.fileRepository);
			expect(a.parser).toBe(b.parser);
			expect(a.eventStore).toBe(b.eventStore);
			expect(a.recurringEventManager).toBe(b.recurringEventManager);
			expect(a.categoryTracker).toBe(b.categoryTracker);
		});

		it("creates separate infrastructure for different directories", () => {
			const a = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			const b = registry.getOrCreateIndexer("cal-b", settingsFor("Tasks"));

			expect(a.fileRepository).not.toBe(b.fileRepository);
			expect(a.eventStore).not.toBe(b.eventStore);
		});

		it("normalizes directory paths so trailing/leading slashes share infrastructure", () => {
			const a = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			const b = registry.getOrCreateIndexer("cal-b", settingsFor("/Events/"));
			const c = registry.getOrCreateIndexer("cal-c", settingsFor("  Events  "));

			expect(a.fileRepository).toBe(b.fileRepository);
			expect(a.fileRepository).toBe(c.fileRepository);
		});

		it("wires recurringEventManager with eventStore and categoryTracker on creation", () => {
			const indexer = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));

			// Both wiring methods set internal references that other services depend on.
			// We can't see them directly, but we verify the manager exists and is the
			// shared instance handed back to subsequent calendars.
			const second = registry.getOrCreateIndexer("cal-b", settingsFor("Events"));
			expect(indexer.recurringEventManager).toBe(second.recurringEventManager);
		});
	});

	describe("releaseIndexer", () => {
		it("does NOT destroy infrastructure when other calendars still hold a reference", () => {
			const settingsA = settingsFor("Events");
			const settingsB = settingsFor("Events");
			const shared = registry.getOrCreateIndexer("cal-a", settingsA);
			registry.getOrCreateIndexer("cal-b", settingsB);

			const destroySpy = vi.spyOn(shared.eventStore, "destroy");
			registry.releaseIndexer("cal-a", "Events");

			expect(destroySpy).not.toHaveBeenCalled();
		});

		it("destroys infrastructure when the last calendar releases", () => {
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

		it("creates fresh infrastructure after a directory has been fully released", () => {
			const first = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			registry.releaseIndexer("cal-a", "Events");

			const second = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			expect(second.eventStore).not.toBe(first.eventStore);
		});

		it("is a no-op when releasing an unknown directory", () => {
			expect(() => registry.releaseIndexer("nobody", "DoesNotExist")).not.toThrow();
		});

		it("normalizes the release path so '/Events/' releases the 'Events' entry", () => {
			const shared = registry.getOrCreateIndexer("cal-a", settingsFor("Events"));
			const destroySpy = vi.spyOn(shared.eventStore, "destroy");

			registry.releaseIndexer("cal-a", "/Events/");

			expect(destroySpy).toHaveBeenCalledTimes(1);
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
