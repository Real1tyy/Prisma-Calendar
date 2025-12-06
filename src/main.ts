import { onceAsync } from "@real1ty-obsidian-plugins/utils";
import { Notice, Plugin, TFile, type View, type WorkspaceLeaf } from "obsidian";
import { CalendarView, CustomCalendarSettingsTab } from "./components";
import { CalendarSelectModal, EventCreateModal, EventEditModal, ICSImportModal } from "./components/modals";
import { COMMAND_IDS } from "./constants";
import { CalendarBundle, IndexerRegistry, MinimizedModalManager, SettingsStore } from "./core";
import { type CalDAVSyncResult, CalDAVSyncService } from "./core/integrations/caldav";
import { exportCalendarAsICS } from "./core/integrations/ics-export";
import { importEventsToCalendar } from "./core/integrations/ics-import";
import { createDefaultCalendarConfig } from "./utils/calendar-settings";

export default class CustomCalendarPlugin extends Plugin {
	settingsStore!: SettingsStore;
	calendarBundles: CalendarBundle[] = [];
	caldavSyncService: CalDAVSyncService | null = null;
	private registeredViewTypes: Set<string> = new Set();
	private autoSyncIntervalId: number | null = null;

	async onload() {
		this.settingsStore = new SettingsStore(this);
		await this.settingsStore.loadSettings();

		await this.ensureMinimumCalendars();

		this.initializeCalendarBundles();
		this.addSettingTab(new CustomCalendarSettingsTab(this.app, this));

		this.registerCommands();

		this.app.workspace.onLayoutReady(() => {
			void this.ensureCalendarBundlesReady().then(() => {
				this.initializeCalDAVSync();
			});
		});
	}

	onunload(): void {
		for (const bundle of this.calendarBundles) {
			bundle.destroy();
		}
		this.calendarBundles = [];
		this.registeredViewTypes.clear();

		this.stopAutoSync();
		this.caldavSyncService?.destroy();
		this.caldavSyncService = null;

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
		addBatchCommand(COMMAND_IDS.BATCH_OPEN_SELECTION, "Open selection", (view) => view.openSelection());
		addBatchCommand(COMMAND_IDS.BATCH_CLONE_NEXT_WEEK, "Clone to next week", (view) => view.cloneSelection(1));
		addBatchCommand(COMMAND_IDS.BATCH_CLONE_PREV_WEEK, "Clone to previous week", (view) => view.cloneSelection(-1));
		addBatchCommand(COMMAND_IDS.BATCH_MOVE_NEXT_WEEK, "Move to next week", (view) => view.moveSelection(1));
		addBatchCommand(COMMAND_IDS.BATCH_MOVE_PREV_WEEK, "Move to previous week", (view) => view.moveSelection(-1));

		addUndoRedoCommand(COMMAND_IDS.UNDO, "Undo", (view) => view.undo());
		addUndoRedoCommand(COMMAND_IDS.REDO, "Redo", (view) => view.redo());

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
			callback: () => {
				void this.syncCalDAVAccounts();
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
						this.restoreMinimizedModal();
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
			await importEventsToCalendar(bundle, events, timezone);
		}).open();
	}

	private restoreMinimizedModal(): void {
		const state = MinimizedModalManager.getState();
		if (!state) {
			new Notice("No minimized modal to restore");
			return;
		}

		const bundle = this.calendarBundles.find((b) => b.calendarId === state.calendarId);
		if (!bundle) {
			new Notice("Calendar not found for minimized modal");
			MinimizedModalManager.clear();
			return;
		}

		const eventData = {
			title: state.title ?? "",
			start: state.startDate ?? null,
			end: state.endDate ?? null,
			allDay: state.allDay ?? false,
			extendedProps: {
				filePath: state.filePath,
			},
		};

		let modal: EventCreateModal | EventEditModal;
		if (state.modalType === "edit" && state.filePath) {
			modal = new EventEditModal(this.app, bundle, eventData, (saveData) => {
				void bundle.updateEvent(saveData);
			});
		} else {
			modal = new EventCreateModal(this.app, bundle, eventData, (saveData) => {
				void bundle.createEvent(saveData);
			});
		}

		modal.setRestoreState(state);
		MinimizedModalManager.clear();
		modal.open();
	}

	private initializeCalDAVSync(): void {
		const settings = this.settingsStore.currentSettings;
		const caldavSettings = settings.caldav;

		if (caldavSettings.accounts.length === 0) {
			return;
		}

		const calendarConfig = settings.calendars[0];
		if (!calendarConfig) {
			return;
		}

		this.caldavSyncService = new CalDAVSyncService({
			app: this.app,
			caldavSettings,
			calendarConfig,
		});

		// Restore previous sync state for incremental syncing
		if (caldavSettings.syncState && Object.keys(caldavSettings.syncState).length > 0) {
			this.caldavSyncService.loadSyncState(caldavSettings.syncState);
		}

		// Sync on startup if enabled
		if (caldavSettings.syncOnStartup) {
			void this.syncCalDAVAccounts(true);
		}

		// Set up auto-sync if any account has it enabled
		this.startAutoSync();
	}

	async syncCalDAVAccounts(silent = false): Promise<void> {
		if (!this.caldavSyncService) {
			const settings = this.settingsStore.currentSettings;
			const caldavSettings = settings.caldav;

			if (caldavSettings.accounts.length === 0) {
				if (!silent) {
					new Notice("No calendar accounts configured");
				}
				return;
			}

			const calendarConfig = settings.calendars[0];
			if (!calendarConfig) {
				return;
			}

			this.caldavSyncService = new CalDAVSyncService({
				app: this.app,
				caldavSettings,
				calendarConfig,
			});
		}

		if (!silent) {
			new Notice("Syncing calendar accounts...");
		}

		try {
			const results = await this.caldavSyncService.syncAllAccounts();
			this.handleSyncResults(results, silent);
			await this.persistSyncState();
		} catch (error) {
			console.error("CalDAV sync failed:", error);
			if (!silent) {
				new Notice(`Calendar sync failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	async syncSingleAccount(accountId: string): Promise<CalDAVSyncResult[]> {
		const settings = this.settingsStore.currentSettings;
		const caldavSettings = settings.caldav;
		const account = caldavSettings.accounts.find((a) => a.id === accountId);

		if (!account) {
			new Notice("Account not found");
			return [];
		}

		if (!this.caldavSyncService) {
			const calendarConfig = settings.calendars[0];
			if (!calendarConfig) {
				return [];
			}

			this.caldavSyncService = new CalDAVSyncService({
				app: this.app,
				caldavSettings,
				calendarConfig,
			});
		}

		new Notice(`Syncing ${account.name}...`);

		try {
			const results = await this.caldavSyncService.syncAccount(account);
			this.handleSyncResults(results, false);
			await this.persistSyncState();
			return results;
		} catch (error) {
			console.error(`CalDAV sync failed for ${account.name}:`, error);
			new Notice(`Sync failed for ${account.name}: ${error instanceof Error ? error.message : String(error)}`);
			return [];
		}
	}

	private handleSyncResults(results: CalDAVSyncResult[], silent: boolean): void {
		const totalCreated = results.reduce((sum, r) => sum + r.created, 0);
		const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
		const totalDeleted = results.reduce((sum, r) => sum + r.deleted, 0);
		const errors = results.flatMap((r) => r.errors);

		if (errors.length > 0) {
			console.error("CalDAV sync errors:", errors);
			if (!silent) {
				new Notice(`Calendar sync completed with ${errors.length} error(s)`);
			}
		} else if (!silent) {
			if (totalCreated === 0 && totalUpdated === 0 && totalDeleted === 0) {
				new Notice("Calendar sync complete - no changes");
			} else {
				new Notice(`Calendar sync complete: ${totalCreated} created, ${totalUpdated} updated, ${totalDeleted} deleted`);
			}
		}
	}

	private startAutoSync(): void {
		this.stopAutoSync();

		const settings = this.settingsStore.currentSettings;
		const enabledAccounts = settings.caldav.accounts.filter((a) => a.enabled);

		if (enabledAccounts.length === 0) {
			return;
		}

		// Use the shortest interval among all enabled accounts
		const minIntervalMinutes = Math.min(...enabledAccounts.map((a) => a.syncIntervalMinutes));
		const intervalMs = minIntervalMinutes * 60 * 1000;

		this.autoSyncIntervalId = window.setInterval(() => {
			void this.syncCalDAVAccounts(true);
		}, intervalMs);

		console.debug(`CalDAV auto-sync started with ${minIntervalMinutes} minute interval`);
	}

	private stopAutoSync(): void {
		if (this.autoSyncIntervalId !== null) {
			window.clearInterval(this.autoSyncIntervalId);
			this.autoSyncIntervalId = null;
			console.debug("CalDAV auto-sync stopped");
		}
	}

	updateCalDAVSyncService(): void {
		const settings = this.settingsStore.currentSettings;
		const caldavSettings = settings.caldav;

		if (this.caldavSyncService) {
			const calendarConfig = settings.calendars[0];
			if (calendarConfig) {
				this.caldavSyncService.updateSettings(caldavSettings, calendarConfig);
			}
		}

		// Restart auto-sync with potentially new intervals
		this.startAutoSync();
	}

	private async persistSyncState(): Promise<void> {
		if (!this.caldavSyncService) {
			return;
		}

		const syncState = this.caldavSyncService.serializeSyncState();
		await this.settingsStore.updateSettings((s) => ({
			...s,
			caldav: {
				...s.caldav,
				syncState,
			},
		}));
	}
}
