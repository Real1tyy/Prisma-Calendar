import {
	activateView,
	buildUtmUrl,
	onceAsync,
	SettingsStore,
	SyncStore,
	waitForCacheReady,
	WhatsNewModal,
	type WhatsNewModalConfig,
} from "@real1ty-obsidian-plugins";
import { Notice, Plugin, TFile, type View, type WorkspaceLeaf } from "obsidian";

import CHANGELOG_CONTENT from "../../docs-site/docs/changelog.md";
import { CustomCalendarSettingsTab } from "./components";
import { AI_CHAT_VIEW_TYPE, AIChatView } from "./components/ai-chat-view";
import type { CalendarComponent } from "./components/calendar-view";
import { showCalendarSelectModal, showICSImportModal, showICSImportProgressModal } from "./components/modals";
import { registerPrismaBasesView } from "./components/views/bases-calendar-view";
import { COMMAND_IDS } from "./constants";
import { CalendarBundle, IndexerRegistry, MinimizedModalManager, PrismaCalendarApiManager } from "./core";
import { exportCalendarAsICS } from "./core/integrations/ics-export";
import { importEventsToCalendar } from "./core/integrations/ics-import";
import type { LicenseManager } from "./core/license";
import { createLicenseManager, PRO_FEATURES } from "./core/license";
import { getProGateUrls } from "./core/pro-feature-previews";
import { CustomCalendarSettingsSchema, type PrismaCalendarSettingsStore, PrismaSyncDataSchema } from "./types";
import { type CalDAVAccount, type ICSSubscription } from "./types/integrations";
import { createDefaultCalendarConfig } from "./utils/calendar-settings";

export default class CustomCalendarPlugin extends Plugin {
	settingsStore!: PrismaCalendarSettingsStore;
	syncStore!: SyncStore<typeof PrismaSyncDataSchema>;
	calendarBundles: CalendarBundle[] = [];
	apiManager!: PrismaCalendarApiManager;
	licenseManager!: LicenseManager;
	private registeredViewTypes: Set<string> = new Set();

	get isProEnabled(): boolean {
		return this.licenseManager.isPro;
	}

	override async onload() {
		this.settingsStore = new SettingsStore(this, CustomCalendarSettingsSchema);
		await this.settingsStore.loadSettings();

		this.licenseManager = createLicenseManager(this.app, this.settingsStore, this.manifest.version);

		this.syncStore = new SyncStore(this.app, this, PrismaSyncDataSchema);
		await this.syncStore.loadData();

		const registry = IndexerRegistry.getInstance(this.app);
		registry.setSyncStore(this.syncStore);

		await this.ensureMinimumCalendars();

		this.initializeCalendarBundles();
		registerPrismaBasesView(this);
		this.apiManager = new PrismaCalendarApiManager(this);
		this.apiManager.exposeFree();
		this.addSettingTab(new CustomCalendarSettingsTab(this.app, this));

		this.registerCommands();
		this.registerAIChatView();

		const licenseSubscription = this.licenseManager.isPro$.subscribe((isPro) => {
			if (isPro) {
				this.apiManager.expose();
			} else {
				this.apiManager.unexpose();
			}
		});
		this.register(() => licenseSubscription.unsubscribe());

		this.app.workspace.onLayoutReady(() => {
			void waitForCacheReady(this.app).then(() => {
				void this.ensureCalendarBundlesReady();
			});
			void this.checkForUpdates();
			void this.licenseManager.initialize();
		});
	}

	override onunload(): void {
		MinimizedModalManager.clear();

		for (const bundle of this.calendarBundles) {
			bundle.destroy();
		}
		this.calendarBundles = [];
		this.registeredViewTypes.clear();

		const registry = IndexerRegistry.getInstance(this.app);
		registry.destroy();
		this.apiManager.destroy();
	}

	async ensureCalendarViewFocus(leaf: WorkspaceLeaf): Promise<void> {
		// Ensure view is loaded if deferred (Obsidian 1.7.2+)
		if (typeof leaf.loadIfDeferred === "function") {
			await leaf.loadIfDeferred();
		}

		this.app.workspace.setActiveLeaf(leaf, { focus: true });

		// Focus the view's container to make commands available
		setTimeout(() => leaf.view.containerEl.focus(), 10);
	}

	async rememberLastUsedCalendar(calendarId: string): Promise<void> {
		if (this.syncStore.data.lastUsedCalendarId === calendarId) {
			return;
		}

		await this.syncStore.updateData({
			lastUsedCalendarId: calendarId,
		});
	}

	private registerAIChatView(): void {
		this.registerViewTypeSafe(AI_CHAT_VIEW_TYPE, (leaf) => new AIChatView(leaf, this));

		this.addCommand({
			id: COMMAND_IDS.OPEN_AI_CHAT,
			name: "Open AI chat",
			callback: () => {
				void this.toggleAIChatPanel();
			},
		});
	}

	private async toggleAIChatPanel(): Promise<void> {
		await activateView(this.app.workspace, {
			viewType: AI_CHAT_VIEW_TYPE,
			placement: "right-sidebar",
			toggle: true,
		});
	}

	private getActiveBundleFromLeaf(): CalendarBundle | null {
		const leaf = this.app.workspace.getMostRecentLeaf();
		if (!leaf) return null;
		const viewType = leaf.view.getViewType();
		return this.calendarBundles.find((b) => b.viewType === viewType) ?? null;
	}

	private getActiveCalendarComponent(): CalendarComponent | null {
		return this.getActiveBundleFromLeaf()?.viewRef.calendarComponent ?? null;
	}

	private registerCommands(): void {
		type CalendarComponentAction = (component: CalendarComponent) => void;

		const addCalendarViewCommand = (id: string, name: string, action: CalendarComponentAction): void => {
			this.addCommand({
				id,
				name,
				checkCallback: (checking: boolean) => {
					const component = this.getActiveCalendarComponent();
					if (component) {
						if (!checking) {
							action(component);
						}
						return true;
					}
					return false;
				},
			});
		};

		const addBatchCommand = (id: string, name: string, action: CalendarComponentAction): void => {
			this.addCommand({
				id,
				name: `Batch: ${name}`,
				checkCallback: (checking: boolean) => {
					const component = this.getActiveCalendarComponent();
					if (component?.isInBatchSelectionMode()) {
						if (!checking) {
							action(component);
						}
						return true;
					}
					if (component && !component.isInBatchSelectionMode()) {
						if (!checking) {
							new Notice("Prisma calendar: batch selection mode is not active");
						}
						return true;
					}
					return false;
				},
			});
		};

		const addApiCommand = (id: string, name: string, action: () => void): void => {
			this.addCommand({
				id,
				name,
				callback: action,
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

		addApiCommand(COMMAND_IDS.UNDO, "Undo", () => {
			void this.apiManager.undo().then((success) => {
				if (!success) new Notice("Nothing to undo");
			});
		});
		addApiCommand(COMMAND_IDS.REDO, "Redo", () => {
			void this.apiManager.redo().then((success) => {
				if (!success) new Notice("Nothing to redo");
			});
		});

		addApiCommand(COMMAND_IDS.CREATE_EVENT, "Create new event", () => {
			void this.apiManager.openCreateEventModal(undefined, false, true);
		});
		addApiCommand(COMMAND_IDS.CREATE_EVENT_WITH_STOPWATCH, "Create new event with stopwatch", () => {
			void this.apiManager.openCreateEventModal(undefined, true, true);
		});
		addApiCommand(COMMAND_IDS.CREATE_UNTRACKED_EVENT, "Create new untracked event", () => {
			this.apiManager.openCreateUntrackedEventModal();
		});
		addApiCommand(COMMAND_IDS.EDIT_CURRENT_NOTE_AS_EVENT, "Edit current note as event", () => {
			void this.apiManager.openEditActiveNoteModal();
		});
		addApiCommand(COMMAND_IDS.ADD_ZETTEL_ID_TO_CURRENT_NOTE, "Add ZettelID to current note", () => {
			void this.apiManager.addZettelIdToActiveNote();
		});
		addApiCommand(COMMAND_IDS.TRIGGER_CURRENT_EVENT_STOPWATCH, "Trigger current event stopwatch", () => {
			void this.apiManager.triggerCurrentEventStopwatch();
		});
		addCalendarViewCommand(COMMAND_IDS.EDIT_LAST_FOCUSED_EVENT, "Edit last focused event", (view) => {
			view.openEditModalForFocusedEvent();
		});
		addCalendarViewCommand(
			COMMAND_IDS.SET_LAST_FOCUSED_EVENT_START_TO_NOW,
			"Set start time to now (focused event)",
			(view) => {
				view.setFocusedEventStartToNow();
			}
		);
		addCalendarViewCommand(
			COMMAND_IDS.SET_LAST_FOCUSED_EVENT_END_TO_NOW,
			"Set end time to now (focused event)",
			(view) => {
				view.setFocusedEventEndToNow();
			}
		);
		addCalendarViewCommand(
			COMMAND_IDS.FILL_LAST_FOCUSED_EVENT_START_FROM_PREVIOUS,
			"Fill start time from previous event (focused event)",
			(view) => {
				view.fillFocusedEventStartFromPrevious();
			}
		);
		addCalendarViewCommand(
			COMMAND_IDS.FILL_LAST_FOCUSED_EVENT_END_FROM_NEXT,
			"Fill end time from next event (focused event)",
			(view) => {
				view.fillFocusedEventEndFromNext();
			}
		);
		addCalendarViewCommand(COMMAND_IDS.TOGGLE_BATCH_SELECTION, "Toggle batch selection", (view) => {
			view.toggleBatchSelection();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_SKIPPED_EVENTS, "Show skipped events", (view) => {
			void view.showSkippedEventsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_RECURRING_EVENTS, "Show recurring events", (view) => {
			void view.showEventsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_FILTERED_EVENTS, "Show filtered events", (view) => {
			void view.showFilteredEventsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_UNTRACKED_EVENTS, "Toggle untracked events dropdown", (view) => {
			view.toggleUntrackedEventsDropdown();
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
		addCalendarViewCommand(COMMAND_IDS.SHOW_DAILY_STATS_FOR_NOW, "Show daily statistics for now", (view) => {
			void view.showDailyStatsModal(new Date());
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_WEEKLY_STATS_FOR_NOW, "Show weekly statistics for now", (view) => {
			void view.showWeeklyStatsModal(new Date());
		});
		addCalendarViewCommand(COMMAND_IDS.SHOW_MONTHLY_STATS_FOR_NOW, "Show monthly statistics for now", (view) => {
			void view.showMonthlyStatsModal(new Date());
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
		addCalendarViewCommand(COMMAND_IDS.SHOW_INTERVAL_BASES, "Show current interval in Bases", (view) => {
			void view.showIntervalEventsModal();
		});
		addCalendarViewCommand(COMMAND_IDS.GO_TO_TODAY, "Go to today", (view) => {
			view.goToToday();
		});
		addCalendarViewCommand(COMMAND_IDS.SCROLL_TO_NOW, "Scroll to current time", (view) => {
			view.scrollToNow();
		});
		addCalendarViewCommand(
			COMMAND_IDS.TOGGLE_PREREQUISITE_CONNECTIONS,
			"Toggle prerequisite connection arrows",
			(view) => {
				view.toggleConnections();
			}
		);
		this.addCommand({
			id: COMMAND_IDS.SHOW_ALL_EVENTS_TIMELINE,
			name: "Show all events timeline",
			checkCallback: (checking) => {
				const bundle = this.getActiveBundleFromLeaf();
				if (!bundle) return false;
				if (!checking) {
					bundle.viewRef.tabbedHandle?.switchTo("timeline");
				}
				return true;
			},
		});
		this.addCommand({
			id: COMMAND_IDS.SHOW_ALL_EVENTS_HEATMAP,
			name: "Show all events heatmap",
			checkCallback: (checking) => {
				const bundle = this.getActiveBundleFromLeaf();
				if (!bundle) return false;
				if (!checking) {
					if (!this.licenseManager.requirePro(PRO_FEATURES.HEATMAP, getProGateUrls("HEATMAP"))) return true;
					bundle.viewRef.tabbedHandle?.switchTo("heatmap");
				}
				return true;
			},
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
				if (!this.licenseManager.requirePro(PRO_FEATURES.CALDAV_SYNC, getProGateUrls("CALDAV_SYNC"))) {
					return;
				}
				const caldavAccounts = this.settingsStore.currentSettings.caldav.accounts;
				for (const account of caldavAccounts) {
					if (account.enabled) {
						await this.syncSingleAccount(account);
					}
				}
			},
		});

		this.addCommand({
			id: COMMAND_IDS.SYNC_ICS_SUBSCRIPTIONS,
			name: "Sync ICS subscriptions",
			callback: async () => {
				if (!this.licenseManager.requirePro(PRO_FEATURES.ICS_SYNC, getProGateUrls("ICS_SYNC"))) {
					return;
				}
				const subscriptions = this.settingsStore.currentSettings.icsSubscriptions.subscriptions;
				for (const sub of subscriptions) {
					if (sub.enabled) {
						await this.syncSingleICSSubscription(sub);
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

		this.addCommand({
			id: COMMAND_IDS.ASSIGN_CATEGORIES_MINIMIZED_MODAL,
			name: "Assign categories to minimized event",
			checkCallback: (checking: boolean) => {
				if (MinimizedModalManager.hasMinimizedModal()) {
					if (!checking) {
						MinimizedModalManager.assignCategories(this.app, this.calendarBundles);
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
		MinimizedModalManager.clear();

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
				void this.rememberLastUsedCalendar(bundle.calendarId);
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

		showCalendarSelectModal(this.app, this.calendarBundles, (options) => {
			void exportCalendarAsICS(this.app, options);
		});
	}

	private showCalendarImportModal(): void {
		if (this.calendarBundles.length === 0) {
			new Notice("No calendars available to import to");
			return;
		}

		showICSImportModal(this.app, this.calendarBundles, async (bundle, events, timezone) => {
			const progressHandle = showICSImportProgressModal(this.app, events.length);

			try {
				const result = await importEventsToCalendar(this.app, bundle, events, timezone, (current, _total, title) => {
					progressHandle.updateProgress(current, title);
				});

				progressHandle.showComplete(result.successCount, result.errorCount, result.skippedCount);
			} catch (error) {
				progressHandle.showError(error instanceof Error ? error.message : "Import failed");
			}
		});
	}

	async syncSingleAccount(account: CalDAVAccount): Promise<void> {
		const bundle = this.calendarBundles.find((b) => b.calendarId === account.calendarId);
		if (!bundle) {
			new Notice("Calendar not found for this account");
			return;
		}

		await bundle.syncAccount(account.id);
	}

	async syncSingleICSSubscription(subscription: ICSSubscription): Promise<void> {
		const bundle = this.calendarBundles.find((b) => b.calendarId === subscription.calendarId);
		if (!bundle) {
			new Notice("Calendar not found for this subscription");
			return;
		}

		await bundle.syncICSSubscription(subscription.id);
	}

	private async checkForUpdates(): Promise<void> {
		const currentVersion = this.manifest.version;
		const lastSeenVersion = this.settingsStore.currentSettings.version;

		if (lastSeenVersion !== currentVersion) {
			const config: WhatsNewModalConfig = {
				cssPrefix: "prisma",
				pluginName: "Prisma Calendar",
				changelogContent: CHANGELOG_CONTENT,
				links: {
					github: "https://github.com/Real1tyy/Prisma-Calendar",
					productPage: buildUtmUrl(
						"https://matejvavroproductivity.com/tools/prisma-calendar/",
						"prisma-calendar",
						"plugin",
						"whats_new",
						"product_page"
					),
					support: buildUtmUrl(
						"https://real1tyy.github.io/Prisma-Calendar/support",
						"prisma-calendar",
						"plugin",
						"whats_new",
						"support"
					),
					changelog: buildUtmUrl(
						"https://real1tyy.github.io/Prisma-Calendar/changelog",
						"prisma-calendar",
						"plugin",
						"whats_new",
						"changelog"
					),
					documentation: buildUtmUrl(
						"https://real1tyy.github.io/Prisma-Calendar/",
						"prisma-calendar",
						"plugin",
						"whats_new",
						"documentation"
					),
				},
				supportSection: {
					heading: "Unlock the full experience with Pro",
					description:
						"Get Dashboard analytics, AI Chat with Claude & GPT, Gantt & Heatmap views, interactive Bases Calendar, CalDAV sync, unlimited calendars, and more.",
					cta: {
						text: "Get Prisma Pro",
						href: buildUtmUrl(
							"https://matejvavroproductivity.com/tools/prisma-calendar/",
							"prisma-calendar",
							"plugin",
							"whats_new",
							"product_page"
						),
					},
				},
			};

			new WhatsNewModal(this.app, this, config, lastSeenVersion, currentVersion).open();
			await this.settingsStore.updateSettings((settings) => ({
				...settings,
				version: currentVersion,
			}));
		}
	}
}
