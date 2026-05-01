/**
 * We construct a real bundle with a fake plugin and main settings store. The
 * IndexerRegistry singleton supplies real (mock-app-backed) trackers, parser,
 * and event store — the same wiring production uses.
 */
import { BehaviorSubject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub the view module — its transitive imports build a CalendarComponent on top
// of MountableComponent(Component) which fails in the test environment because
// obsidian's Component class isn't fully mocked. The bundle only invokes
// registerPrismaCalendarView during initialize(), which we don't exercise here.
vi.mock("../../src/components/views/prisma-view", () => ({
	registerPrismaCalendarView: vi.fn(),
}));

import { CalendarBundle } from "../../src/core/calendar-bundle";
import { IndexerRegistry } from "../../src/core/indexer-registry";
import type { CustomCalendarSettings } from "../../src/types";
import { CustomCalendarSettingsSchema } from "../../src/types";
import { createMockApp, createMockFile } from "../setup";

type MockApp = ReturnType<typeof createMockApp>;

type SettingsUpdater = (s: CustomCalendarSettings) => CustomCalendarSettings;

interface FakeMainStore {
	settings$: BehaviorSubject<CustomCalendarSettings>;
	readonly currentSettings: CustomCalendarSettings;
	updateSettings: (updater: SettingsUpdater) => Promise<void>;
}

function createFakeMainStore(initial: CustomCalendarSettings): FakeMainStore {
	const settings$ = new BehaviorSubject(initial);
	const updateSettings = vi.fn(async (updater: SettingsUpdater) => {
		settings$.next(updater(settings$.value));
	});
	return {
		settings$,
		get currentSettings() {
			return settings$.value;
		},
		updateSettings,
	};
}

function createFakePlugin(app: MockApp) {
	const isPro$ = new BehaviorSubject(false);
	const ribbonEl = document.createElement("div");
	return {
		app,
		addCommand: vi.fn(),
		removeCommand: vi.fn(),
		addRibbonIcon: vi.fn().mockReturnValue(ribbonEl),
		ensureCalendarViewFocus: vi.fn().mockResolvedValue(undefined),
		rememberLastUsedCalendar: vi.fn(),
		licenseManager: {
			isPro$,
			get isPro() {
				return isPro$.value;
			},
		},
		calendarBundles: new Map(),
		manifest: { name: "Prisma Calendar" },
		ribbonEl,
	};
}

function defaultSettings(): CustomCalendarSettings {
	const settings = CustomCalendarSettingsSchema.parse({});
	// Pin a deterministic directory so IndexerRegistry sharing is predictable.
	settings.calendars[0].directory = "Events";
	settings.calendars[0].showRibbonIcon = false;
	return settings;
}

describe("CalendarBundle — wiring contracts", () => {
	let app: MockApp;
	let plugin: ReturnType<typeof createFakePlugin>;
	let mainStore: FakeMainStore;
	let bundle: CalendarBundle;
	let calendarId: string;

	beforeEach(() => {
		app = createMockApp();
		// Augment app with bits the bundle constructors poke.
		(app.workspace as any).registerHoverLinkSource = vi.fn();
		(app.workspace as any).getLeavesOfType = vi.fn().mockReturnValue([]);
		(app as any).loadLocalStorage = vi.fn(async () => null);
		(app as any).saveLocalStorage = vi.fn();
		(app as any).commands = { commands: {} };

		// Reset registry singleton so each test starts clean.
		IndexerRegistry.getInstance(app as any).destroy();

		plugin = createFakePlugin(app);
		const settings = defaultSettings();
		calendarId = settings.calendars[0].id;
		mainStore = createFakeMainStore(settings);
		bundle = new CalendarBundle(plugin as any, calendarId, mainStore as any);
		// activateCalendarView opens an Obsidian leaf — out of scope for these unit
		// tests, and stubbing the workspace API would be more noise than signal.
		vi.spyOn(bundle, "activateCalendarView").mockResolvedValue(undefined);
	});

	afterEach(() => {
		bundle.destroy();
		IndexerRegistry.getInstance(app as any).destroy();
	});

	describe("settings reactivity", () => {
		it("propagates a holiday config change into the holiday store", async () => {
			const updateSpy = vi.spyOn(bundle.holidayStore, "updateConfig");

			await mainStore.updateSettings((s) => ({
				...s,
				calendars: s.calendars.map((c) =>
					c.id === calendarId ? { ...c, holidays: { ...c.holidays, enabled: true, country: "DE" } } : c
				),
			}));

			expect(updateSpy).toHaveBeenCalled();
			const lastCall = updateSpy.mock.calls.at(-1);
			expect(lastCall?.[0].country).toBe("DE");
			expect(lastCall?.[0].enabled).toBe(true);
		});

		it("triggers a virtual-event refresh ONLY when holiday config materially changed", async () => {
			const refreshSpy = vi.spyOn(bundle.eventStore, "refreshVirtualEvents");

			// No-op settings tick: emit identical settings.
			await mainStore.updateSettings((s) => ({ ...s }));
			expect(refreshSpy).not.toHaveBeenCalled();

			// Material change: country flip.
			await mainStore.updateSettings((s) => ({
				...s,
				calendars: s.calendars.map((c) =>
					c.id === calendarId ? { ...c, holidays: { ...c.holidays, enabled: true, country: "FR" } } : c
				),
			}));

			expect(refreshSpy).toHaveBeenCalledTimes(1);
		});

		it("creates a ribbon icon when showRibbonIcon flips on, and removes it when off", async () => {
			expect(plugin.addRibbonIcon).not.toHaveBeenCalled();

			await mainStore.updateSettings((s) => ({
				...s,
				calendars: s.calendars.map((c) => (c.id === calendarId ? { ...c, showRibbonIcon: true } : c)),
			}));
			expect(plugin.addRibbonIcon).toHaveBeenCalledTimes(1);

			const removeSpy = vi.spyOn(plugin.ribbonEl, "remove");
			await mainStore.updateSettings((s) => ({
				...s,
				calendars: s.calendars.map((c) => (c.id === calendarId ? { ...c, showRibbonIcon: false } : c)),
			}));
			expect(removeSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("destroy", () => {
		it("releases the indexer reference back to the registry", () => {
			const registry = IndexerRegistry.getInstance(app as any);
			const releaseSpy = vi.spyOn(registry, "releaseIndexer");

			bundle.destroy();

			expect(releaseSpy).toHaveBeenCalledWith(calendarId, "Events");
		});

		it("clears the holiday store cache", () => {
			const clearSpy = vi.spyOn(bundle.holidayStore, "clear");
			bundle.destroy();
			expect(clearSpy).toHaveBeenCalledTimes(1);
		});

		it("stops reacting to settings changes after destroy", async () => {
			const updateSpy = vi.spyOn(bundle.holidayStore, "updateConfig");
			bundle.destroy();

			await mainStore.updateSettings((s) => ({
				...s,
				calendars: s.calendars.map((c) =>
					c.id === calendarId ? { ...c, holidays: { ...c.holidays, country: "JP" } } : c
				),
			}));

			expect(updateSpy).not.toHaveBeenCalled();
		});

		it("removes the ribbon icon if one was created", async () => {
			await mainStore.updateSettings((s) => ({
				...s,
				calendars: s.calendars.map((c) => (c.id === calendarId ? { ...c, showRibbonIcon: true } : c)),
			}));
			const removeSpy = vi.spyOn(plugin.ribbonEl, "remove");

			bundle.destroy();

			expect(removeSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("refreshCalendar", () => {
		it("clears event + recurring caches and triggers a repo resync", () => {
			const eventClearSpy = vi.spyOn(bundle.eventStore, "clearWithoutNotify");
			const recurringClearSpy = vi.spyOn(bundle.recurringEventManager, "clearWithoutNotify");
			const resyncSpy = vi.spyOn(bundle.fileRepository, "resync");

			bundle.refreshCalendar();

			// eventStore.clearWithoutNotify is also reactively invoked by the
			// indexingComplete$ subscription when the resync below restarts indexing,
			// so we assert "at least once" and pin the explicit ones below.
			expect(eventClearSpy).toHaveBeenCalled();
			expect(recurringClearSpy).toHaveBeenCalledTimes(1);
			expect(resyncSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("openFileInCalendar", () => {
		it("returns false for files outside this calendar's directory", async () => {
			const file = createMockFile("OtherFolder/note.md");
			const result = await bundle.openFileInCalendar(file);
			expect(result).toBe(false);
		});

		it("returns false when the file has no frontmatter", async () => {
			const file = createMockFile("Events/note.md");
			(app.metadataCache.getFileCache as any).mockReturnValue({ frontmatter: undefined });

			const result = await bundle.openFileInCalendar(file);

			expect(result).toBe(false);
		});

		it("returns false when no recognized date property is present", async () => {
			const file = createMockFile("Events/note.md");
			(app.metadataCache.getFileCache as any).mockReturnValue({
				frontmatter: { Title: "Some note" },
			});

			const result = await bundle.openFileInCalendar(file);

			expect(result).toBe(false);
		});

		it("uses startProp first when present", async () => {
			const file = createMockFile("Events/meeting.md");
			(app.metadataCache.getFileCache as any).mockReturnValue({
				frontmatter: {
					[bundle.settingsStore.currentSettings.startProp]: "2026-04-15T10:00:00",
					[bundle.settingsStore.currentSettings.dateProp]: "2026-04-20",
				},
			});

			const result = await bundle.openFileInCalendar(file);
			expect(result).toBe(true);
		});

		it("falls back to dateProp when startProp is missing", async () => {
			const file = createMockFile("Events/holiday.md");
			(app.metadataCache.getFileCache as any).mockReturnValue({
				frontmatter: { [bundle.settingsStore.currentSettings.dateProp]: "2026-07-04" },
			});

			const result = await bundle.openFileInCalendar(file);
			expect(result).toBe(true);
		});
	});

	describe("undo / redo", () => {
		it("delegates to the command manager", async () => {
			const undoSpy = vi.spyOn(bundle.commandManager, "undo").mockResolvedValue(true);
			const redoSpy = vi.spyOn(bundle.commandManager, "redo").mockResolvedValue(false);

			await expect(bundle.undo()).resolves.toBe(true);
			await expect(bundle.redo()).resolves.toBe(false);

			expect(undoSpy).toHaveBeenCalledTimes(1);
			expect(redoSpy).toHaveBeenCalledTimes(1);
		});
	});

	describe("settings <-> calendar identity", () => {
		it("uses the calendar-scoped directory for indexer registration", () => {
			expect(bundle.settingsStore.currentSettings.directory).toBe("Events");
			// Two bundles sharing the same directory must reuse infrastructure.
			const otherBundle = new CalendarBundle(plugin as any, calendarId, mainStore as any);
			expect(otherBundle.eventStore).toBe(bundle.eventStore);
			otherBundle.destroy();
		});
	});
});
