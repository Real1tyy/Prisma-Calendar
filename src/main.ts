import { onceAsync } from "@real1ty-obsidian-plugins/utils";
import { Notice, Plugin, TFile } from "obsidian";
import { CalendarView, CustomCalendarSettingsTab } from "./components";
import { COMMAND_IDS } from "./constants";
import { CalendarBundle, IndexerRegistry, SettingsStore } from "./core";
import { createDefaultCalendarConfig } from "./utils/calendar-settings";

export default class CustomCalendarPlugin extends Plugin {
	settingsStore!: SettingsStore;
	calendarBundles: CalendarBundle[] = [];
	private registeredViewTypes: Set<string> = new Set();

	async onload() {
		this.settingsStore = new SettingsStore(this);
		await this.settingsStore.loadSettings();

		await this.ensureMinimumCalendars();

		this.initializeCalendarBundles();
		this.addSettingTab(new CustomCalendarSettingsTab(this.app, this));

		this.addCommand({
			id: COMMAND_IDS.TOGGLE_BATCH_SELECTION,
			name: "Toggle batch selection",
			checkCallback: (checking: boolean) => {
				const calendarView = this.app.workspace.getActiveViewOfType(CalendarView);
				if (calendarView) {
					if (!checking) {
						calendarView.toggleBatchSelection();
					}
					return true;
				}
				return false;
			},
		});

		type CalendarViewAction = (view: CalendarView) => void;

		const addCalendarViewCommand = (id: string, name: string, action: CalendarViewAction): void => {
			this.addCommand({
				id,
				name,
				checkCallback: (checking: boolean) => {
					const calendarView = this.app.workspace.getActiveViewOfType(CalendarView);
					if (calendarView) {
						if (!checking) {
							action(calendarView);
						}
						return true;
					}
					return false;
				},
			});
		};

		const addBatchCommand = (id: string, name: string, action: CalendarViewAction): void => {
			this.addCommand({
				id,
				name: `Batch: ${name}`,
				checkCallback: (checking: boolean) => {
					const calendarView = this.app.workspace.getActiveViewOfType(CalendarView);
					if (calendarView?.isInBatchSelectionMode()) {
						if (!checking) {
							action(calendarView);
						}
						return true;
					}
					if (calendarView && !calendarView.isInBatchSelectionMode()) {
						if (!checking) {
							new Notice("Prisma Calendar: Batch selection mode is not active");
						}
						return true; // Still show the command, but notify user
					}
					return false;
				},
			});
		};

		addBatchCommand(COMMAND_IDS.BATCH_SELECT_ALL, "Select all", (view) => view.selectAll());
		addBatchCommand(COMMAND_IDS.BATCH_CLEAR_SELECTION, "Clear selection", (view) => view.clearSelection());
		addBatchCommand(COMMAND_IDS.BATCH_DUPLICATE_SELECTION, "Duplicate selection", (view) => view.duplicateSelection());
		addBatchCommand(COMMAND_IDS.BATCH_DELETE_SELECTION, "Delete selection", (view) => view.deleteSelection());
		addBatchCommand(COMMAND_IDS.BATCH_SKIP_SELECTION, "Skip selection", (view) => view.skipSelection());
		addBatchCommand(COMMAND_IDS.BATCH_OPEN_SELECTION, "Open selection", (view) => view.openSelection());
		addBatchCommand(COMMAND_IDS.BATCH_CLONE_NEXT_WEEK, "Clone to next week", (view) => view.cloneSelection(1));
		addBatchCommand(COMMAND_IDS.BATCH_CLONE_PREV_WEEK, "Clone to previous week", (view) => view.cloneSelection(-1));
		addBatchCommand(COMMAND_IDS.BATCH_MOVE_NEXT_WEEK, "Move to next week", (view) => view.moveSelection(1));
		addBatchCommand(COMMAND_IDS.BATCH_MOVE_PREV_WEEK, "Move to previous week", (view) => view.moveSelection(-1));

		type UndoRedoAction = (view: CalendarView) => Promise<boolean>;

		const addUndoRedoCommand = (id: string, name: string, action: UndoRedoAction): void => {
			this.addCommand({
				id,
				name,
				checkCallback: (checking: boolean) => {
					const calendarView = this.app.workspace.getActiveViewOfType(CalendarView);
					if (calendarView) {
						if (!checking) {
							action(calendarView).then((success) => {
								if (!success) {
									new Notice(`Nothing to ${name.toLowerCase()}`);
								}
							});
						}
						return true;
					}
					return false;
				},
			});
		};

		addUndoRedoCommand(COMMAND_IDS.UNDO, "Undo", (view) => view.undo());
		addUndoRedoCommand(COMMAND_IDS.REDO, "Redo", (view) => view.redo());

		addCalendarViewCommand(COMMAND_IDS.SHOW_SKIPPED_EVENTS, "Show skipped events", (view) =>
			view.showSkippedEventsModal()
		);
		addCalendarViewCommand(COMMAND_IDS.SHOW_DISABLED_RECURRING_EVENTS, "Show disabled recurring events", (view) =>
			view.showDisabledRecurringEventsModal()
		);
		addCalendarViewCommand(COMMAND_IDS.SHOW_FILTERED_EVENTS, "Show filtered events", (view) =>
			view.showFilteredEventsModal()
		);
		addCalendarViewCommand(COMMAND_IDS.GLOBAL_SEARCH, "Global event search", (view) => view.showGlobalSearchModal());
		addCalendarViewCommand(COMMAND_IDS.FOCUS_SEARCH, "Focus search", (view) => view.focusSearch());
		addCalendarViewCommand(COMMAND_IDS.FOCUS_EXPRESSION_FILTER, "Focus expression filter", (view) =>
			view.focusExpressionFilter()
		);
		addCalendarViewCommand(COMMAND_IDS.OPEN_FILTER_PRESET_SELECTOR, "Open filter preset selector", (view) =>
			view.openFilterPresetSelector()
		);
		addCalendarViewCommand(COMMAND_IDS.SHOW_WEEKLY_STATS, "Show weekly statistics", (view) =>
			view.showWeeklyStatsModal()
		);
		addCalendarViewCommand(COMMAND_IDS.SHOW_MONTHLY_STATS, "Show monthly statistics", (view) =>
			view.showMonthlyStatsModal()
		);
		addCalendarViewCommand(COMMAND_IDS.SHOW_ALLTIME_STATS, "Show all-time statistics", (view) =>
			view.showAllTimeStatsModal()
		);
		addCalendarViewCommand(COMMAND_IDS.REFRESH_CALENDAR, "Refresh calendar", (view) => view.refreshCalendar());

		this.addCommand({
			id: COMMAND_IDS.OPEN_CURRENT_NOTE_IN_CALENDAR,
			name: "Open current note in calendar",
			callback: async () => {
				await this.openCurrentNoteInCalendar();
			},
		});

		this.app.workspace.onLayoutReady(() => {
			this.ensureCalendarBundlesReady();
		});
	}

	async onunload() {
		for (const bundle of this.calendarBundles) {
			bundle.destroy();
		}
		this.calendarBundles = [];
		this.registeredViewTypes.clear();

		// Destroy the indexer registry (cleans up any remaining indexers)
		const registry = IndexerRegistry.getInstance(this.app);
		registry.destroy();
	}

	private initializeCalendarBundles(): void {
		const settings = this.settingsStore.currentSettings;

		this.calendarBundles = settings.calendars
			.filter((calendarConfig) => calendarConfig.enabled)
			.map((calendarConfig) => new CalendarBundle(this, calendarConfig.id, this.settingsStore));
	}

	async ensureCalendarBundlesReady(): Promise<void> {
		return await onceAsync(async () => {
			for (const bundle of this.calendarBundles) {
				await bundle.initialize();
			}
		})();
	}

	private async ensureMinimumCalendars(): Promise<void> {
		const settings = this.settingsStore.currentSettings;

		if (!settings.calendars || settings.calendars.length === 0) {
			const defaultCalendar = createDefaultCalendarConfig("default", "Main Calendar");

			await this.settingsStore.updateSettings((currentSettings) => ({
				...currentSettings,
				calendars: [defaultCalendar],
			}));

			console.info("Created default calendar as none existed");
		}
	}

	async refreshCalendarBundles(): Promise<void> {
		for (const bundle of this.calendarBundles) {
			bundle.destroy();
		}
		this.calendarBundles = [];

		this.initializeCalendarBundles();
		await this.ensureCalendarBundlesReady();
	}

	registerViewTypeSafe(viewType: string, viewCreator: (leaf: any) => any): boolean {
		if (this.registeredViewTypes.has(viewType)) {
			return false;
		}
		this.registerView(viewType, viewCreator);
		this.registeredViewTypes.add(viewType);
		return true;
	}

	private async openCurrentNoteInCalendar(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile || !(activeFile instanceof TFile)) {
			new Notice("No file is currently open");
			return;
		}

		const cache = this.app.metadataCache.getFileCache(activeFile);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter) {
			new Notice("Current note has no frontmatter");
			return;
		}

		// Find the calendar bundle that contains this file
		let targetBundle: CalendarBundle | null = null;
		let startDate: Date | null = null;
		let isInAnyCalendarDirectory = false;

		for (const bundle of this.calendarBundles) {
			const settings = bundle.settingsStore.currentSettings;
			const directory = settings.directory;

			// Check if file is within this calendar's directory
			if (!activeFile.path.startsWith(directory)) {
				continue;
			}

			isInAnyCalendarDirectory = true;

			// Try to find a date property (start date, date, or start)
			const dateValue =
				frontmatter[settings.startProp] || frontmatter[settings.dateProp] || frontmatter.Start || frontmatter.Date;

			if (dateValue) {
				const parsedDate = new Date(dateValue);
				if (!Number.isNaN(parsedDate.getTime())) {
					targetBundle = bundle;
					startDate = parsedDate;
					break;
				}
			}
		}

		if (!isInAnyCalendarDirectory) {
			new Notice("This note is not in any calendar directory");
			return;
		}

		if (!targetBundle || !startDate) {
			new Notice("Could not find a valid date property in the current note's frontmatter");
			return;
		}

		// Open/focus the calendar
		const { workspace } = this.app;
		const viewType = targetBundle.viewType;
		const existingLeaves = workspace.getLeavesOfType(viewType);

		let calendarLeaf = existingLeaves[0];

		if (!calendarLeaf) {
			// Calendar is not open - open it
			calendarLeaf = workspace.getLeaf("tab");
			await calendarLeaf.setViewState({ type: viewType, active: true });
		}

		// Focus the calendar leaf
		await workspace.revealLeaf(calendarLeaf);

		// Get the calendar view and navigate to the date
		const calendarView = calendarLeaf.view;
		if (calendarView instanceof CalendarView) {
			calendarView.navigateToDate(startDate, "timeGridWeek");

			// Highlight the event after a short delay to ensure the calendar has rendered
			setTimeout(() => {
				calendarView.highlightEventByPath(activeFile.path, 5000);
			}, 100);
		}
	}
}
