import { onceAsync, sanitizeForFilename, TemplaterService } from "@real1ty-obsidian-plugins";
import { type App, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import { type Subscription, filter, firstValueFrom } from "rxjs";
import { CalendarView, getCalendarViewType } from "../components/calendar-view";
import type { EventSaveData } from "../components/modals/base-event-modal";
import type CustomCalendarPlugin from "../main";
import { extractZettelId, generateUniqueEventPath, removeZettelId } from "../utils/calendar-events";
import { intoDate } from "../utils/format";
import { CalendarViewStateManager } from "./calendar-view-state-manager";
import type { CategoryTracker } from "./category-tracker";
import {
	AddZettelIdCommand,
	BatchCommandFactory,
	CommandManager,
	CreateEventCommand,
	EditEventCommand,
	type EventData,
} from "./commands";
import type { EventStore, UntrackedEventStore } from "./event-store";
import { HolidayStore } from "./holidays";
import type { Indexer } from "./indexer";
import { IndexerRegistry } from "./indexer-registry";
import { CalDAVSyncService } from "./integrations/caldav/sync";
import { CalDAVSyncStateManager } from "./integrations/caldav/sync-state-manager";
import { ICSSubscriptionSyncService } from "./integrations/ics-subscription/sync";
import { ICSSubscriptionSyncStateManager } from "./integrations/ics-subscription/sync-state-manager";
import { SyncState } from "./integrations/sync-state";
import type { NameSeriesTracker } from "./name-series-tracker";
import type { NotificationManager } from "./notification-manager";
import type { Parser } from "./parser";
import type { RecurringEventManager } from "./recurring-event-manager";
import { CalendarSettingsStore, type SettingsStore } from "./settings-store";

export class CalendarBundle {
	// ─── Lifecycle ───────────────────────────────────────────────
	public readonly settingsStore: CalendarSettingsStore;
	public readonly indexer: Indexer;
	public readonly parser: Parser;
	public readonly eventStore: EventStore;
	public readonly untrackedEventStore: UntrackedEventStore;
	public readonly recurringEventManager: RecurringEventManager;
	public readonly notificationManager: NotificationManager;
	public readonly categoryTracker: CategoryTracker;
	public readonly nameSeriesTracker: NameSeriesTracker;
	public readonly templateService: TemplaterService;
	public readonly viewStateManager: CalendarViewStateManager;
	public readonly commandManager: CommandManager;
	public readonly batchCommandFactory: BatchCommandFactory;
	public readonly caldavSyncStateManager: CalDAVSyncStateManager;
	public readonly icsSubscriptionSyncStateManager: ICSSubscriptionSyncStateManager;
	public readonly holidayStore: HolidayStore;
	public readonly viewType: string;
	private app: App;
	private directory: string;
	private indexerRegistry: IndexerRegistry;
	private mainSettingsStore: SettingsStore;
	private caldavSync = new SyncState<CalDAVSyncService>("CalDAV");
	private icsSubscriptionSync = new SyncState<ICSSubscriptionSyncService>("ICS Subscription");
	private ribbonIconEl: HTMLElement | null = null;
	private readonly subscriptions: Subscription[] = [];

	constructor(
		public readonly plugin: CustomCalendarPlugin,
		public readonly calendarId: string,
		mainSettingsStore: SettingsStore
	) {
		this.app = plugin.app;
		this.mainSettingsStore = mainSettingsStore;
		this.settingsStore = new CalendarSettingsStore(mainSettingsStore, calendarId);
		this.viewType = getCalendarViewType(calendarId);
		this.directory = this.settingsStore.currentSettings.directory;

		this.indexerRegistry = IndexerRegistry.getInstance(this.app);

		const {
			indexer,
			parser,
			eventStore,
			untrackedEventStore,
			recurringEventManager,
			notificationManager,
			categoryTracker,
			nameSeriesTracker,
		} = this.indexerRegistry.getOrCreateIndexer(this.calendarId, this.settingsStore.settings$);

		this.indexer = indexer;
		this.parser = parser;
		this.eventStore = eventStore;
		this.untrackedEventStore = untrackedEventStore;
		this.recurringEventManager = recurringEventManager;
		this.notificationManager = notificationManager;
		this.categoryTracker = categoryTracker;
		this.nameSeriesTracker = nameSeriesTracker;

		this.templateService = new TemplaterService(this.app);
		this.caldavSyncStateManager = new CalDAVSyncStateManager(this.app, this.indexer, this.settingsStore.settings$);
		this.icsSubscriptionSyncStateManager = new ICSSubscriptionSyncStateManager(
			this.app,
			this.indexer,
			this.settingsStore.settings$
		);
		this.viewStateManager = new CalendarViewStateManager();
		this.commandManager = new CommandManager();
		this.batchCommandFactory = new BatchCommandFactory(this.app, this);
		this.holidayStore = new HolidayStore(this.app, this.settingsStore.currentSettings.holidays);
		this.eventStore.setHolidayStore(this.holidayStore);

		this.subscriptions.push(
			this.mainSettingsStore.settings$.subscribe(() => {
				this.startCalDAVAutoSync();
				this.startICSAutoSync();
			}),
			this.settingsStore.settings$.subscribe((settings) => {
				this.updateRibbonIcon(settings.showRibbonIcon);

				const holidaySettingsChanged = this.holidayStore.updateConfig(settings.holidays);

				if (holidaySettingsChanged) {
					this.eventStore.refreshVirtualEvents();
				}
			})
		);
	}

	async initialize(): Promise<void> {
		return await onceAsync(async () => {
			await this.notificationManager.start();
			this.indexer.start();
			await firstValueFrom(this.indexer.indexingComplete$.pipe(filter((complete) => complete)));

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

			const caldavSettings = this.mainSettingsStore.currentSettings.caldav;

			if (caldavSettings.syncOnStartup) {
				const accountsForThisCalendar = caldavSettings.accounts.filter(
					(a) => a.enabled && a.calendarId === this.calendarId
				);

				for (const account of accountsForThisCalendar) {
					void this.syncAccount(account.id);
				}
			}

			const icsSubSettings = this.mainSettingsStore.currentSettings.icsSubscriptions;

			if (icsSubSettings.syncOnStartup) {
				const subscriptionsForThisCalendar = icsSubSettings.subscriptions.filter(
					(s) => s.enabled && s.calendarId === this.calendarId
				);

				for (const subscription of subscriptionsForThisCalendar) {
					void this.syncICSSubscription(subscription.id);
				}
			}

			this.startCalDAVAutoSync();
			this.startICSAutoSync();

			this.updateRibbonIcon(this.settingsStore.currentSettings.showRibbonIcon);
		})();
	}

	destroy(): void {
		// Don't detach leaves here - Obsidian handles that automatically during plugin updates
		// Detaching in onunload causes leaves to reset to their original positions
		// See: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines#Don't+detach+leaves+in+%60onunload%60

		for (const sub of this.subscriptions) sub.unsubscribe();

		if (this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}

		this.caldavSync.destroy();
		this.icsSubscriptionSync.destroy();
		this.caldavSyncStateManager.destroy();
		this.icsSubscriptionSyncStateManager.destroy();
		this.holidayStore.clear();

		this.commandManager.clearHistory();

		// Release shared infrastructure through registry (will only destroy if no other calendars are using it)
		this.indexerRegistry.releaseIndexer(this.calendarId, this.directory);
		// Don't destroy indexer/parser/eventStore/recurringEventManager directly - the registry handles that
		this.settingsStore?.destroy?.();
	}

	// ─── Calendar View ────────────────────────────────────────────

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
			await this.plugin.ensureCalendarViewFocus(existingLeaf);
			void this.plugin.rememberLastUsedCalendar(this.calendarId);
			return;
		}

		// Case 2: Calendar is not open - open it and focus it
		const newLeaf = workspace.getLeaf("tab");
		await newLeaf.setViewState({ type: this.viewType, active: true });
		await workspace.revealLeaf(newLeaf);
		await this.plugin.ensureCalendarViewFocus(newLeaf);
		void this.plugin.rememberLastUsedCalendar(this.calendarId);
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

	// ─── Utilities & Query API ───────────────────────────────────

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

	getCalDAVSettings() {
		return this.mainSettingsStore.currentSettings.caldav;
	}

	getICSSubscriptionSettings() {
		return this.mainSettingsStore.currentSettings.icsSubscriptions;
	}

	// ─── Event CRUD ───────────────────────────────────────────────

	async createEvent(eventData: EventSaveData): Promise<string | null> {
		const settings = this.settingsStore.currentSettings;
		try {
			const commandEventData: EventData = {
				filePath: null,
				title: eventData.title,
				start: eventData.start,
				end: eventData.end ?? undefined,
				allDay: eventData.allDay,
				preservedFrontmatter: eventData.preservedFrontmatter,
			};

			const command = new CreateEventCommand(this.app, this, commandEventData, settings.directory);
			await this.commandManager.executeCommand(command);
			new Notice("Event created successfully");
			return command.getCreatedFilePath();
		} catch (error) {
			console.error("[CalendarBundle] Error creating new event:", error);
			new Notice("Failed to create event");
			return null;
		}
	}

	async updateEvent(eventData: EventSaveData, options?: { ensureZettelId?: boolean }): Promise<string | null> {
		const { filePath } = eventData;
		if (!filePath) {
			new Notice("Failed to update event: no file path found");
			return null;
		}

		try {
			const abstractFile = this.app.vault.getAbstractFileByPath(filePath);
			if (!(abstractFile instanceof TFile)) {
				new Notice(`File not found: ${filePath}`);
				return null;
			}

			let file: TFile = abstractFile;
			let finalFilePath = filePath;
			let zettelIdCommand: AddZettelIdCommand | null = null;

			// Ensure ZettelID if requested (wraps into a single undo entry with the edit)
			if (options?.ensureZettelId) {
				zettelIdCommand = new AddZettelIdCommand(this.app, this, filePath);
				await zettelIdCommand.execute();
				const renamedPath = zettelIdCommand.getRenamedFilePath();
				if (renamedPath) {
					finalFilePath = renamedPath;
					file = this.app.vault.getAbstractFileByPath(finalFilePath) as TFile;
				}
			}

			// Handle file renaming when titleProp is undefined/empty (title lives in the filename).
			// Compare only the title portion (without zettel ID) to detect actual title changes,
			// then rebuild the filename preserving any existing zettel ID suffix.
			const settings = this.settingsStore.currentSettings;
			let pathBeforeTitleRename: string | null = null;

			if (eventData.title && !settings.titleProp) {
				const newTitlePart = removeZettelId(eventData.title);
				const sanitizedTitle = sanitizeForFilename(newTitlePart, {
					style: "preserve",
				});
				const currentTitlePart = removeZettelId(file.basename);

				if (sanitizedTitle && sanitizedTitle !== currentTitlePart) {
					const currentZettelId = extractZettelId(file.basename);
					const newBasename = currentZettelId ? `${sanitizedTitle}-${currentZettelId}` : sanitizedTitle;

					pathBeforeTitleRename = finalFilePath;
					const parentPath = file.parent?.path || "";
					const { fullPath } = generateUniqueEventPath(this.app, parentPath, newBasename);
					await this.app.fileManager.renameFile(file, fullPath);
					finalFilePath = fullPath;
					file = this.app.vault.getAbstractFileByPath(finalFilePath) as TFile;
				}
			}

			const eventDataForCommand = {
				...eventData,
				end: eventData.end ?? undefined,
			};
			const editCommand = new EditEventCommand(this.app, finalFilePath, eventDataForCommand);

			if (zettelIdCommand || pathBeforeTitleRename) {
				// Execute the edit manually, then push a composite command as a single undo entry
				// that covers: zettel ID rename + title rename + frontmatter edit
				await editCommand.execute();
				const titleRenameOldPath = pathBeforeTitleRename;
				const titleRenameNewPath = finalFilePath;
				this.commandManager.registerExecutedCommand({
					execute: async () => {
						if (zettelIdCommand) await zettelIdCommand.execute();
						if (titleRenameOldPath) {
							const f = this.app.vault.getAbstractFileByPath(titleRenameOldPath);
							if (f) await this.app.fileManager.renameFile(f, titleRenameNewPath);
						}
						await editCommand.execute();
					},
					undo: async () => {
						await editCommand.undo();
						if (titleRenameOldPath) {
							const f = this.app.vault.getAbstractFileByPath(titleRenameNewPath);
							if (f) await this.app.fileManager.renameFile(f, titleRenameOldPath);
						}
						if (zettelIdCommand) await zettelIdCommand.undo();
					},
					getType: () => "edit-with-rename",
					canUndo: () => true,
				});
			} else {
				await this.commandManager.executeCommand(editCommand);
			}

			new Notice("Event updated successfully");
			return finalFilePath;
		} catch (error) {
			console.error("[CalendarBundle] Failed to update event:", error);
			new Notice("Failed to update event");
			return null;
		}
	}

	// ─── CalDAV Sync ──────────────────────────────────────────────

	async syncAccount(accountId: string): Promise<void> {
		return this.caldavSync.sync(accountId, () => this.performCalDAVSync(accountId));
	}

	private async performCalDAVSync(accountId: string): Promise<void> {
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
			let syncService = this.caldavSync.getService(syncServiceKey);

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
				this.caldavSync.setService(syncServiceKey, syncService);
			}

			await syncService.sync();
		}
	}

	private startCalDAVAutoSync(): void {
		this.startAutoSync({
			syncState: this.caldavSync,
			getSettings: () => this.mainSettingsStore.currentSettings.caldav,
			getItems: (settings) => settings.accounts.filter((a) => a.enabled && a.calendarId === this.calendarId),
			syncFn: (id) => this.syncAccount(id),
		});
	}

	// ─── ICS Subscription Sync ────────────────────────────────────

	async syncICSSubscription(subscriptionId: string): Promise<void> {
		return this.icsSubscriptionSync.sync(subscriptionId, () => this.performICSSubscriptionSync(subscriptionId));
	}

	private async performICSSubscriptionSync(subscriptionId: string): Promise<void> {
		const icsSubSettings = this.mainSettingsStore.currentSettings.icsSubscriptions;
		const subscription = icsSubSettings.subscriptions.find(
			(s) => s.id === subscriptionId && s.calendarId === this.calendarId
		);

		if (!subscription) {
			console.error(
				`[ICS Subscription][${this.calendarId}] Subscription not found for id: ${subscriptionId}, calendarId: ${this.calendarId}`
			);
			new Notice("Subscription not found for this calendar");
			return;
		}

		if (!subscription.enabled) {
			return;
		}

		let syncService = this.icsSubscriptionSync.getService(subscriptionId);

		if (!syncService) {
			syncService = new ICSSubscriptionSyncService({
				app: this.app,
				bundle: this,
				mainSettingsStore: this.mainSettingsStore,
				syncStateManager: this.icsSubscriptionSyncStateManager,
				subscription,
			});
			this.icsSubscriptionSync.setService(subscriptionId, syncService);
		}

		await syncService.sync();
	}

	private startICSAutoSync(): void {
		this.startAutoSync({
			syncState: this.icsSubscriptionSync,
			getSettings: () => this.mainSettingsStore.currentSettings.icsSubscriptions,
			getItems: (settings) => settings.subscriptions.filter((s) => s.enabled && s.calendarId === this.calendarId),
			syncFn: (id) => this.syncICSSubscription(id),
		});
	}

	private startAutoSync<
		TService extends { destroy(): void },
		TSettings,
		TItem extends { id: string; syncIntervalMinutes: number },
	>(config: {
		syncState: SyncState<TService>;
		getSettings: () => TSettings & { enableAutoSync: boolean };
		getItems: (settings: TSettings) => TItem[];
		syncFn: (id: string) => Promise<void>;
	}): void {
		const settings = config.getSettings();

		if (!settings.enableAutoSync) {
			config.syncState.stopAutoSync();
			return;
		}

		const items = config.getItems(settings);
		config.syncState.startAutoSync(items, config.syncFn);
	}
}
