import { onceAsync } from "@real1ty-obsidian-plugins/utils/async-utils";
import type { App, WorkspaceLeaf } from "obsidian";
import { CalendarView, getCalendarViewType } from "../components/calendar-view";
import type CustomCalendarPlugin from "../main";
import { CalendarViewStateManager } from "./calendar-view-state-manager";
import { BatchCommandFactory, CommandManager } from "./commands";
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

		const { indexer, parser, eventStore, recurringEventManager, notificationManager } =
			this.indexerRegistry.getOrCreateIndexer(this.calendarId, this.settingsStore.settings$);

		this.indexer = indexer;
		this.parser = parser;
		this.eventStore = eventStore;
		this.recurringEventManager = recurringEventManager;
		this.notificationManager = notificationManager;

		this.templateService = new TemplateService(this.app, this.settingsStore.settings$, this.indexer);
		this.viewStateManager = new CalendarViewStateManager();
		this.commandManager = new CommandManager();
		this.batchCommandFactory = new BatchCommandFactory(this.app, this);
	}

	async initialize(): Promise<void> {
		return await onceAsync(async () => {
			this.plugin.registerViewTypeSafe(this.viewType, (leaf) => new CalendarView(leaf, this));

			// @ts-expect-error - registerHoverLinkSource is not in public types but exists in runtime
			this.app.workspace.registerHoverLinkSource(this.viewType, {
				display: this.settingsStore.currentSettings.name,
				defaultMod: true,
			});

			this.plugin.addCommand({
				id: `open-calendar-${this.calendarId}`,
				name: `Open ${this.settingsStore.currentSettings.name}`,
				callback: () => {
					this.activateCalendarView();
				},
			});

			await this.notificationManager.start();
			await this.indexer.start();
		})();
	}

	async activateCalendarView(): Promise<void> {
		const { workspace } = this.app;

		const existingLeaves = workspace.getLeavesOfType(this.viewType);

		// Check if any calendar leaf is currently active by checking each leaf's view state
		// and comparing with the active tab
		let activeCalendarLeaf: WorkspaceLeaf | null = null;

		for (const leaf of existingLeaves) {
			const viewState = leaf.getViewState();
			const isActiveLeaf = workspace.activeLeaf === leaf;

			// Check if this leaf is currently visible/active by checking if it's the active leaf
			if (viewState.active || isActiveLeaf) {
				activeCalendarLeaf = leaf;
				break;
			}
		}

		// Case 1: Calendar is already open and focused - close it
		if (activeCalendarLeaf) {
			activeCalendarLeaf.detach();
			return;
		}

		// Case 2: Calendar is already open but not focused - focus it
		const existingLeaf = existingLeaves[0];
		if (existingLeaf) {
			await workspace.revealLeaf(existingLeaf);
			return;
		}

		// Case 3: Calendar is not open - open it and focus it
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

	destroy(): void {
		this.app.workspace.detachLeavesOfType(this.viewType);
		this.commandManager.clearHistory();

		// Release shared infrastructure through registry (will only destroy if no other calendars are using it)
		this.indexerRegistry.releaseIndexer(this.calendarId, this.directory);
		// Don't destroy indexer/parser/eventStore/recurringEventManager directly - the registry handles that
		this.templateService?.destroy?.();
		this.settingsStore?.destroy?.();
	}
}
