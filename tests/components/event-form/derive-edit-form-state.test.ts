import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import type * as ObsidianUtils from "../../../src/utils/obsidian";

// Shared mock-registry: tests seed frontmatter by filePath; the mocked
// `getFileAndFrontmatter` reads from it. `vi.hoisted` lets the `vi.mock`
// factory (hoisted above imports) access this map without crossing the
// "out-of-scope variable" lint rail.
const { registry } = vi.hoisted(() => ({
	registry: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../../../src/utils/obsidian", async () => {
	const actual = await vi.importActual<typeof ObsidianUtils>("../../../src/utils/obsidian");
	return {
		...actual,
		getFileAndFrontmatter: vi.fn((_app: App, filePath: string) => {
			const fm = registry.get(filePath);
			if (!fm) throw new Error(`no mock frontmatter for ${filePath}`);
			return { file: { path: filePath } as never, frontmatter: fm };
		}),
		getCategoriesFromFilePath: vi.fn((_app: App, filePath: string, prop: string | undefined): string[] => {
			if (!prop) return [];
			const fm = registry.get(filePath);
			const value = fm?.[prop];
			if (Array.isArray(value)) return value.map(String);
			if (typeof value === "string")
				return value
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);
			return [];
		}),
	};
});

import type { CalendarBundle } from "../../../src/core/calendar-bundle";
import { deriveEditFormState, type EditFormDerivedState } from "../../../src/react/modals/event/event-edit-modal";
import type { SingleCalendarConfig } from "../../../src/types/settings";
import { createMockSingleCalendarSettings } from "../../fixtures/settings-fixtures";

function makeBundle(settingsOverrides: Partial<SingleCalendarConfig> = {}): CalendarBundle {
	const settings = {
		...createMockSingleCalendarSettings(),
		titleProp: "Title",
		categoryProp: "Category",
		participantsProp: "Participants",
		prerequisiteProp: "Prerequisites",
		startProp: "Start Date",
		endProp: "End Date",
		dateProp: "Date",
		allDayProp: "All Day",
		minutesBeforeProp: "Minutes Before",
		daysBeforeProp: "Days Before",
		rruleProp: "RRule",
		rruleSpecProp: "RRuleSpec",
		rruleUntilProp: "RRuleUntil",
		futureInstancesCountProp: "FutureInstancesCount",
		generatePastEventsProp: "GeneratePastEvents",
		locationProp: "Location",
		iconProp: "Icon",
		statusProperty: "Status",
		skipProp: "Skip",
		breakProp: "Break",
		frontmatterDisplayProperties: [] as string[],
		frontmatterDisplayPropertiesAllDay: [] as string[],
		enableNotifications: true,
		...settingsOverrides,
	} as SingleCalendarConfig;
	return {
		settingsStore: { currentSettings: settings },
	} as unknown as CalendarBundle;
}

function derive(
	eventData: Parameters<typeof deriveEditFormState>[2],
	options: { bundleOverrides?: Partial<SingleCalendarConfig> } = {}
): EditFormDerivedState {
	const app = {} as App;
	const bundle = makeBundle(options.bundleOverrides);
	return deriveEditFormState(app, bundle, eventData);
}

describe("deriveEditFormState", () => {
	it("extracts ZettelID from a plain file path and trims the display title", () => {
		registry.set("Events/Team Meeting-20250101000000.md", { "Start Date": "2026-04-25T09:00" });

		const result = derive({
			title: "Team Meeting-20250101000000",
			start: "2026-04-25T09:00",
			end: "2026-04-25T10:00",
			extendedProps: { filePath: "Events/Team Meeting-20250101000000.md" },
		});

		expect(result.originalZettelId).toBe("-20250101000000");
		expect(result.initialState.title).toBe("Team Meeting");
	});

	it("recognises a physical recurring instance and pins the instance date", () => {
		const path = "Events/Standup 2026-02-03-00001125853328.md";
		registry.set(path, { "Start Date": "2026-02-03T09:00" });

		const result = derive({
			title: "Standup 2026-02-03-00001125853328",
			start: "2026-02-03T09:00",
			extendedProps: { filePath: path },
		});

		expect(result.originalZettelId).toBe("-00001125853328");
		expect(result.instanceDateStr).toBe("2026-02-03");
		// `removeZettelId` only strips the trailing zettel — the leading date
		// stays in the display title and titleHadInstanceDate becomes true.
		expect(result.initialState.title).toBe("Standup 2026-02-03");
		expect(result.titleHadInstanceDate).toBe(true);
	});

	it("loads recurring fields from frontmatter when RRule is present", () => {
		const path = "Events/Weekly-20250101000000.md";
		registry.set(path, {
			"Start Date": "2026-04-25T09:00",
			RRule: "weekly",
			RRuleSpec: "monday,wednesday",
			RRuleUntil: "2026-12-31",
			FutureInstancesCount: 3,
			GeneratePastEvents: true,
		});

		const result = derive({
			title: "Weekly-20250101000000",
			start: "2026-04-25T09:00",
			extendedProps: { filePath: path },
		});

		expect(result.initialState.recurring.enabled).toBe(true);
		expect(result.initialState.recurring.rruleType).toBe("weekly");
		expect(result.initialState.recurring.weekdays).toEqual(["monday", "wednesday"]);
		expect(result.initialState.recurring.untilDate).toBe("2026-12-31");
		expect(result.initialState.recurring.futureInstancesCount).toBe("3");
		expect(result.initialState.recurring.generatePastEvents).toBe(true);
	});

	it("returns a disabled recurring block when frontmatter has no RRule", () => {
		const path = "Events/OneOff-20250101000000.md";
		registry.set(path, { "Start Date": "2026-04-25T09:00" });

		const result = derive({
			title: "OneOff-20250101000000",
			start: "2026-04-25T09:00",
			extendedProps: { filePath: path },
		});

		expect(result.initialState.recurring.enabled).toBe(false);
		expect(result.initialState.recurring.rruleType).toBe("");
		expect(result.initialState.recurring.weekdays).toEqual([]);
	});

	it("collects every custom-property key in customPropsInit and excludes system props", () => {
		const path = "Events/Tagged-20250101000000.md";
		registry.set(path, {
			"Start Date": "2026-04-25T09:00",
			Priority: "high",
			Project: "Atlas",
			Notes: "raw",
		});

		const result = derive(
			{
				title: "Tagged-20250101000000",
				start: "2026-04-25T09:00",
				extendedProps: { filePath: path },
			},
			{ bundleOverrides: { frontmatterDisplayProperties: ["Priority", "Project"] } }
		);

		// All three keys land in customPropsInit for the form. EventForm
		// partitions display vs other from displayKeySet at render time —
		// `deriveEditFormState` only tracks the keyset for delete-on-remove.
		expect(result.originalCustomPropertyKeys.has("Priority")).toBe(true);
		expect(result.originalCustomPropertyKeys.has("Project")).toBe(true);
		expect(result.originalCustomPropertyKeys.has("Notes")).toBe(true);
		expect(result.originalCustomPropertyKeys.has("Start Date"), "system fields stay out").toBe(false);

		expect(result.customPropsInit["Priority"]).toBe("high");
		expect(result.customPropsInit["Notes"]).toBe("raw");
	});

	it("loads minutesBefore into notifyBefore for timed events", () => {
		const path = "Events/Timed-20250101000000.md";
		registry.set(path, { "Start Date": "2026-04-25T09:00", "Minutes Before": 15 });

		const result = derive({
			title: "Timed-20250101000000",
			start: "2026-04-25T09:00",
			allDay: false,
			extendedProps: { filePath: path },
		});

		expect(result.initialState.notifyBefore).toBe("15");
	});

	it("loads daysBefore into notifyBefore for all-day events", () => {
		const path = "Events/AllDay-20250101000000.md";
		registry.set(path, { "Start Date": "2026-04-25T00:00", "Days Before": 2 });

		const result = derive({
			title: "AllDay-20250101000000",
			start: "2026-04-25T00:00",
			allDay: true,
			extendedProps: { filePath: path },
		});

		expect(result.initialState.notifyBefore).toBe("2");
	});

	it("uses restoreState.formState verbatim when provided (override of derived initialState)", () => {
		const path = "Events/Restored-20250101000000.md";
		registry.set(path, { "Start Date": "2026-04-25T09:00" });

		const result = deriveEditFormState(
			{} as App,
			makeBundle(),
			{
				title: "Restored-20250101000000",
				start: "2026-04-25T09:00",
				extendedProps: { filePath: path },
			},
			{
				formState: {
					title: "Pending Draft",
					allDay: false,
					virtual: false,
					start: "2026-05-01T10:00",
					end: "2026-05-01T11:00",
					date: "",
					categories: [],
					participants: [],
					prerequisites: [],
					notifyBefore: "",
					recurring: {
						enabled: false,
						rruleType: "",
						weekdays: [],
						customFreq: "DAILY",
						customInterval: "1",
						untilDate: "",
						futureInstancesCount: "",
						generatePastEvents: false,
					},
					location: "",
					icon: "",
					breakMinutes: "",
					markAsDone: false,
					skip: false,
				},
				stopwatch: {
					state: "idle",
					startTime: null,
					breakStartTime: null,
					sessionStartTime: null,
					totalBreakMs: 0,
				},
				modalType: "edit",
				filePath: path,
				originalFrontmatter: {},
				calendarId: "test",
			}
		);

		expect(result.initialState.title).toBe("Pending Draft");
		expect(result.initialState.start).toBe("2026-05-01T10:00");
	});
});
