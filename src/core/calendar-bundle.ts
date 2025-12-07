import { generateUniqueFilePath, onceAsync, sanitizeForFilename } from "@real1ty-obsidian-plugins/utils";
import { type App, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import { CalendarView, getCalendarViewType } from "../components/calendar-view";
import type { EventSaveData } from "../components/modals/base-event-modal";
import type CustomCalendarPlugin from "../main";
import { intoDate } from "../utils/format";
import { CalendarViewStateManager } from "./calendar-view-state-manager";
import type { CategoryTracker } from "./category-tracker";
import { BatchCommandFactory, CommandManager, CreateEventCommand, EditEventCommand, type EventData } from "./commands";
import type { EventStore } from "./event-store";
import type { Indexer } from "./indexer";
import { IndexerRegistry } from "./indexer-registry";
import { CalDAVSyncService } from "./integrations/caldav/sync";
import { CalDAVSyncStateManager } from "./integrations/caldav/sync-state-manager";
import type { NotificationManager } from "./notification-manager";
import type { Parser } from "./parser";
import type { RecurringEventManager } from "./recurring-event-manager";
import { CalendarSettingsStore, type SettingsStore } from "./settings-store";
import { TemplateService } from "./templates";

export class CalendarBundle {
	public readonly settingsStore: CalendarSettingsStore;
	public readonly indexer: Indexer;
	public readonly parser: Parser;
	public readonly eventStore: EventStore;
	public readonly recurringEventManager: RecurringEventManager;
	public readonly notificationManager: NotificationManager;
	public readonly categoryTracker: CategoryTracker;
	public readonly templateService: TemplateService;
	public readonly viewStateManager: CalendarViewStateManager;
	public readonly commandManager: CommandManager;
	public readonly batchCommandFactory: BatchCommandFactory;
	public readonly caldavSyncStateManager: CalDAVSyncStateManager;
	public readonly viewType: string;
	private app: App;
	private directory: string;
	private indexerRegistry: IndexerRegistry;
	private mainSettingsStore: SettingsStore;
	private caldavSyncServices: Map<string, CalDAVSyncService> = new Map();
	private autoSyncIntervals: Map<string, number> = new Map();
	private syncPromises: Map<string, Promise<void>> = new Map();
	private ribbonIconEl: HTMLElement | null = null;

	constructor(
		private plugin: CustomCalendarPlugin,
		public readonly calendarId: string,
		mainSettingsStore: SettingsStore
	) {
		this.app = plugin.app;
		this.mainSettingsStore = mainSettingsStore;
		this.settingsStore = new CalendarSettingsStore(mainSettingsStore, calendarId);
		this.viewType = getCalendarViewType(calendarId);
		this.directory = this.settingsStore.currentSettings.directory;

		this.indexerRegistry = IndexerRegistry.getInstance(this.app);

		const { indexer, parser, eventStore, recurringEventManager, notificationManager, categoryTracker } =
			this.indexerRegistry.getOrCreateIndexer(this.calendarId, this.settingsStore.settings$);

		this.indexer = indexer;
		this.parser = parser;
		this.eventStore = eventStore;
		this.recurringEventManager = recurringEventManager;
		this.notificationManager = notificationManager;
		this.categoryTracker = categoryTracker;

		this.templateService = new TemplateService(this.app, this.settingsStore.settings$, this.indexer);
		this.caldavSyncStateManager = new CalDAVSyncStateManager(this.indexer, this.settingsStore.settings$);
		this.viewStateManager = new CalendarViewStateManager();
		this.commandManager = new CommandManager();
		this.batchCommandFactory = new BatchCommandFactory(this.app, this);

		this.mainSettingsStore.settings$.subscribe(() => {
			this.startAutoSync();
		});

		this.settingsStore.settings$.subscribe((settings) => {
			this.updateRibbonIcon(settings.showRibbonIcon);
		});
	}

	getCalDAVSettings() {
		return this.mainSettingsStore.currentSettings.caldav;
	}

	async initialize(): Promise<void> {
		return await onceAsync(async () => {
			this.plugin.registerViewTypeSafe(this.viewType, (leaf: WorkspaceLeaf) => new CalendarView(leaf, this));

			(
				this.app.workspace as unknown as {
					registerHoverLinkSource: (id: string, info: { display: string; defaultMod: boolean }) => void;
				}
			).registerHoverLinkSource(this.viewType, {
				display: this.settingsStore.currentSettings.name,
				defaultMod: true,
			});

			this.plugin.addCommand({
				id: `open-calendar-${this.calendarId}`,
				name: `Open ${this.settingsStore.currentSettings.name}`,
				callback: () => {
					void this.activateCalendarView();
				},
			});

			await this.notificationManager.start();
			await this.indexer.start();

			const caldavSettings = this.mainSettingsStore.currentSettings.caldav;

			if (caldavSettings.syncOnStartup) {
				const accountsForThisCalendar = caldavSettings.accounts.filter(
					(a) => a.enabled && a.calendarId === this.calendarId
				);

				for (const account of accountsForThisCalendar) {
					void this.syncAccount(account.id);
				}
			}

			this.startAutoSync();

			this.updateRibbonIcon(this.settingsStore.currentSettings.showRibbonIcon);
		})();
	}

	private updateRibbonIcon(show: boolean): void {
		if (show && !this.ribbonIconEl) {
			this.ribbonIconEl = this.plugin.addRibbonIcon("calendar-days", this.settingsStore.currentSettings.name, () => {
				void this.activateCalendarView();
			});
		} else if (!show && this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}
	}

	async activateCalendarView(): Promise<void> {
		const { workspace } = this.app;

		const existingLeaves = workspace.getLeavesOfType(this.viewType);

		// Case 1: Calendar is already open - reveal/focus it
		const existingLeaf = existingLeaves[0];
		if (existingLeaf) {
			await workspace.revealLeaf(existingLeaf);
			return;
		}

		// Case 2: Calendar is not open - open it and focus it
		const newLeaf = workspace.getLeaf("tab");
		await newLeaf.setViewState({ type: this.viewType, active: true });
		await workspace.revealLeaf(newLeaf);
	}

	async openFileInCalendar(file: TFile): Promise<boolean> {
		const settings = this.settingsStore.currentSettings;

		// Check if file is within this calendar's directory
		if (!file.path.startsWith(settings.directory)) {
			return false;
		}

		// Get frontmatter and extract date
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter) {
			return false;
		}

		// Try to find a date property (start date, date, or start)
		const dateValue: unknown =
			frontmatter[settings.startProp] || frontmatter[settings.dateProp] || frontmatter.Start || frontmatter.Date;

		const parsedDate = intoDate(dateValue);

		if (!parsedDate) {
			return false;
		}

		// Activate calendar view
		await this.activateCalendarView();

		// Get the calendar view and navigate to the date
		const { workspace } = this.app;
		const existingLeaves = workspace.getLeavesOfType(this.viewType);
		const calendarLeaf = existingLeaves[0];

		if (calendarLeaf) {
			const calendarView = calendarLeaf.view;
			if (calendarView instanceof CalendarView) {
				calendarView.navigateToDate(parsedDate, "timeGridWeek");

				// Highlight the event after a short delay to ensure the calendar has rendered
				setTimeout(() => {
					calendarView.highlightEventByPath(file.path, 5000);
				}, 100);
			}
		}

		return true;
	}

	async undo(): Promise<boolean> {
		return await this.commandManager.undo();
	}

	async redo(): Promise<boolean> {
		return await this.commandManager.redo();
	}

	refreshCalendar(): void {
		// Clear caches before resync to ensure full rebuild
		// Without this, EventStore's isUpToDate() check would skip files
		// whose mtime hasn't changed, causing the refresh to have no effect
		this.eventStore.clearWithoutNotify();
		this.recurringEventManager.clearWithoutNotify();
		this.indexer.resync();
	}

	destroy(): void {
		// Don't detach leaves here - Obsidian handles that automatically during plugin updates
		// Detaching in onunload causes leaves to reset to their original positions
		// See: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Don't+detach+leaves+in+%60onunload%60

		if (this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}

		this.stopAutoSync();
		for (const syncService of this.caldavSyncServices.values()) {
			syncService.destroy();
		}
		this.caldavSyncServices.clear();

		this.commandManager.clearHistory();

		// Release shared infrastructure through registry (will only destroy if no other calendars are using it)
		this.indexerRegistry.releaseIndexer(this.calendarId, this.directory);
		// Don't destroy indexer/parser/eventStore/recurringEventManager directly - the registry handles that
		this.templateService?.destroy?.();
		this.settingsStore?.destroy?.();
	}

	async createEvent(eventData: EventSaveData): Promise<void> {
		const settings = this.settingsStore.currentSettings;
		try {
			const commandEventData: EventData = {
				filePath: null,
				title: eventData.title || `Event ${new Date().toISOString().split("T")[0]}`,
				start: eventData.start,
				end: eventData.end ?? undefined,
				allDay: eventData.allDay,
				preservedFrontmatter: eventData.preservedFrontmatter,
			};

			const command = new CreateEventCommand(this.app, this, commandEventData, settings.directory, new Date());
			await this.commandManager.executeCommand(command);
			new Notice("Event created successfully");
		} catch (error) {
			console.error("Error creating new event:", error);
			new Notice("Failed to create event");
		}
	}

	async updateEvent(eventData: EventSaveData): Promise<void> {
		const { filePath } = eventData;
		if (!filePath) {
			new Notice("Failed to update event: no file path found");
			return;
		}

		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) {
				new Notice(`File not found: ${filePath}`);
				return;
			}

			// Handle file renaming when titleProp is undefined/empty
			const settings = this.settingsStore.currentSettings;
			let finalFilePath = filePath;
			if (eventData.title && !settings.titleProp) {
				const sanitizedTitle = sanitizeForFilename(eventData.title, { style: "preserve" });
				if (sanitizedTitle && sanitizedTitle !== file.basename) {
					const parentPath = file.parent?.path || "";
					const newFilePath = generateUniqueFilePath(this.app, parentPath, sanitizedTitle);
					await this.app.fileManager.renameFile(file, newFilePath);
					finalFilePath = newFilePath;
				}
			}

			const eventDataForCommand = {
				...eventData,
				end: eventData.end ?? undefined,
			};
			const command = new EditEventCommand(this.app, this, finalFilePath, eventDataForCommand);
			await this.commandManager.executeCommand(command);

			new Notice("Event updated successfully");
		} catch (error) {
			console.error("Failed to update event:", error);
			new Notice("Failed to update event");
		}
	}

	async syncAccount(accountId: string): Promise<void> {
		const existingSync = this.syncPromises.get(accountId);
		if (existingSync) {
			console.debug(`[CalDAV][${this.calendarId}] Sync already in progress for account ${accountId}, reusing promise`);
			return existingSync;
		}

		const syncPromise = this.performSync(accountId);
		this.syncPromises.set(accountId, syncPromise);

		try {
			await syncPromise;
		} finally {
			this.syncPromises.delete(accountId);
		}
	}

	private async performSync(accountId: string): Promise<void> {
		const caldavSettings = this.mainSettingsStore.currentSettings.caldav;
		const account = caldavSettings.accounts.find((a) => a.id === accountId && a.calendarId === this.calendarId);

		if (!account) {
			console.error(
				`[CalDAV][${this.calendarId}] Account not found for accountId: ${accountId}, calendarId: ${this.calendarId}`
			);
			new Notice("Account not found for this calendar");
			return;
		}

		if (!account.enabled) {
			return;
		}

		if (account.selectedCalendars.length === 0) {
			return;
		}

		for (const calendarUrl of account.selectedCalendars) {
			const syncServiceKey = `${accountId}-${calendarUrl}`;
			let syncService = this.caldavSyncServices.get(syncServiceKey);

			if (!syncService) {
				syncService = new CalDAVSyncService({
					app: this.app,
					bundle: this,
					mainSettingsStore: this.mainSettingsStore,
					syncStateManager: this.caldavSyncStateManager,
					account,
					calendar: {
						url: calendarUrl,
						displayName: `${account.name} - ${calendarUrl.split("/").pop() || "Calendar"}`,
					},
				});
				await syncService.initialize();
				this.caldavSyncServices.set(syncServiceKey, syncService);
			}

			await syncService.sync();
		}
	}

	startAutoSync(): void {
		this.stopAutoSync();

		const caldavSettings = this.mainSettingsStore.currentSettings.caldav;

		if (!caldavSettings.enableAutoSync) {
			return;
		}

		const accountsForThisCalendar = caldavSettings.accounts.filter(
			(a) => a.enabled && a.calendarId === this.calendarId
		);

		for (const account of accountsForThisCalendar) {
			const intervalMs = account.syncIntervalMinutes * 60 * 1000;

			const intervalId = window.setInterval(() => {
				if ("scheduler" in window && window.scheduler) {
					const scheduler = window.scheduler as {
						postTask: (callback: () => Promise<void>, options?: { priority?: string }) => Promise<void>;
					};
					void scheduler.postTask(() => this.syncAccount(account.id), {
						priority: "background",
					});
				} else {
					void this.syncAccount(account.id);
				}
			}, intervalMs);

			this.autoSyncIntervals.set(account.id, intervalId);
		}
	}

	stopAutoSync(): void {
		for (const intervalId of this.autoSyncIntervals.values()) {
			window.clearInterval(intervalId);
		}
		this.autoSyncIntervals.clear();
		this.syncPromises.clear();
	}
}
