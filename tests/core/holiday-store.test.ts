/**
 * HolidayStore — caching, config-change detection, range queries, storage.
 *
 * The store wraps a HolidayProvider with two layers of cache (in-memory and
 * app.localStorage), and signals callers via updateConfig() whether a change
 * warrants a virtual-event refresh. We swap the real DateHolidaysProvider for
 * a stub so tests are deterministic and don't pull in date-holidays' data.
 */
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HolidayStore } from "../../src/core/holidays/holiday-store";
import type { HolidayConfig, HolidayEvent, HolidayProvider } from "../../src/core/holidays/types";

function createStorageBackedApp() {
	const storage = new Map<string, string>();
	return {
		app: {
			loadLocalStorage: vi.fn(async (key: string) => storage.get(key) ?? null),
			saveLocalStorage: vi.fn((key: string, value: string) => {
				storage.set(key, value);
			}),
		} as any,
		storage,
	};
}

function baseConfig(overrides: Partial<HolidayConfig> = {}): HolidayConfig {
	return {
		enabled: true,
		country: "US",
		types: ["public"],
		...overrides,
	};
}

function holiday(date: string, name: string): HolidayEvent {
	return {
		date,
		name,
		type: "public",
		id: `${name}-${date}`,
	};
}

function installStubProvider(store: HolidayStore, list: (year: number) => Promise<HolidayEvent[]>): HolidayProvider {
	const provider: HolidayProvider = { list };
	(store as unknown as { provider: HolidayProvider }).provider = provider;
	return provider;
}

describe("HolidayStore", () => {
	let app: ReturnType<typeof createStorageBackedApp>["app"];
	let storage: Map<string, string>;
	let store: HolidayStore;
	let listSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		const env = createStorageBackedApp();
		app = env.app;
		storage = env.storage;
		store = new HolidayStore(app, baseConfig());
		listSpy = vi.fn(async (year: number) => [holiday(`${year}-01-01`, "New Year's Day")]);
		installStubProvider(store, listSpy);
	});

	afterEach(() => {
		store.clear();
	});

	describe("getHolidays", () => {
		it("returns [] when disabled, without consulting the provider", async () => {
			store.updateConfig(baseConfig({ enabled: false }));
			installStubProvider(store, listSpy);

			const result = await store.getHolidays(2026);

			expect(result).toEqual([]);
			expect(listSpy).not.toHaveBeenCalled();
		});

		it("caches per year — second call hits the in-memory cache", async () => {
			await store.getHolidays(2026);
			await store.getHolidays(2026);

			expect(listSpy).toHaveBeenCalledTimes(1);
		});

		it("queries the provider once per distinct year", async () => {
			await store.getHolidays(2026);
			await store.getHolidays(2027);
			await store.getHolidays(2026);

			expect(listSpy).toHaveBeenCalledTimes(2);
			expect(listSpy.mock.calls.map((c) => c[0])).toEqual([2026, 2027]);
		});

		it("persists fetched results to local storage", async () => {
			await store.getHolidays(2026);

			expect(app.saveLocalStorage).toHaveBeenCalledTimes(1);
			const [, payload] = app.saveLocalStorage.mock.calls[0];
			const parsed = JSON.parse(payload as string) as { year: number; events: HolidayEvent[] };
			expect(parsed.year).toBe(2026);
			expect(parsed.events).toHaveLength(1);
		});

		it("hydrates from local storage instead of calling the provider on a cold instance", async () => {
			storage.set(
				"holiday-cache:US:::2026",
				JSON.stringify({
					year: 2026,
					events: [holiday("2026-07-04", "Cached Holiday")],
					timestamp: Date.now(),
				})
			);

			const result = await store.getHolidays(2026);

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Cached Holiday");
			expect(listSpy).not.toHaveBeenCalled();
		});

		it("ignores stored cache older than 30 days and refetches", async () => {
			const ancient = Date.now() - 31 * 24 * 60 * 60 * 1000;
			storage.set(
				"holiday-cache:US:::2026",
				JSON.stringify({
					year: 2026,
					events: [holiday("2026-07-04", "Stale Holiday")],
					timestamp: ancient,
				})
			);

			const result = await store.getHolidays(2026);

			expect(listSpy).toHaveBeenCalledOnce();
			expect(result[0].name).toBe("New Year's Day");
		});
	});

	describe("updateConfig", () => {
		it("returns false when nothing material changed", () => {
			const changed = store.updateConfig(baseConfig());
			expect(changed).toBe(false);
		});

		it("returns true when enabled flips", () => {
			expect(store.updateConfig(baseConfig({ enabled: false }))).toBe(true);
		});

		it("returns true when country changes", () => {
			expect(store.updateConfig(baseConfig({ country: "DE" }))).toBe(true);
		});

		it("returns true when types array contents change", () => {
			expect(store.updateConfig(baseConfig({ types: ["public", "bank"] }))).toBe(true);
		});

		it("clears the in-memory cache when config changes so subsequent reads refetch", async () => {
			await store.getHolidays(2026);
			expect(listSpy).toHaveBeenCalledTimes(1);

			store.updateConfig(baseConfig({ country: "DE" }));
			installStubProvider(store, listSpy);

			await store.getHolidays(2026);
			expect(listSpy).toHaveBeenCalledTimes(2);
		});

		it("does NOT clear the cache when the call was a no-op", async () => {
			await store.getHolidays(2026);
			store.updateConfig(baseConfig());

			await store.getHolidays(2026);
			expect(listSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("getHolidaysForRange", () => {
		it("returns [] when disabled", async () => {
			store.updateConfig(baseConfig({ enabled: false }));
			const result = await store.getHolidaysForRange(DateTime.fromISO("2026-01-01"), DateTime.fromISO("2026-12-31"));
			expect(result).toEqual([]);
		});

		it("queries every year that the range spans", async () => {
			listSpy.mockImplementation(async (year: number) => [holiday(`${year}-06-15`, `Mid ${year}`)]);

			await store.getHolidaysForRange(DateTime.fromISO("2025-11-01"), DateTime.fromISO("2027-02-01"));

			expect(listSpy.mock.calls.map((c) => c[0]).sort()).toEqual([2025, 2026, 2027]);
		});

		it("filters out holidays outside the requested range and converts them to CalendarEvents", async () => {
			listSpy.mockImplementation(async (year: number) => [
				holiday(`${year}-01-01`, "New Year"),
				holiday(`${year}-07-04`, "Mid Year"),
				holiday(`${year}-12-25`, "Year End"),
			]);

			const events = await store.getHolidaysForRange(DateTime.fromISO("2026-06-01"), DateTime.fromISO("2026-08-01"));

			expect(events).toHaveLength(1);
			expect(events[0].title).toBe("Mid Year");
			expect(events[0].allDay).toBe(true);
			expect(events[0].virtualKind).toBe("holiday");
			expect(events[0].ref.filePath).toMatch(/^holiday:/);
		});
	});

	describe("clear", () => {
		it("evicts the in-memory cache so the next read refetches", async () => {
			await store.getHolidays(2026);
			store.clear();
			await store.getHolidays(2026);

			// Storage cache also persisted the first fetch, so the refetch may load
			// from storage rather than the provider — assert the in-memory eviction
			// at least caused another read attempt past in-memory.
			expect(app.loadLocalStorage).toHaveBeenCalledTimes(2);
		});
	});
});
