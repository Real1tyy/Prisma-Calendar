import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarBundle } from "../../src/core/calendar-bundle";
import type { CalendarEvent } from "../../src/types/calendar";
import type { AggregationMode, Stats } from "../../src/utils/weekly-stats";
import { createMockTimedEvent } from "../fixtures/event-fixtures";
import { createMockSingleCalendarSettings } from "../setup";

const ChartCtor = vi.fn();
const ChartDestroy = vi.fn();
const TableCtor = vi.fn();
const TableDestroy = vi.fn();

vi.mock("../../src/components/weekly-stats/chart-component", () => ({
	ChartComponent: vi.fn().mockImplementation((...args: unknown[]) => {
		ChartCtor(...args);
		return { destroy: ChartDestroy };
	}),
}));

vi.mock("../../src/components/weekly-stats/table-component", () => ({
	TableComponent: vi.fn().mockImplementation((...args: unknown[]) => {
		TableCtor(...args);
		return { destroy: TableDestroy };
	}),
}));

import {
	type IntervalStatsViewConfig,
	renderIntervalStatsBody,
	renderIntervalStatsInto,
} from "../../src/components/views/interval-stats-view";

interface BundleHarness {
	bundle: CalendarBundle;
	getEvents: ReturnType<typeof vi.fn>;
	getSkippedEvents: ReturnType<typeof vi.fn>;
	getCategoryColor: ReturnType<typeof vi.fn>;
	settings: ReturnType<typeof createMockSingleCalendarSettings>;
}

function makeBundle(
	overrides: {
		events?: CalendarEvent[];
		skipped?: CalendarEvent[];
		settings?: Partial<ReturnType<typeof createMockSingleCalendarSettings>>;
	} = {}
): BundleHarness {
	const baseSettings = createMockSingleCalendarSettings();
	const settings = { ...baseSettings, ...overrides.settings };
	const settingsStore = {
		currentSettings: settings,
		settings$: new BehaviorSubject(settings),
	};

	const getEvents = vi.fn().mockResolvedValue(overrides.events ?? []);
	const getSkippedEvents = vi.fn().mockReturnValue(overrides.skipped ?? []);
	const eventStore = { getEvents, getSkippedEvents };

	const getCategoryColor = vi.fn().mockImplementation((label: string) => `color-${label}`);
	const categoryTracker = { getCategoryColor };

	return {
		bundle: { settingsStore, eventStore, categoryTracker } as unknown as CalendarBundle,
		getEvents,
		getSkippedEvents,
		getCategoryColor,
		settings,
	};
}

function makeStats(entries: Stats["entries"] = [], totalDuration = 0): Stats {
	return { entries, totalDuration };
}

function entry(name: string, duration: number, count = 1): Stats["entries"][number] {
	return { name, duration, count, isRecurring: false };
}

function flush(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	ChartCtor.mockClear();
	ChartDestroy.mockClear();
	TableCtor.mockClear();
	TableDestroy.mockClear();
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("renderIntervalStatsBody", () => {
	const baseInput = {
		filteredEvents: [] as CalendarEvent[],
		start: new Date("2026-03-01T00:00:00"),
		end: new Date("2026-04-01T00:00:00"),
		showDecimalHours: false,
		aggregationMode: "name" as AggregationMode,
		includeCapacity: false,
		emptyMessage: "nothing here",
	};

	it("renders the empty message and no chart/table when stats have no entries", () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");

		const result = renderIntervalStatsBody(container, bundle, { ...baseInput, stats: makeStats() });

		expect(container.textContent).toContain("nothing here");
		expect(container.querySelector(".prisma-stats-empty")).not.toBeNull();
		expect(ChartCtor).not.toHaveBeenCalled();
		expect(TableCtor).not.toHaveBeenCalled();
		expect(result).toEqual({ chart: null, table: null });
	});

	it("creates chart and table for non-empty stats and returns their handles", () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");
		const stats = makeStats([entry("A", 1000), entry("B", 500)], 1500);

		const result = renderIntervalStatsBody(container, bundle, { ...baseInput, stats });

		expect(ChartCtor).toHaveBeenCalledTimes(1);
		const [chartParent, chartEntries, chartOpts] = ChartCtor.mock.calls[0]!;
		expect(chartParent).toBe(container);
		expect(chartEntries).toBe(stats.entries);
		expect((chartOpts as { showToggle?: boolean }).showToggle).toBe(false);

		expect(TableCtor).toHaveBeenCalledTimes(1);
		expect(TableCtor.mock.calls[0]).toEqual([container, stats.entries, 1500, false]);
		expect(result.chart).not.toBeNull();
		expect(result.table).not.toBeNull();
	});

	it("passes a category colorResolver only in category mode", () => {
		const { bundle, getCategoryColor } = makeBundle();
		const container = document.createElement("div");
		const stats = makeStats([entry("Work", 1000)], 1000);

		renderIntervalStatsBody(container, bundle, { ...baseInput, stats, aggregationMode: "category" });

		const opts = ChartCtor.mock.calls[0]![2] as { colorResolver?: (label: string) => string };
		expect(opts.colorResolver).toBeTypeOf("function");
		expect(opts.colorResolver!("Work")).toBe("color-Work");
		expect(getCategoryColor).toHaveBeenCalledWith("Work");
	});

	it("omits the colorResolver in name mode", () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");
		const stats = makeStats([entry("Workout", 1000)], 1000);

		renderIntervalStatsBody(container, bundle, { ...baseInput, stats, aggregationMode: "name" });

		const opts = ChartCtor.mock.calls[0]![2] as { colorResolver?: unknown };
		expect(opts.colorResolver).toBeUndefined();
	});

	it("renders capacity label when includeCapacity and the setting are both enabled", () => {
		const { bundle } = makeBundle({ settings: { capacityTrackingEnabled: true, hourStart: 9, hourEnd: 17 } });
		const container = document.createElement("div");
		const stats = makeStats([entry("A", 1000)], 1000);

		renderIntervalStatsBody(container, bundle, {
			...baseInput,
			stats,
			includeCapacity: true,
		});

		expect(container.querySelector(".prisma-capacity-label")).not.toBeNull();
	});

	it("skips the capacity label when includeCapacity is false", () => {
		const { bundle } = makeBundle({ settings: { capacityTrackingEnabled: true, hourStart: 9, hourEnd: 17 } });
		const container = document.createElement("div");
		const stats = makeStats([entry("A", 1000)], 1000);

		renderIntervalStatsBody(container, bundle, { ...baseInput, stats, includeCapacity: false });

		expect(container.querySelector(".prisma-capacity-label")).toBeNull();
	});

	it("skips the capacity label when the setting is disabled", () => {
		const { bundle } = makeBundle({ settings: { capacityTrackingEnabled: false } });
		const container = document.createElement("div");
		const stats = makeStats([entry("A", 1000)], 1000);

		renderIntervalStatsBody(container, bundle, { ...baseInput, stats, includeCapacity: true });

		expect(container.querySelector(".prisma-capacity-label")).toBeNull();
	});
});

describe("renderIntervalStatsInto", () => {
	function createConfig(overrides: Partial<IntervalStatsViewConfig> = {}): IntervalStatsViewConfig & {
		getBounds: ReturnType<typeof vi.fn>;
		aggregateStats: ReturnType<typeof vi.fn>;
		formatDate: ReturnType<typeof vi.fn>;
	} {
		return {
			getBounds: vi.fn().mockImplementation((date: Date) => ({
				start: new Date(date.getFullYear(), date.getMonth(), 1),
				end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
			})),
			aggregateStats: vi.fn().mockReturnValue(makeStats([entry("Team Meeting", 3_600_000)], 3_600_000)),
			formatDate: vi.fn().mockReturnValue("March 2026"),
			emptyMessage: "No events",
			includeCapacity: false,
			...overrides,
		} as IntervalStatsViewConfig & {
			getBounds: ReturnType<typeof vi.fn>;
			aggregateStats: ReturnType<typeof vi.fn>;
			formatDate: ReturnType<typeof vi.fn>;
		};
	}

	it("renders header elements (date label, duration, event count) on initial render", async () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");
		document.body.appendChild(container);
		const config = createConfig({
			aggregateStats: vi
				.fn()
				.mockReturnValue(makeStats([entry("A", 3_600_000, 2), entry("B", 1_800_000, 3)], 5_400_000)),
			formatDate: vi.fn().mockReturnValue("March 2026"),
		});

		renderIntervalStatsInto(container, bundle, config);
		await flush();

		expect(container.querySelector(".prisma-stats-tab-date-label")?.textContent).toBe("March 2026");
		const durationBtn = container.querySelector(".prisma-stats-duration-toggle") as HTMLElement;
		expect(durationBtn.textContent).toContain("⏱");
		const headerStats = container.querySelectorAll(".prisma-stats-header-stat");
		const eventCountEl = Array.from(headerStats).find((el) => el.textContent?.includes("events"));
		expect(eventCountEl?.textContent).toContain("5 events");
	});

	it("queries the event store for the configured bounds and does not include skipped by default", async () => {
		const { bundle, getEvents, getSkippedEvents } = makeBundle();
		const container = document.createElement("div");
		const config = createConfig();

		renderIntervalStatsInto(container, bundle, config);
		await flush();

		expect(config.getBounds).toHaveBeenCalledTimes(1);
		expect(getEvents).toHaveBeenCalledTimes(1);
		expect(getSkippedEvents).not.toHaveBeenCalled();
		const query = getEvents.mock.calls[0]![0] as { start: string; end: string };
		expect(query.start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(query.end).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("passes the merged tracked + skipped events to aggregateStats when include-skipped is checked", async () => {
		const tracked = [createMockTimedEvent({ id: "t-1" })];
		const skipped = [createMockTimedEvent({ id: "s-1", metadata: { skip: true } as never })];
		const { bundle, getSkippedEvents } = makeBundle({ events: tracked, skipped });
		const container = document.createElement("div");
		const config = createConfig();

		renderIntervalStatsInto(container, bundle, config);
		await flush();

		config.aggregateStats.mockClear();
		const checkbox = container.querySelector(".prisma-stats-skip-checkbox") as HTMLInputElement;
		checkbox.checked = true;
		checkbox.dispatchEvent(new Event("change"));
		await flush();

		expect(getSkippedEvents).toHaveBeenCalledTimes(1);
		const lastCall = config.aggregateStats.mock.calls.at(-1)!;
		const passedEvents = lastCall[0] as CalendarEvent[];
		expect(passedEvents).toHaveLength(2);
		expect(passedEvents.map((e) => e.id)).toEqual(["t-1", "s-1"]);
	});

	it("toggles the aggregation mode and re-aggregates with the new mode", async () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");
		const config = createConfig();

		renderIntervalStatsInto(container, bundle, config);
		await flush();

		const toggle = container.querySelector(".prisma-stats-mode-button-compact") as HTMLButtonElement;
		expect(toggle.textContent).toBe("Event Name");
		config.aggregateStats.mockClear();

		toggle.click();
		await flush();

		expect(toggle.textContent).toBe("Category");
		const lastCall = config.aggregateStats.mock.calls.at(-1)!;
		expect(lastCall[2]).toBe("category");

		toggle.click();
		await flush();
		expect(toggle.textContent).toBe("Event Name");
		expect(config.aggregateStats.mock.calls.at(-1)![2]).toBe("name");
	});

	it("swaps between formatted and decimal duration on the duration toggle", async () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");
		const config = createConfig({
			aggregateStats: vi.fn().mockReturnValue(makeStats([entry("Workout", 5_400_000, 1)], 5_400_000)),
		});

		renderIntervalStatsInto(container, bundle, config);
		await flush();

		let durationBtn = container.querySelector(".prisma-stats-duration-toggle") as HTMLButtonElement;
		expect(durationBtn.textContent).toBe("⏱ 1h 30m");

		durationBtn.click();
		await flush();
		durationBtn = container.querySelector(".prisma-stats-duration-toggle") as HTMLButtonElement;
		expect(durationBtn.textContent).toBe("⏱ 1.5h");

		durationBtn.click();
		await flush();
		durationBtn = container.querySelector(".prisma-stats-duration-toggle") as HTMLButtonElement;
		expect(durationBtn.textContent).toBe("⏱ 1h 30m");
	});

	it("re-renders with the new date when setDate is called", async () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");
		const config = createConfig();

		const handle = renderIntervalStatsInto(container, bundle, config);
		await flush();
		config.getBounds.mockClear();
		config.aggregateStats.mockClear();
		config.formatDate.mockClear();
		config.formatDate.mockReturnValue("April 2026");

		const nextDate = new Date(2026, 3, 15);
		handle.setDate(nextDate);
		await flush();

		expect(config.getBounds).toHaveBeenCalledWith(nextDate);
		expect(config.aggregateStats.mock.calls.at(-1)![1]).toBe(nextDate);
		expect(container.querySelector(".prisma-stats-tab-date-label")?.textContent).toBe("April 2026");
	});

	it("renders the empty message when aggregated stats are empty", async () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");
		const config = createConfig({
			aggregateStats: vi.fn().mockReturnValue(makeStats()),
			emptyMessage: "No events found for this month.",
		});

		renderIntervalStatsInto(container, bundle, config);
		await flush();

		expect(container.querySelector(".prisma-stats-empty")?.textContent).toBe("No events found for this month.");
		expect(ChartCtor).not.toHaveBeenCalled();
		expect(TableCtor).not.toHaveBeenCalled();
	});

	it("destroys chart/table components and empties the container on destroy", async () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");
		const config = createConfig();

		const handle = renderIntervalStatsInto(container, bundle, config);
		await flush();

		expect(container.children.length).toBeGreaterThan(0);
		handle.destroy();

		expect(ChartDestroy).toHaveBeenCalled();
		expect(TableDestroy).toHaveBeenCalled();
		expect(container.children.length).toBe(0);
	});

	it("tears down the previous chart/table before rendering the next frame", async () => {
		const { bundle } = makeBundle();
		const container = document.createElement("div");
		const config = createConfig();

		const handle = renderIntervalStatsInto(container, bundle, config);
		await flush();
		expect(ChartCtor).toHaveBeenCalledTimes(1);
		expect(TableCtor).toHaveBeenCalledTimes(1);

		handle.setDate(new Date(2026, 4, 1));
		await flush();

		expect(ChartDestroy).toHaveBeenCalledTimes(1);
		expect(TableDestroy).toHaveBeenCalledTimes(1);
		expect(ChartCtor).toHaveBeenCalledTimes(2);
		expect(TableCtor).toHaveBeenCalledTimes(2);
	});
});
