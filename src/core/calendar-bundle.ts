import { generateUniqueFilePath, onceAsync, sanitizeForFilename } from "@real1ty-obsidian-plugins/utils";
import { type App, Notice, TFile, type WorkspaceLeaf } from "obsidian";
import { CalendarView, getCalendarViewType } from "../components/calendar-view";
import type { EventSaveData } from "../components/modals/base-event-modal";
import type CustomCalendarPlugin from "../main";
import { CalendarViewStateManager } from "./calendar-view-state-manager";
import type { CategoryTracker } from "./category-tracker";
import { BatchCommandFactory, CommandManager, CreateEventCommand, EditEventCommand, type EventData } from "./commands";
import type { EventStore } from "./event-store";
import type { Indexer } from "./indexer";
import { IndexerRegistry } from "./indexer-registry";
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
	public readonly viewType: string;
	private app: App;
	private directory: string;
	private indexerRegistry: IndexerRegistry;

	constructor(
		private plugin: CustomCalendarPlugin,
		public readonly calendarId: string,
		mainSettingsStore: SettingsStore
	) {
		this.app = plugin.app;
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
		this.viewStateManager = new CalendarViewStateManager();
		this.commandManager = new CommandManager();
		this.batchCommandFactory = new BatchCommandFactory(this.app, this);
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
		})();
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
}
