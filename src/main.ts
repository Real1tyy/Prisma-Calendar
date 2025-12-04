import { extractContentAfterFrontmatter, onceAsync, sanitizeForFilename } from "@real1ty-obsidian-plugins/utils";
import { Notice, Plugin, TFile, type View, type WorkspaceLeaf } from "obsidian";
import { CalendarView, CustomCalendarSettingsTab } from "./components";
import {
	CalendarSelectModal,
	EventCreateModal,
	EventEditModal,
	type ExportOptions,
	ICSImportModal,
} from "./components/modals";
import { COMMAND_IDS } from "./constants";
import { CalendarBundle, IndexerRegistry, MinimizedModalManager, SettingsStore } from "./core";
import { createDefaultCalendarConfig } from "./utils/calendar-settings";
import { intoDate } from "./utils/format";
import { createICSFromEvents, generateICSFilename } from "./utils/ics-export";
import {
	buildFrontmatterFromImportedEvent,
	extractBasenameFromOriginalPath,
	type ImportedEvent,
} from "./utils/ics-import";

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
							new Notice("Prisma calendar: batch selection mode is not active");
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

		addUndoRedoCommand(COMMAND_IDS.UNDO, "Undo", (view) => view.undo());
		addUndoRedoCommand(COMMAND_IDS.REDO, "Redo", (view) => view.redo());

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
			const dateValue: unknown =
				frontmatter[settings.startProp] || frontmatter[settings.dateProp] || frontmatter.Start || frontmatter.Date;
			const parsedDate = intoDate(dateValue);

			if (parsedDate) {
				targetBundle = bundle;
				startDate = parsedDate;
				break;
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

	private showCalendarExportModal(): void {
		if (this.calendarBundles.length === 0) {
			new Notice("No calendars available to export");
			return;
		}

		new CalendarSelectModal(this.app, this.calendarBundles, (options) => {
			void this.exportCalendarAsICS(options);
		}).open();
	}

	private async exportCalendarAsICS(options: ExportOptions): Promise<void> {
		const { bundle, timezone, excludeSkipped } = options;
		const settings = bundle.settingsStore.currentSettings;
		const calendarName = settings.name;
		const vaultName = this.app.vault.getName();

		try {
			let events = bundle.eventStore.getAllEvents();

			if (excludeSkipped) {
				events = events.filter((e) => !e.skipped);
			}

			if (events.length === 0) {
				new Notice("No events to export");
				return;
			}

			const noteContents = new Map<string, string>();
			for (const event of events) {
				const file = this.app.vault.getAbstractFileByPath(event.ref.filePath);
				if (file instanceof TFile) {
					const fullContent = await this.app.vault.cachedRead(file);
					const content = extractContentAfterFrontmatter(fullContent);
					if (content) {
						noteContents.set(event.ref.filePath, content);
					}
				}
			}

			const result = createICSFromEvents(events, {
				calendarName,
				vaultName,
				timezone,
				noteContents,
				categoryProp: settings.categoryProp,
				notifications: {
					minutesBeforeProp: settings.minutesBeforeProp,
					defaultMinutesBefore: settings.defaultMinutesBefore,
					daysBeforeProp: settings.daysBeforeProp,
					defaultDaysBefore: settings.defaultDaysBefore,
				},
				excludeProps: {
					startProp: settings.startProp,
					endProp: settings.endProp,
					dateProp: settings.dateProp,
					allDayProp: settings.allDayProp,
					titleProp: settings.titleProp,
				},
			});

			if (!result.success || !result.content) {
				new Notice(`Failed to generate ICS: ${result.error?.message || "Unknown error"}`);
				console.error("ICS export error:", result.error);
				return;
			}

			const exportFolder = settings.exportFolder;
			const folderExists = this.app.vault.getAbstractFileByPath(exportFolder);
			if (!folderExists) {
				await this.app.vault.createFolder(exportFolder);
			}

			const filename = generateICSFilename(calendarName);
			const filePath = `${exportFolder}/${filename}`;

			await this.app.vault.create(filePath, result.content);
			new Notice(`Exported ${events.length} events to ${filePath}`);
		} catch (error) {
			console.error("ICS export failed:", error);
			new Notice("Failed to export calendar. See console for details.");
		}
	}

	private showCalendarImportModal(): void {
		if (this.calendarBundles.length === 0) {
			new Notice("No calendars available to import to");
			return;
		}

		new ICSImportModal(this.app, this.calendarBundles, async (bundle, events, timezone) => {
			await this.importEventsToCalendar(bundle, events, timezone);
		}).open();
	}

	private async importEventsToCalendar(
		bundle: CalendarBundle,
		events: ImportedEvent[],
		timezone: string
	): Promise<void> {
		const settings = bundle.settingsStore.currentSettings;

		// Get existing event IDs for duplicate detection
		const existingEventIds = new Set(bundle.eventStore.getAllEvents().map((e) => e.id));

		// Filter out events that already exist
		const newEvents = events.filter((e) => !existingEventIds.has(e.uid));
		const skippedCount = events.length - newEvents.length;

		if (skippedCount > 0) {
			new Notice(`Skipping ${skippedCount} events that already exist`);
		}

		if (newEvents.length === 0) {
			new Notice("No new events to import");
			return;
		}

		let successCount = 0;
		let errorCount = 0;

		for (const event of newEvents) {
			try {
				const frontmatter = buildFrontmatterFromImportedEvent(event, settings, timezone);
				const content = event.description ? `\n${event.description}\n` : "";

				const baseName =
					extractBasenameFromOriginalPath(event.originalFilePath) ||
					sanitizeForFilename(event.title, { style: "preserve" }) ||
					"Imported Event";

				await bundle.templateService.createFile({
					title: event.title,
					targetDirectory: settings.directory,
					filename: baseName,
					content: content || undefined,
					frontmatter,
				});
				successCount++;
			} catch (error) {
				console.error(`Failed to import event "${event.title}":`, error);
				errorCount++;
			}
		}

		if (errorCount === 0) {
			new Notice(`Successfully imported ${successCount} events`);
		} else {
			new Notice(`Imported ${successCount} events, ${errorCount} failed`);
		}
	}

	private restoreMinimizedModal(): void {
		const state = MinimizedModalManager.getState();
		if (!state) {
			new Notice("No minimized modal to restore");
			return;
		}

		// Find the calendar bundle
		const bundle = this.calendarBundles.find((b) => b.calendarId === state.calendarId);
		if (!bundle) {
			new Notice("Calendar not found for minimized modal");
			MinimizedModalManager.clear();
			return;
		}

		// Create minimal event data for modal construction
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
			// Edit mode - use bundle's updateEvent method
			modal = new EventEditModal(this.app, bundle, eventData, (saveData) => {
				void bundle.updateEvent(saveData);
			});
		} else {
			// Create mode - use bundle's createEvent method
			modal = new EventCreateModal(this.app, bundle, eventData, (saveData) => {
				void bundle.createEvent(saveData);
			});
		}

		// Set the state to restore before opening
		modal.setRestoreState(state);

		// Clear the saved state
		MinimizedModalManager.clear();

		// Open the modal
		modal.open();
	}
}
