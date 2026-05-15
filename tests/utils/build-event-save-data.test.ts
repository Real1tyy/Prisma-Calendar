import { describe, expect, it } from "vitest";

import { createDefaultState } from "../../src/components/modals/event/event-form-state";
import { buildEventSaveData } from "../../src/react/event-form/build-event-save-data";
import type { EventFormValues } from "../../src/react/event-form/event-form";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { createMockSingleCalendarSettings } from "../fixtures/settings-fixtures";

function makeValues(overrides: Partial<EventFormValues> = {}): EventFormValues {
	return {
		formState: { ...createDefaultState() },
		customProperties: {},
		stopwatchSnapshot: null,
		initialMarkAsDoneState: false,
		...overrides,
	};
}

function makeSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return { ...createMockSingleCalendarSettings(), ...overrides } as SingleCalendarConfig;
}

describe("buildEventSaveData", () => {
	it("writes title to titleProp on the preserved frontmatter when titleProp is configured", () => {
		const settings = makeSettings({ titleProp: "Title" });
		const values = makeValues({
			formState: { ...createDefaultState(), title: "Team Meeting", start: "2026-04-25T09:00", end: "2026-04-25T10:00" },
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.title).toBe("Team Meeting");
		expect(data.preservedFrontmatter["Title"]).toBe("Team Meeting");
	});

	it("returns title in save data even when titleProp is unset (no frontmatter write)", () => {
		const settings = makeSettings();
		expect(settings.titleProp).toBeUndefined();
		const values = makeValues({
			formState: { ...createDefaultState(), title: "Team Meeting", start: "2026-04-25T09:00", end: "2026-04-25T10:00" },
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.title).toBe("Team Meeting");
	});

	it("normalizes start/end via ensureISOSuffix for timed events", () => {
		const settings = makeSettings();
		const values = makeValues({
			formState: { ...createDefaultState(), title: "T", start: "2026-04-25T09:00", end: "2026-04-25T10:00" },
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.start).toMatch(/^2026-04-25T09:00/);
		expect(data.end).toMatch(/^2026-04-25T10:00/);
		expect(data.allDay).toBe(false);
	});

	it("expands an all-day date into start-of-day → end-of-day spans", () => {
		const settings = makeSettings();
		const values = makeValues({
			formState: { ...createDefaultState(), title: "T", allDay: true, date: "2026-04-25" },
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.start).toBe("2026-04-25T00:00:00");
		expect(data.end).toBe("2026-04-25T23:59:59");
		expect(data.allDay).toBe(true);
	});

	it("treats a timed event with no start as untracked (no allDay, blank start)", () => {
		const settings = makeSettings();
		const values = makeValues({ formState: { ...createDefaultState(), title: "Untracked", allDay: false, start: "" } });

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.start).toBe("");
		expect(data.end).toBeNull();
		expect(data.allDay).toBe(false);
	});

	it("treats an all-day with no date as untracked", () => {
		const settings = makeSettings();
		const values = makeValues({ formState: { ...createDefaultState(), title: "T", allDay: true, date: "" } });

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.start).toBe("");
		expect(data.allDay).toBe(false);
	});

	it("propagates virtual flag through to the save data", () => {
		const settings = makeSettings();
		const values = makeValues({
			formState: {
				...createDefaultState(),
				title: "V",
				virtual: true,
				start: "2026-04-25T09:00",
				end: "2026-04-25T10:00",
			},
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.virtual).toBe(true);
	});

	it("adds new custom properties to preservedFrontmatter", () => {
		const settings = makeSettings();
		const values = makeValues({
			formState: { ...createDefaultState(), title: "T", start: "2026-04-25T09:00", end: "2026-04-25T10:00" },
			customProperties: { project: "Alpha", priority: 3 },
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.preservedFrontmatter["project"]).toBe("Alpha");
		expect(data.preservedFrontmatter["priority"]).toBe(3);
	});

	it("removes original custom property keys absent from current values", () => {
		const settings = makeSettings();
		const original = { stale: "old-value", keep: "still-here" };
		const values = makeValues({
			formState: { ...createDefaultState(), title: "T", start: "2026-04-25T09:00", end: "2026-04-25T10:00" },
			customProperties: { keep: "still-here" },
		});

		const data = buildEventSaveData(values, settings, original, new Set(["stale", "keep"]), false);

		expect("stale" in data.preservedFrontmatter).toBe(false);
		expect(data.preservedFrontmatter["keep"]).toBe("still-here");
	});

	it("writes recurring fields when recurring is enabled and event is tracked", () => {
		const settings = makeSettings();
		const values = makeValues({
			formState: {
				...createDefaultState(),
				title: "T",
				start: "2026-04-25T09:00",
				end: "2026-04-25T10:00",
				recurring: {
					enabled: true,
					rruleType: "weekly",
					weekdays: ["monday", "wednesday"],
					customFreq: "DAILY",
					customInterval: "1",
					untilDate: "2026-12-31",
					futureInstancesCount: "5",
					generatePastEvents: false,
				},
			},
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.preservedFrontmatter[settings.rruleProp]).toBe("weekly");
		expect(data.preservedFrontmatter[settings.rruleSpecProp]).toBe("monday, wednesday");
		expect(data.preservedFrontmatter[settings.rruleUntilProp]).toBe("2026-12-31");
		expect(data.preservedFrontmatter[settings.futureInstancesCountProp]).toBe(5);
	});

	it("strips weekdays for non-weekday-supporting recurrence types", () => {
		const settings = makeSettings();
		const values = makeValues({
			formState: {
				...createDefaultState(),
				title: "T",
				start: "2026-04-25T09:00",
				end: "2026-04-25T10:00",
				recurring: {
					enabled: true,
					rruleType: "monthly",
					weekdays: ["monday", "wednesday"],
					customFreq: "DAILY",
					customInterval: "1",
					untilDate: "",
					futureInstancesCount: "",
					generatePastEvents: false,
				},
			},
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.preservedFrontmatter[settings.rruleProp]).toBe("monthly");
		expect(data.preservedFrontmatter[settings.rruleSpecProp]).toBeUndefined();
	});

	it("clears recurring fields from frontmatter when recurring was disabled but originally had rrule", () => {
		const settings = makeSettings();
		const original = {
			[settings.rruleProp]: "weekly",
			[settings.rruleSpecProp]: "monday",
			[settings.rruleUntilProp]: "2026-12-31",
		};
		const values = makeValues({
			formState: {
				...createDefaultState(),
				title: "T",
				start: "2026-04-25T09:00",
				end: "2026-04-25T10:00",
			},
		});

		const data = buildEventSaveData(values, settings, original, new Set(), false);

		expect(data.preservedFrontmatter[settings.rruleProp]).toBeUndefined();
		expect(data.preservedFrontmatter[settings.rruleSpecProp]).toBeUndefined();
		expect(data.preservedFrontmatter[settings.rruleUntilProp]).toBeUndefined();
	});

	it("writes minutesBeforeProp for timed events with notifyBefore", () => {
		const settings = makeSettings({ enableNotifications: true });
		const values = makeValues({
			formState: {
				...createDefaultState(),
				title: "T",
				start: "2026-04-25T09:00",
				end: "2026-04-25T10:00",
				notifyBefore: "30",
			},
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.preservedFrontmatter[settings.minutesBeforeProp]).toBe(30);
		expect(data.preservedFrontmatter[settings.daysBeforeProp]).toBeUndefined();
	});

	it("writes daysBeforeProp for all-day events with notifyBefore", () => {
		const settings = makeSettings({ enableNotifications: true });
		const values = makeValues({
			formState: { ...createDefaultState(), title: "T", allDay: true, date: "2026-04-25", notifyBefore: "2" },
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.preservedFrontmatter[settings.daysBeforeProp]).toBe(2);
		expect(data.preservedFrontmatter[settings.minutesBeforeProp]).toBeUndefined();
	});

	it("does not flag alreadyNotified when isReadOnly is true (suppresses skipNewlyCreated)", () => {
		const settings = makeSettings({
			enableNotifications: true,
			skipNewlyCreatedNotifications: true,
		} as Partial<SingleCalendarConfig>);

		const nowIso = new Date().toISOString().slice(0, 16);
		const values = makeValues({
			formState: { ...createDefaultState(), title: "T", start: nowIso, end: nowIso, notifyBefore: "5" },
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), true);

		expect(data.preservedFrontmatter[settings.alreadyNotifiedProp]).toBeUndefined();
	});

	it("returns a save object with filePath: null (caller fills this in for edits)", () => {
		const settings = makeSettings();
		const values = makeValues({
			formState: { ...createDefaultState(), title: "T", start: "2026-04-25T09:00", end: "2026-04-25T10:00" },
		});

		const data = buildEventSaveData(values, settings, {}, new Set(), false);

		expect(data.filePath).toBeNull();
	});
});
