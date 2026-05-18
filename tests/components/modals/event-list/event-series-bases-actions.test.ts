import type * as RealityPlugins from "@real1ty-obsidian-plugins";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarBundle } from "../../../../src/core/calendar-bundle";
import {
	createCategorySeriesBasesActions,
	createNameSeriesBasesActions,
	createRecurringSeriesBasesActions,
} from "../../../../src/react/modals/event-list/event-series-bases-actions";
import { createMockTimedEvent } from "../../../fixtures/event-fixtures";
import { createMockCalendarSettingsStore } from "../../../fixtures/settings-fixtures";

const showModal = vi.hoisted(() => vi.fn());
const showEventSeriesBasesViewModal = vi.hoisted(() => vi.fn());
const showHeatmapModal = vi.hoisted(() => vi.fn());
const showTimelineModal = vi.hoisted(() => vi.fn());
const renderProUpgradeBanner = vi.hoisted(() => vi.fn());

vi.mock("@real1ty-obsidian-plugins", async () => {
	const actual = await vi.importActual<typeof RealityPlugins>("@real1ty-obsidian-plugins");
	return { ...actual, showModal };
});
vi.mock("../../../../src/components/modals", () => ({
	showEventSeriesBasesViewModal,
	showHeatmapModal,
	showTimelineModal,
}));
vi.mock("../../../../src/components/settings/pro-upgrade-banner", () => ({
	renderProUpgradeBanner,
}));

interface BundleStub {
	isPro?: boolean;
	recurringSeries?: {
		instances: Array<{ event: ReturnType<typeof createMockTimedEvent> }>;
		sourceTitle: string;
		sourceFilePath?: string;
		sourceCategory?: string | null;
	} | null;
	categoryEvents?: ReturnType<typeof createMockTimedEvent>[];
	categoryColor?: string;
	nameEvents?: ReturnType<typeof createMockTimedEvent>[];
}

function makeBundle(stub: BundleStub = {}): CalendarBundle {
	const settingsStore = createMockCalendarSettingsStore();
	return {
		settingsStore,
		plugin: {
			app: {} as unknown,
			licenseManager: { isPro: stub.isPro ?? true },
		},
		recurringEventManager: {
			getRecurringEventSeries: vi.fn().mockReturnValue(stub.recurringSeries ?? null),
		},
		categoryTracker: {
			getEventsWithCategory: vi.fn().mockReturnValue(stub.categoryEvents ?? []),
			getCategoryColor: vi.fn().mockReturnValue(stub.categoryColor),
		},
		nameSeriesTracker: {
			getEventsInNameSeries: vi.fn().mockReturnValue(stub.nameEvents ?? []),
		},
	} as unknown as CalendarBundle;
}

beforeEach(() => {
	showModal.mockReset();
	showEventSeriesBasesViewModal.mockReset();
	showHeatmapModal.mockReset();
	showTimelineModal.mockReset();
	renderProUpgradeBanner.mockReset();
});

describe("createRecurringSeriesBasesActions", () => {
	const rruleId = "rrule-1";
	const series = {
		instances: [{ event: createMockTimedEvent({ id: "evt-1" }) }, { event: createMockTimedEvent({ id: "evt-2" }) }],
		sourceTitle: "Team Meeting-20260101000000",
		sourceFilePath: "events/Team Meeting.md",
		sourceCategory: null,
	};

	it("openTimeline does nothing when the series is not found", () => {
		const bundle = makeBundle({ recurringSeries: null });
		createRecurringSeriesBasesActions(bundle, rruleId).openTimeline();
		expect(showTimelineModal).not.toHaveBeenCalled();
	});

	it("openTimeline forwards events with a stripped 'Timeline for Recurring - <title>' label", () => {
		const bundle = makeBundle({ recurringSeries: series });
		createRecurringSeriesBasesActions(bundle, rruleId).openTimeline();
		expect(showTimelineModal).toHaveBeenCalledTimes(1);
		const [, , payload] = showTimelineModal.mock.calls[0];
		expect(payload.title).toBe("Timeline for Recurring - Team Meeting");
		expect(payload.events).toHaveLength(2);
	});

	it("openHeatmap shows the Pro upgrade gate when license is not Pro", () => {
		const bundle = makeBundle({ isPro: false, recurringSeries: series });
		createRecurringSeriesBasesActions(bundle, rruleId).openHeatmap();
		expect(showModal).toHaveBeenCalledTimes(1);
		expect(showHeatmapModal).not.toHaveBeenCalled();

		const config = showModal.mock.calls[0][0];
		const el = document.createElement("div");
		config.render(el);
		expect(renderProUpgradeBanner).toHaveBeenCalledTimes(1);
		const [target] = renderProUpgradeBanner.mock.calls[0];
		expect(target).toBe(el);
	});

	it("openHeatmap opens the heatmap when Pro and the series resolves", () => {
		const bundle = makeBundle({ isPro: true, recurringSeries: series });
		createRecurringSeriesBasesActions(bundle, rruleId).openHeatmap();
		expect(showHeatmapModal).toHaveBeenCalledTimes(1);
		const [, , payload] = showHeatmapModal.mock.calls[0];
		expect(payload.title).toBe("Heatmap for Recurring - Team Meeting");
	});

	it("openBasesView passes a recurring config built from the rruleId and stripped title", () => {
		const bundle = makeBundle({ recurringSeries: series });
		createRecurringSeriesBasesActions(bundle, rruleId).openBasesView("table");
		expect(showEventSeriesBasesViewModal).toHaveBeenCalledTimes(1);
		const [, , config] = showEventSeriesBasesViewModal.mock.calls[0];
		expect(config).toMatchObject({
			mode: "recurring",
			filterValue: rruleId,
			displayTitle: "Team Meeting",
			viewType: "table",
		});
	});

	it("openBasesView falls back to rruleId as displayTitle when the series is missing", () => {
		const bundle = makeBundle({ recurringSeries: null });
		createRecurringSeriesBasesActions(bundle, rruleId).openBasesView("cards");
		const [, , config] = showEventSeriesBasesViewModal.mock.calls[0];
		expect(config.displayTitle).toBe(rruleId);
	});
});

describe("createNameSeriesBasesActions", () => {
	const nameKey = "team meeting";

	it("openTimeline uses the first event's stripped title as displayName", () => {
		const events = [createMockTimedEvent({ title: "Team Meeting-20260101000000" })];
		const bundle = makeBundle({ nameEvents: events });
		createNameSeriesBasesActions(bundle, nameKey).openTimeline();
		const [, , payload] = showTimelineModal.mock.calls[0];
		expect(payload.title).toBe("Timeline for Name - Team Meeting");
		expect(payload.events).toEqual(events);
	});

	it("openTimeline still fires when the name series has no events (falls through Pro gate via Timeline)", () => {
		const bundle = makeBundle({ nameEvents: [] });
		createNameSeriesBasesActions(bundle, nameKey).openTimeline();
		// no events -> no modal opened
		expect(showTimelineModal).not.toHaveBeenCalled();
	});

	it("openBasesView passes mode=name with displayTitle = nameKey when no events", () => {
		const bundle = makeBundle({ nameEvents: [] });
		createNameSeriesBasesActions(bundle, nameKey).openBasesView("list");
		const [, , config] = showEventSeriesBasesViewModal.mock.calls[0];
		expect(config).toMatchObject({
			mode: "name",
			filterValue: nameKey,
			displayTitle: nameKey,
			viewType: "list",
		});
	});
});

describe("createCategorySeriesBasesActions", () => {
	const categoryValue = "Work";

	it("openTimeline includes events for the category and category color", () => {
		const events = [createMockTimedEvent()];
		const bundle = makeBundle({ categoryEvents: events, categoryColor: "#abcdef" });
		createCategorySeriesBasesActions(bundle, categoryValue).openTimeline();
		const [, , payload] = showTimelineModal.mock.calls[0];
		expect(payload.title).toBe("Timeline for Category - Work");
		expect(payload.events).toEqual(events);
	});

	it("openHeatmap forwards category color in the payload when Pro", () => {
		const bundle = makeBundle({
			isPro: true,
			categoryEvents: [createMockTimedEvent()],
			categoryColor: "#deadbe",
		});
		createCategorySeriesBasesActions(bundle, categoryValue).openHeatmap();
		const [, , payload] = showHeatmapModal.mock.calls[0];
		expect(payload.categoryColor).toBe("#deadbe");
	});

	it("openHeatmap omits categoryColor when none is configured", () => {
		const bundle = makeBundle({
			isPro: true,
			categoryEvents: [createMockTimedEvent()],
		});
		createCategorySeriesBasesActions(bundle, categoryValue).openHeatmap();
		const [, , payload] = showHeatmapModal.mock.calls[0];
		expect(payload).not.toHaveProperty("categoryColor");
	});

	it("openBasesView passes a category config (no displayTitle override)", () => {
		const bundle = makeBundle({ categoryEvents: [], categoryColor: "#abc" });
		createCategorySeriesBasesActions(bundle, categoryValue).openBasesView("cards");
		const [, , config] = showEventSeriesBasesViewModal.mock.calls[0];
		expect(config).toMatchObject({
			mode: "category",
			filterValue: categoryValue,
			viewType: "cards",
		});
		expect(config).not.toHaveProperty("displayTitle");
	});
});
