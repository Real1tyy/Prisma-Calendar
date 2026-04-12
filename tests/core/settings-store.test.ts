import { BehaviorSubject } from "rxjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TOOLBAR_BUTTON_IDS } from "../../src/constants";
import { CalendarSettingsStore } from "../../src/core/settings-store";
import type { CustomCalendarSettings } from "../../src/types";
import { CustomCalendarSettingsSchema } from "../../src/types";

/**
 * Minimal fake for PrismaCalendarSettingsStore. The real one (shared lib's
 * SettingsStore) requires a Plugin instance; for these tests we only need the
 * three-member surface CalendarSettingsStore touches: currentSettings, settings$,
 * updateSettings.
 */
function createFakeMainStore(initial: CustomCalendarSettings) {
	const settings$ = new BehaviorSubject<CustomCalendarSettings>(initial);

	return {
		settings$,
		get currentSettings() {
			return settings$.value;
		},
		updateSettings: vi.fn(async (updater: (s: CustomCalendarSettings) => CustomCalendarSettings) => {
			const next = updater(settings$.value);
			settings$.next(next);
		}),
	};
}

function defaultCalendarSettings(): CustomCalendarSettings {
	return CustomCalendarSettingsSchema.parse({});
}

describe("CalendarSettingsStore", () => {
	let mainStore: ReturnType<typeof createFakeMainStore>;
	let initialSettings: CustomCalendarSettings;
	let calendarId: string;

	beforeEach(() => {
		initialSettings = defaultCalendarSettings();
		calendarId = initialSettings.calendars[0].id;
		mainStore = createFakeMainStore(initialSettings);
	});

	describe("constructor", () => {
		it("initializes currentSettings from the matching calendar", () => {
			const store = new CalendarSettingsStore(mainStore as never, calendarId);

			expect(store.currentSettings).toEqual(initialSettings.calendars[0]);
		});

		it("emits initial settings on settings$", () => {
			const store = new CalendarSettingsStore(mainStore as never, calendarId);

			expect(store.settings$.value).toEqual(initialSettings.calendars[0]);
		});

		it("throws when calendar id is missing", () => {
			expect(() => new CalendarSettingsStore(mainStore as never, "does-not-exist")).toThrow(
				/Calendar with id does-not-exist not found/
			);
		});
	});

	describe("reacts to main store changes", () => {
		it("emits new settings when the matching calendar is updated upstream", () => {
			const store = new CalendarSettingsStore(mainStore as never, calendarId);
			const emissions: string[] = [];
			store.settings$.subscribe((s) => emissions.push(s.name));

			mainStore.settings$.next({
				...initialSettings,
				calendars: [{ ...initialSettings.calendars[0], name: "Renamed" }],
			});

			expect(emissions).toEqual([initialSettings.calendars[0].name, "Renamed"]);
			expect(store.currentSettings.name).toBe("Renamed");
		});

		it("does not re-emit when upstream change does not affect this calendar", () => {
			const store = new CalendarSettingsStore(mainStore as never, calendarId);
			const emissions: CustomCalendarSettings["calendars"][number][] = [];
			store.settings$.subscribe((s) => emissions.push(s));

			mainStore.settings$.next({
				...initialSettings,
				calendars: [...initialSettings.calendars],
			});

			expect(emissions).toHaveLength(1);
		});

		it("keeps last-known settings if the calendar is removed upstream", () => {
			const store = new CalendarSettingsStore(mainStore as never, calendarId);
			const before = store.currentSettings;

			mainStore.settings$.next({ ...initialSettings, calendars: [] });

			expect(store.currentSettings).toBe(before);
		});
	});

	describe("updateSettings", () => {
		it("patches only this calendar within the full settings object", async () => {
			const store = new CalendarSettingsStore(mainStore as never, calendarId);

			await store.updateSettings((s) => ({ ...s, name: "Work" }));

			expect(mainStore.updateSettings).toHaveBeenCalledOnce();
			expect(mainStore.currentSettings.calendars[0].name).toBe("Work");
		});

		it("leaves other calendars untouched", async () => {
			const initialWithTwo = {
				...initialSettings,
				calendars: [initialSettings.calendars[0], { ...initialSettings.calendars[0], id: "other", name: "Other" }],
			};
			mainStore = createFakeMainStore(initialWithTwo);

			const store = new CalendarSettingsStore(mainStore as never, calendarId);
			await store.updateSettings((s) => ({ ...s, name: "Renamed" }));

			expect(mainStore.currentSettings.calendars[0].name).toBe("Renamed");
			expect(mainStore.currentSettings.calendars[1]).toEqual(initialWithTwo.calendars[1]);
		});
	});

	describe("toggleToolbarButton", () => {
		it("adds a disabled button back in canonical order when enabled=true", async () => {
			mainStore.settings$.next({
				...initialSettings,
				calendars: [{ ...initialSettings.calendars[0], toolbarButtons: [] }],
			});
			const store = new CalendarSettingsStore(mainStore as never, calendarId);

			await store.toggleToolbarButton("toolbarButtons", TOOLBAR_BUTTON_IDS[0], true);

			expect(store.currentSettings.toolbarButtons).toEqual([TOOLBAR_BUTTON_IDS[0]]);
		});

		it("preserves canonical order when enabling multiple buttons", async () => {
			mainStore.settings$.next({
				...initialSettings,
				calendars: [{ ...initialSettings.calendars[0], toolbarButtons: [] }],
			});
			const store = new CalendarSettingsStore(mainStore as never, calendarId);

			await store.toggleToolbarButton("toolbarButtons", TOOLBAR_BUTTON_IDS[2], true);
			await store.toggleToolbarButton("toolbarButtons", TOOLBAR_BUTTON_IDS[0], true);

			expect(store.currentSettings.toolbarButtons).toEqual([TOOLBAR_BUTTON_IDS[0], TOOLBAR_BUTTON_IDS[2]]);
		});

		it("removes a button when enabled=false", async () => {
			const store = new CalendarSettingsStore(mainStore as never, calendarId);
			const target = TOOLBAR_BUTTON_IDS[1];

			await store.toggleToolbarButton("toolbarButtons", target, false);

			expect(store.currentSettings.toolbarButtons).not.toContain(target);
		});

		it("operates on the mobile toolbar key independently", async () => {
			const store = new CalendarSettingsStore(mainStore as never, calendarId);
			const target = TOOLBAR_BUTTON_IDS[0];

			await store.toggleToolbarButton("mobileToolbarButtons", target, false);

			expect(store.currentSettings.mobileToolbarButtons).not.toContain(target);
			expect(store.currentSettings.toolbarButtons).toContain(target);
		});
	});

	describe("destroy", () => {
		it("unsubscribes from main store and completes settings$", () => {
			const store = new CalendarSettingsStore(mainStore as never, calendarId);
			const emissions: string[] = [];
			let completed = false;
			store.settings$.subscribe({
				next: (s) => emissions.push(s.name),
				complete: () => {
					completed = true;
				},
			});

			store.destroy();

			expect(completed).toBe(true);

			mainStore.settings$.next({
				...initialSettings,
				calendars: [{ ...initialSettings.calendars[0], name: "After destroy" }],
			});

			expect(emissions).toEqual([initialSettings.calendars[0].name]);
		});
	});
});
