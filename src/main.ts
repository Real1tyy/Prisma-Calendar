import { onceAsync } from "@real1ty-obsidian-plugins/utils";
import { Notice, Plugin, TFile, type View, type WorkspaceLeaf } from "obsidian";
import { CalendarView, CustomCalendarSettingsTab } from "./components";
import { CalendarSelectModal, ICSImportModal } from "./components/modals";
import { ICSImportProgressModal } from "./components/modals/ics-import-progress-modal";
import { COMMAND_IDS } from "./constants";
import { CalendarBundle, IndexerRegistry, MinimizedModalManager, SettingsStore } from "./core";
import { exportCalendarAsICS } from "./core/integrations/ics-export";
import { importEventsToCalendar } from "./core/integrations/ics-import";
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

		this.registerCommands();

		this.app.workspace.onLayoutReady(() => {
			void this.ensureCalendarBundlesReady();
		});
	}

	onunload(): void {
		for (const bundle of this.calendarBundles) {
			bundle.destroy();
		}
		this.calendarBundles = [];
		this.registeredViewTypes.clear();

		const registry = IndexerRegistry.getInstance(this.app);
		registry.destroy();
	}

	private registerCommands(): void {
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
							new Notice("Prisma calendar: batch selection mode is not active");
						}
						return true;
					}
					return false;
				},
			});
		};

		type UndoRedoAction = (view: CalendarView) => Promise<boolean>;

		const addUndoRedoCommand = (id: string, name: string, action: UndoRedoAction): void => {
			this.addCommand({
				id,
				name,
				checkCallback: (checking: boolean) => {
					const calendarView = this.app.workspace.getActiveViewOfType(CalendarView);
					if (calendarView) {
						if (!checking) {
							void action(calendarView).then((success) => {
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

		addBatchCommand(COMMAND_IDS.BATCH_SELECT_ALL, "Select all", (view) => view.selectAll());
		addBatchCommand(COMMAND_IDS.BATCH_CLEAR_SELECTION, "Clear selection", (view) => view.clearSelection());
		addBatchCommand(COMMAND_IDS.BATCH_DUPLICATE_SELECTION, "Duplicate selection", (view) => view.duplicateSelection());
		addBatchCommand(COMMAND_IDS.BATCH_DELETE_SELECTION, "Delete selection", (view) => view.deleteSelection());
		addBatchCommand(COMMAND_IDS.BATCH_SKIP_SELECTION, "Skip selection", (view) => view.skipSelection());
		addBatchCommand(COMMAND_IDS.BATCH_MARK_AS_DONE, "Mark selection as done", (view) => view.markAsDoneSelection());
		addBatchCommand(COMMAND_IDS.BATCH_MARK_AS_NOT_DONE, "Mark selection as not done", (view) =>
			view.markAsNotDoneSelection()
		);
		addBatchCommand(COMMAND_IDS.BATCH_ASSIGN_CATEGORIES, "Assign categories to selection", (view) => {
			void view.openCategoryAssignModal();
		});
		addBatchCommand(COMMAND_IDS.BATCH_UPDATE_FRONTMATTER, "Update frontmatter for selection", (view) => {
			void view.openBatchFrontmatterModal();
		});
		addBatchCommand(COMMAND_IDS.BATCH_OPEN_SELECTION, "Open selection", (view) => view.openSelection());
		addBatchCommand(COMMAND_IDS.BATCH_CLONE_NEXT_WEEK, "Clone to next week", (view) => view.cloneSelection(1));
		addBatchCommand(COMMAND_IDS.BATCH_CLONE_PREV_WEEK, "Clone to previous week", (view) => view.cloneSelection(-1));
		addBatchCommand(COMMAND_IDS.BATCH_MOVE_NEXT_WEEK, "Move to next week", (view) => view.moveSelection(1));
		addBatchCommand(COMMAND_IDS.BATCH_MOVE_PREV_WEEK, "Move to previous week", (view) => view.moveSelection(-1));

		addUndoRedoCommand(COMMAND_IDS.UNDO, "Undo", (view) => view.undo());
		addUndoRedoCommand(COMMAND_IDS.REDO, "Redo", (view) => view.redo());

		addCalendarViewCommand(COMMAND_IDS.CREATE_EVENT, "Create new event", (view) => {
			view.openCreateEventModal();
		});
		addCalendarViewCommand(COMMAND_IDS.CREATE_EVENT_WITH_STOPWATCH, "Create new event with stopwatch", (view) => {
			view.openCreateEventModal(true);
		});
		addCalendarViewCommand(COMMAND_IDS.TOGGLE_BATCH_SELECTION, "Toggle batch selection", (view) => {
			view.toggleBatchSelection();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_SKIPPED_EVENTS, "Show skipped events", (view) => {
			void view.showSkippedEventsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_RECURRING_EVENTS, "Show recurring events", (view) => {
			void view.showRecurringEventsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_FILTERED_EVENTS, "Show filtered events", (view) => {
			void view.showFilteredEventsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.GLOBAL_SEARCH, "Global event search", (view) => {
			void view.showGlobalSearchModal();
		});
		addCalendarViewCommand(COMMAND_IDS.FOCUS_SEARCH, "Focus search", (view) => {
			void view.focusSearch();
		});
		addCalendarViewCommand(COMMAND_IDS.FOCUS_EXPRESSION_FILTER, "Focus expression filter", (view) => {
			void view.focusExpressionFilter();
		});
		addCalendarViewCommand(COMMAND_IDS.OPEN_FILTER_PRESET_SELECTOR, "Open filter preset selector", (view) => {
			void view.openFilterPresetSelector();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_DAILY_STATS, "Show daily statistics", (view) => {
			void view.showDailyStatsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_WEEKLY_STATS, "Show weekly statistics", (view) => {
			void view.showWeeklyStatsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_MONTHLY_STATS, "Show monthly statistics", (view) => {
			void view.showMonthlyStatsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_ALLTIME_STATS, "Show all-time statistics", (view) => {
			void view.showAllTimeStatsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.REFRESH_CALENDAR, "Refresh calendar", (view) => {
			void view.refreshCalendar();
		});
		addCalendarViewCommand(
			COMMAND_IDS.HIGHLIGHT_EVENTS_WITHOUT_CATEGORIES,
			"Highlight events without categories",
			(view) => {
				view.highlightEventsWithoutCategories();
			}
		);
		addCalendarViewCommand(COMMAND_IDS.HIGHLIGHT_EVENTS_WITH_CATEGORY, "Highlight events with category", (view) => {
			view.showCategorySelectModal();
		});
		addCalendarViewCommand(COMMAND_IDS.NAVIGATE_BACK, "Navigate back", (view) => {
			view.navigateBack();
		});

		this.addCommand({
			id: COMMAND_IDS.EXPORT_CALENDAR_ICS,
			name: "Export calendar as .ics",
			callback: () => {
				this.showCalendarExportModal();
			},
		});

		this.addCommand({
			id: COMMAND_IDS.IMPORT_CALENDAR_ICS,
			name: "Import .ics file",
			callback: () => {
				this.showCalendarImportModal();
			},
		});

		this.addCommand({
			id: COMMAND_IDS.SYNC_CALDAV,
			name: "Sync calendar accounts",
			callback: async () => {
				const caldavAccounts = this.settingsStore.currentSettings.caldav.accounts;
				for (const account of caldavAccounts) {
					if (account.enabled) {
						await this.syncSingleAccount(account.id);
					}
				}
			},
		});

		this.addCommand({
			id: COMMAND_IDS.OPEN_CURRENT_NOTE_IN_CALENDAR,
			name: "Open current note in calendar",
			callback: async () => {
				await this.openCurrentNoteInCalendar();
			},
		});

		this.addCommand({
			id: COMMAND_IDS.RESTORE_MINIMIZED_MODAL,
			name: "Restore minimized event modal",
			checkCallback: (checking: boolean) => {
				if (MinimizedModalManager.hasMinimizedModal()) {
					if (!checking) {
						MinimizedModalManager.restoreModal(this.app, this.calendarBundles);
					}
					return true;
				}
				return false;
			},
		});
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

			console.debug("Created default calendar as none existed");
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

	registerViewTypeSafe(viewType: string, viewCreator: (leaf: WorkspaceLeaf) => View): boolean {
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

		// Find the first calendar bundle that can handle this file
		for (const bundle of this.calendarBundles) {
			const opened = await bundle.openFileInCalendar(activeFile);
			if (opened) {
				return;
			}
		}

		// No matching calendar found
		new Notice("This note is not a calendar event");
	}

	private showCalendarExportModal(): void {
		if (this.calendarBundles.length === 0) {
			new Notice("No calendars available to export");
			return;
		}

		new CalendarSelectModal(this.app, this.calendarBundles, (options) => {
			void exportCalendarAsICS(this.app, options);
		}).open();
	}

	private showCalendarImportModal(): void {
		if (this.calendarBundles.length === 0) {
			new Notice("No calendars available to import to");
			return;
		}

		new ICSImportModal(this.app, this.calendarBundles, async (bundle, events, timezone) => {
			const progressModal = new ICSImportProgressModal(this.app, events.length);
			progressModal.open();

			try {
				const result = await importEventsToCalendar(this.app, bundle, events, timezone, (current, _total, title) => {
					progressModal.updateProgress(current, title);
				});

				progressModal.showComplete(result.successCount, result.errorCount, result.skippedCount);
			} catch (error) {
				progressModal.showError(error instanceof Error ? error.message : "Import failed");
			}
		}).open();
	}

	async syncSingleAccount(accountId: string): Promise<void> {
		const account = this.settingsStore.currentSettings.caldav.accounts.find((a) => a.id === accountId);
		if (!account) {
			new Notice("Account not found");
			return;
		}

		const bundle = this.calendarBundles.find((b) => b.calendarId === account.calendarId);
		if (!bundle) {
			new Notice("Calendar not found for this account");
			return;
		}

		await bundle.syncAccount(accountId);
	}
}
