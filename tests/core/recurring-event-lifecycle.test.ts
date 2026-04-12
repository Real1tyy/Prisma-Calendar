/**
 * Integration coverage for RecurringEventManager's virtual-generation boundary.
 * Focuses on gaps not already covered by recurring-event-manager.test.ts:
 *   - `metadata.skip: true` suppresses all virtual generation (source line 833-836).
 *   - Independent recurring rules don't cross-contaminate.
 *   - Virtuals are clipped to the requested range.
 *   - Physical instances push virtual start forward.
 */
import { DateTime } from "luxon";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RecurringEventManager } from "../../src/core/recurring-event-manager";
import {
	buildRecurringEvent,
	createRecurringIndexer,
	createRecurringManagerApp,
	createRecurringSettingsStore,
	registerRecurringEvent,
} from "../fixtures/recurring-event-fixtures";

const mockGetNextOccurrence = vi.fn();
const mockIsDateOnWeekdays = vi.fn();
const mockIterateOccurrencesInRange = vi.fn();

vi.mock("@real1ty-obsidian-plugins/utils/date-recurrence-utils", async () => {
	const actual = await vi.importActual("@real1ty-obsidian-plugins/utils/date-recurrence-utils");
	return {
		...actual,
		getNextOccurrence: mockGetNextOccurrence,
		isDateOnWeekdays: mockIsDateOnWeekdays,
		iterateOccurrencesInRange: mockIterateOccurrencesInRange,
	};
});

describe("RecurringEventManager — virtual generation boundary", () => {
	let app: ReturnType<typeof createRecurringManagerApp>;
	let indexer: ReturnType<typeof createRecurringIndexer>;
	let settingsStore: ReturnType<typeof createRecurringSettingsStore>;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {});

		app = createRecurringManagerApp();
		indexer = createRecurringIndexer();
		settingsStore = createRecurringSettingsStore();

		mockGetNextOccurrence.mockImplementation((currentDate: DateTime) => currentDate.plus({ weeks: 1 }));
		mockIsDateOnWeekdays.mockReturnValue(true);
		mockIterateOccurrencesInRange.mockImplementation(function* (
			startDate: DateTime,
			_rrules: unknown,
			rangeStart: DateTime,
			rangeEnd: DateTime
		) {
			let cursor = startDate;
			for (let i = 0; i < 20; i++) {
				cursor = cursor.plus({ weeks: 1 });
				if (cursor > rangeEnd) break;
				if (cursor >= rangeStart) yield cursor;
			}
		});
	});

	function createManager() {
		return new RecurringEventManager(app as any, settingsStore as any, indexer as any, null);
	}

	describe("skip metadata suppresses virtual generation", () => {
		it("returns no virtuals when metadata.skip is true", async () => {
			const manager = createManager();
			await registerRecurringEvent(manager, buildRecurringEvent({ skip: true }));

			const virtuals = await manager.generateAllVirtualInstances(
				DateTime.fromISO("2024-01-01"),
				DateTime.fromISO("2024-06-01")
			);

			expect(virtuals).toEqual([]);
		});

		it("returns virtuals when metadata.skip is false", async () => {
			const manager = createManager();
			await registerRecurringEvent(manager, buildRecurringEvent({ skip: false }));

			const virtuals = await manager.generateAllVirtualInstances(
				DateTime.fromISO("2024-01-01"),
				DateTime.fromISO("2024-02-15")
			);

			expect(virtuals.length).toBeGreaterThan(0);
		});
	});

	describe("multiple recurring rules in parallel", () => {
		it("generates virtuals for each rule independently", async () => {
			const manager = createManager();
			await registerRecurringEvent(
				manager,
				buildRecurringEvent({ rRuleId: "series-a", title: "Standup", startISO: "2024-01-01T09:00:00" })
			);
			await registerRecurringEvent(
				manager,
				buildRecurringEvent({ rRuleId: "series-b", title: "Review", startISO: "2024-01-02T14:00:00" })
			);

			const virtuals = await manager.generateAllVirtualInstances(
				DateTime.fromISO("2024-01-01"),
				DateTime.fromISO("2024-02-01")
			);

			const titles = new Set(virtuals.map((v) => v.title));
			expect(titles.has("Standup")).toBe(true);
			expect(titles.has("Review")).toBe(true);
		});

		it("a skipped rule does not suppress a sibling rule's virtuals", async () => {
			const manager = createManager();
			await registerRecurringEvent(manager, buildRecurringEvent({ rRuleId: "active", title: "Active", skip: false }));
			await registerRecurringEvent(
				manager,
				buildRecurringEvent({ rRuleId: "disabled", title: "Disabled", skip: true })
			);

			const virtuals = await manager.generateAllVirtualInstances(
				DateTime.fromISO("2024-01-01"),
				DateTime.fromISO("2024-02-01")
			);

			expect(virtuals.length).toBeGreaterThan(0);
			expect(virtuals.every((v) => v.title === "Active")).toBe(true);
		});
	});

	describe("range clipping", () => {
		it("does not return virtuals outside the requested range", async () => {
			const manager = createManager();
			await registerRecurringEvent(manager, buildRecurringEvent({ startISO: "2024-01-01T10:00:00" }));

			const rangeStart = DateTime.fromISO("2024-03-01");
			const rangeEnd = DateTime.fromISO("2024-03-31");

			const virtuals = await manager.generateAllVirtualInstances(rangeStart, rangeEnd);

			for (const v of virtuals) {
				const start = DateTime.fromISO(v.start);
				expect(start >= rangeStart).toBe(true);
				expect(start <= rangeEnd).toBe(true);
			}
		});

		it("returns empty when the range is entirely before the recurrence start", async () => {
			const manager = createManager();
			await registerRecurringEvent(manager, buildRecurringEvent({ startISO: "2024-06-01T10:00:00" }));

			const virtuals = await manager.generateAllVirtualInstances(
				DateTime.fromISO("2023-01-01"),
				DateTime.fromISO("2023-12-31")
			);

			expect(virtuals).toEqual([]);
		});
	});

	describe("physical instance boundary", () => {
		it("starts virtuals after the latest known physical instance", async () => {
			const manager = createManager();
			await registerRecurringEvent(manager, buildRecurringEvent({ rRuleId: "weekly-sync" }));

			await (manager as any).handleFileChanged("Calendar/weekly-sync 2024-01-22.md", {
				rruleId: "weekly-sync",
				instanceDate: "2024-01-22",
			});

			const virtuals = await manager.generateAllVirtualInstances(
				DateTime.fromISO("2024-01-01"),
				DateTime.fromISO("2024-03-01")
			);

			for (const v of virtuals) {
				const instanceDate = DateTime.fromISO(v.start).toISODate();
				expect(instanceDate).not.toBe("2024-01-22");
				expect(DateTime.fromISO(v.start) > DateTime.fromISO("2024-01-22")).toBe(true);
			}
		});
	});
});
