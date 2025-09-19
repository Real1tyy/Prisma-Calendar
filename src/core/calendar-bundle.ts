import { onceAsync } from "@real1ty-obsidian-plugins/utils/async-utils";
import type { App, WorkspaceLeaf } from "obsidian";
import { CalendarView, getCalendarViewType } from "../components/calendar-view";
import type CustomCalendarPlugin from "../main";
import { CalendarViewStateManager } from "./calendar-view-state-manager";
import { EventStore } from "./event-store";
import { Indexer } from "./indexer";
import { Parser } from "./parser";
import { RecurringEventManager } from "./recurring-event-manager";
import { CalendarSettingsStore, type SettingsStore } from "./settings-store";
import { TemplateService } from "./template-service";

export class CalendarBundle {
	public readonly settingsStore: CalendarSettingsStore;
	public readonly indexer: Indexer;
	public readonly parser: Parser;
	public readonly eventStore: EventStore;
	public readonly recurringEventManager: RecurringEventManager;
	public readonly templateService: TemplateService;
	public readonly viewStateManager: CalendarViewStateManager;
	public readonly viewType: string;
	private app: App;

	constructor(
		private plugin: CustomCalendarPlugin,
		public readonly calendarId: string,
		mainSettingsStore: SettingsStore
	) {
		this.app = plugin.app;
		this.settingsStore = new CalendarSettingsStore(mainSettingsStore, calendarId);
		this.viewType = getCalendarViewType(calendarId);

		this.parser = new Parser(this.settingsStore.settings$);
		this.indexer = new Indexer(this.app, this.settingsStore.settings$);
		this.templateService = new TemplateService(this.app, this.settingsStore.settings$);
		this.viewStateManager = new CalendarViewStateManager();

		this.recurringEventManager = new RecurringEventManager(
			this.app,
			this.settingsStore.settings$,
			this.indexer
		);

		this.eventStore = new EventStore(this.indexer, this.parser, this.recurringEventManager);
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

	destroy(): void {
		this.app.workspace.detachLeavesOfType(this.viewType);
		this.indexer?.stop();
		this.parser?.destroy?.();
		this.eventStore?.destroy?.();
		this.recurringEventManager?.destroy?.();
		this.templateService?.destroy?.();
		this.settingsStore?.destroy?.();
		this.plugin.removeCommand(`open-calendar-${this.calendarId}`);
	}
}
