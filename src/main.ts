import {
	createMonotonicSequencer,
	describeError,
	ensureDirectory,
	normalizeDirectory,
	ReleaseCheckService,
	setIconPickerImplementation,
	SettingsStore,
	SyncStore,
	waitForCacheReady,
	type Sequencer,
} from "@real1ty-obsidian-plugins";
import { showReactIconPicker, showWhatsNewReactModal } from "@real1ty-obsidian-plugins-react";
import { Notice, Plugin, TFile, type View, type WorkspaceLeaf } from "obsidian";

import CHANGELOG_CONTENT from "../../docs-site/docs/changelog.md";
import { registerPrismaCalendarCommands } from "./commands";
import { CustomCalendarSettingsTab } from "./components";
import { AI_CHAT_VIEW_TYPE, AIChatView } from "./components/ai-chat-view";
import type { CalendarComponent } from "./components/calendar-view";
import { showICSImportProgressModal } from "./components/modals";
import { registerPrismaBasesView } from "./components/views/bases-calendar-view";
import { VirtualEventsBlockRenderer } from "./components/virtual-events-block";
import { VIRTUAL_EVENTS_CODE_FENCE } from "./constants";
import {
	CalendarBundle,
	IndexerRegistry,
	LastUsedCalendarStore,
	MinimizedModalManager,
	PrismaCalendarApiManager,
} from "./core";
import { scanVaultForDirectorySuggestions } from "./core/directory-suggestions";
import { exportCalendarAsICS } from "./core/integrations/ics-export";
import { importEventsToCalendar } from "./core/integrations/ics-import";
import { createLicenseManager, type LicenseManager } from "./core/license";
import { installPrismaPerfBridge } from "./core/perf-bridge";
import { buildWhatsNewConfig } from "./core/whats-new-config";
import { openCalendarSelectModal, openFirstLaunchModal, openICSImportModal } from "./react/modals";
import { startPrismaTour } from "./react/onboarding/prisma-tour";
import { CustomCalendarSettingsSchema, PrismaSyncDataSchema, type PrismaCalendarSettingsStore } from "./types";
import { type CalDAVAccount, type ICSSubscription } from "./types/integrations";
import { migrateSharedExcludedProps } from "./utils/calendar/migrations";
import { createDefaultCalendarConfig } from "./utils/calendar/settings";

export default class CustomCalendarPlugin extends Plugin {
	readonly changelogContent: string = CHANGELOG_CONTENT;
	settingsStore!: PrismaCalendarSettingsStore;
	syncStore!: SyncStore<typeof PrismaSyncDataSchema>;
	calendarBundles: CalendarBundle[] = [];
	apiManager!: PrismaCalendarApiManager;
	licenseManager!: LicenseManager;
	releaseCheckService!: ReleaseCheckService;
	settingsSessionState = { tab: "general", scrollTop: { current: 0 } };
	// Shared across every calendar's CommandManager so undo/redo can resolve the
	// most-recently-mutated calendar (see read-operations.resolveHistoryBundle).
	readonly commandSequencer: Sequencer = createMonotonicSequencer();
	private lastUsedCalendarStore = new LastUsedCalendarStore();
	private registeredViewTypes: Set<string> = new Set();

	get isProEnabled(): boolean {
		return this.licenseManager.isPro;
	}

	override async onload() {
		setIconPickerImplementation(showReactIconPicker);
		const isFirstLaunch = (await this.loadData()) === null;
		await migrateSharedExcludedProps(this);
		this.settingsStore = new SettingsStore(this, CustomCalendarSettingsSchema);
		await this.settingsStore.loadSettings();

		this.licenseManager = createLicenseManager(this.app, this.settingsStore, this.manifest.version);
		this.releaseCheckService = new ReleaseCheckService({
			owner: "Real1tyy",
			repo: "Prisma-Calendar",
			currentVersion: this.manifest.version,
			storageKey: "prisma-calendar:release-check",
			isEnabled: () => this.settingsStore.currentSettings.checkForReleaseUpdates,
		});

		this.syncStore = new SyncStore(this.app, this, PrismaSyncDataSchema);
		await this.syncStore.loadData();

		const registry = IndexerRegistry.getInstance(this.app);
		registry.setSyncStore(this.syncStore);

		await this.ensureMinimumCalendars();

		this.initializeCalendarBundles();
		registerPrismaBasesView(this);
		this.registerVirtualEventsCodeFence();
		this.apiManager = new PrismaCalendarApiManager(this);
		this.apiManager.exposeFree();

		// Stress/E2E perf instrumentation — gated on the harness-set `window.E2E`
		// flag so production runs install nothing and pay no measurement overhead.
		if ((window as unknown as { E2E?: boolean }).E2E) {
			installPrismaPerfBridge(this);
		}

		this.addSettingTab(new CustomCalendarSettingsTab(this.app, this));

		this.registerAIChatView();
		registerPrismaCalendarCommands(this);

		const licenseSubscription = this.licenseManager.isPro$.subscribe((isPro) => {
			if (isPro) {
				this.apiManager.expose();
			} else {
				this.apiManager.unexpose();
			}
		});
		this.register(() => licenseSubscription.unsubscribe());

		this.app.workspace.onLayoutReady(() => {
			void waitForCacheReady(this.app).then(async () => {
				if (isFirstLaunch) {
					await this.showFirstLaunchOnboarding();
				} else {
					await this.ensureCalendarBundlesReady();
					void this.checkForUpdates();
					void this.releaseCheckService.checkForUpdates();
				}
				// Auto-start the onboarding tour whenever it hasn't been completed —
				// not only on the very first launch. A user who quit before finishing
				// (tutorialCompleted still false) gets it again next time they open.
				this.maybeStartOnboardingTour();
			});
			void this.licenseManager.initialize();
		});
	}

	override onunload(): void {
		MinimizedModalManager.clear();

		this.licenseManager.dispose();

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
		window.setTimeout(() => leaf.view.containerEl.focus(), 10);
	}

	get lastUsedCalendarId(): string | null {
		return this.lastUsedCalendarStore.get();
	}

	rememberLastUsedCalendar(calendarId: string): void {
		this.lastUsedCalendarStore.set(calendarId);
	}

	private registerVirtualEventsCodeFence(): void {
		this.registerMarkdownCodeBlockProcessor(VIRTUAL_EVENTS_CODE_FENCE, (source, el, ctx) => {
			const renderer = new VirtualEventsBlockRenderer(el, source, this);
			ctx.addChild(renderer);
		});
	}

	private registerAIChatView(): void {
		this.registerViewTypeSafe(AI_CHAT_VIEW_TYPE, (leaf) => new AIChatView(leaf, this));
	}

	getActiveBundleFromLeaf(): CalendarBundle | null {
		const leaf = this.app.workspace.getMostRecentLeaf();
		if (!leaf) return null;
		const viewType = leaf.view.getViewType();
		return this.calendarBundles.find((b) => b.viewType === viewType) ?? null;
	}

	getActiveCalendarComponent(): CalendarComponent | null {
		return this.getActiveBundleFromLeaf()?.viewRef.calendarComponent ?? null;
	}

	private initializeCalendarBundles(): void {
		const settings = this.settingsStore.currentSettings;

		this.calendarBundles = settings.calendars
			.filter((calendarConfig) => calendarConfig.enabled)
			.map((calendarConfig) => new CalendarBundle(this, calendarConfig.id, this.settingsStore));

		for (const bundle of this.calendarBundles) {
			bundle.registerView();
		}
	}

	async ensureCalendarBundlesReady(): Promise<void> {
		for (const bundle of this.calendarBundles) {
			await bundle.initialize();
		}
	}

	private async ensureMinimumCalendars(): Promise<void> {
		const settings = this.settingsStore.currentSettings;

		if (settings.calendars.length === 0) {
			const defaultCalendar = createDefaultCalendarConfig("default", "Main Calendar");

			await this.settingsStore.updateSettings((currentSettings) => ({
				...currentSettings,
				calendars: [defaultCalendar],
			}));

			console.debug("Created default calendar as none existed");
		}
	}

	async addCalendarBundle(calendarId: string): Promise<void> {
		const bundle = new CalendarBundle(this, calendarId, this.settingsStore);
		this.calendarBundles.push(bundle);
		bundle.registerView();
		await bundle.initialize();
	}

	removeCalendarBundle(calendarId: string): Promise<void> {
		const idx = this.calendarBundles.findIndex((b) => b.calendarId === calendarId);
		if (idx === -1) return Promise.resolve();
		const bundle = this.calendarBundles[idx];

		this.app.workspace.detachLeavesOfType(bundle.viewType);
		this.registeredViewTypes.delete(bundle.viewType);

		bundle.destroy();
		this.calendarBundles.splice(idx, 1);
		return Promise.resolve();
	}

	prepareForBundleRefresh(): void {
		for (const bundle of this.calendarBundles) {
			bundle.prepareForRefresh();
		}
	}

	async refreshCalendarBundles(): Promise<void> {
		MinimizedModalManager.clear();
		this.prepareForBundleRefresh();

		const openViewTypes = new Set(
			this.calendarBundles
				.filter((b) => this.app.workspace.getLeavesOfType(b.viewType).length > 0)
				.map((b) => b.viewType)
		);

		for (const bundle of this.calendarBundles) {
			this.app.workspace.detachLeavesOfType(bundle.viewType);
			this.registeredViewTypes.delete(bundle.viewType);
		}

		for (const bundle of this.calendarBundles) {
			bundle.destroy();
		}
		this.calendarBundles = [];

		this.initializeCalendarBundles();
		await this.ensureCalendarBundlesReady();

		for (const bundle of this.calendarBundles) {
			if (openViewTypes.has(bundle.viewType)) {
				await bundle.activateCalendarView();
			}
		}
	}

	registerViewTypeSafe(viewType: string, viewCreator: (leaf: WorkspaceLeaf) => View): boolean {
		if (this.registeredViewTypes.has(viewType)) {
			return false;
		}
		this.registerView(viewType, viewCreator);
		this.registeredViewTypes.add(viewType);
		return true;
	}

	async openCurrentNoteInCalendar(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile || !(activeFile instanceof TFile)) {
			new Notice("No file is currently open");
			return;
		}

		// Find the first calendar bundle that can handle this file
		for (const bundle of this.calendarBundles) {
			const opened = await bundle.openFileInCalendar(activeFile);
			if (opened) {
				this.rememberLastUsedCalendar(bundle.calendarId);
				return;
			}
		}

		// No matching calendar found
		new Notice("This note is not a calendar event");
	}

	showCalendarExportModal(): void {
		if (this.calendarBundles.length === 0) {
			new Notice("No planning systems available to export");
			return;
		}

		void openCalendarSelectModal(this.app, this.calendarBundles).then((options) => {
			if (options) void exportCalendarAsICS(this.app, options);
		});
	}

	async showCalendarImportModal(): Promise<void> {
		if (this.calendarBundles.length === 0) {
			new Notice("No planning systems available to import to");
			return;
		}

		const selection = await openICSImportModal(this.app, this.calendarBundles);
		if (!selection) return;

		const { bundle, events, timezone } = selection;
		const progressHandle = showICSImportProgressModal(this.app, events.length);

		try {
			const result = await importEventsToCalendar(this.app, bundle, events, timezone, (current, _total, title) =>
				progressHandle.updateProgress(current, title)
			);

			progressHandle.showComplete(result.successCount, result.errorCount, result.skippedCount);
		} catch (error) {
			progressHandle.showError(describeError(error, "Import failed"));
		}
	}

	async syncSingleAccount(account: CalDAVAccount): Promise<void> {
		const bundle = this.calendarBundles.find((b) => b.calendarId === account.calendarId);
		if (!bundle) {
			new Notice("Planning system not found for this account");
			return;
		}

		await bundle.syncAccount(account.id);
	}

	async syncSingleICSSubscription(subscription: ICSSubscription): Promise<void> {
		const bundle = this.calendarBundles.find((b) => b.calendarId === subscription.calendarId);
		if (!bundle) {
			new Notice("Planning system not found for this subscription");
			return;
		}

		await bundle.syncICSSubscription(subscription.id);
	}

	private async checkForUpdates(): Promise<void> {
		const currentVersion = this.manifest.version;
		const lastSeenVersion = this.settingsStore.currentSettings.version;

		if (lastSeenVersion !== currentVersion) {
			const config = buildWhatsNewConfig(CHANGELOG_CONTENT, "whats_new");
			showWhatsNewReactModal(this.app, this, config, lastSeenVersion, currentVersion);
			await this.settingsStore.updateSettings((settings) => ({
				...settings,
				version: currentVersion,
			}));
		}
	}

	private async showFirstLaunchOnboarding(): Promise<void> {
		const scannedSuggestionsPromise = scanVaultForDirectorySuggestions(this.app);
		const primaryCalendar = this.settingsStore.currentSettings.calendars[0];

		const result = await openFirstLaunchModal({
			app: this.app,
			loadSuggestions: () => scannedSuggestionsPromise,
			initialProps: {
				startProp: primaryCalendar.startProp,
				endProp: primaryCalendar.endProp,
				dateProp: primaryCalendar.dateProp,
			},
		});

		const currentVersion = this.manifest.version;
		const directory = normalizeDirectory(result?.directory ?? "");

		if (directory) {
			await ensureDirectory(this.app, directory);
		}

		await this.settingsStore.updateSettings((settings) => ({
			...settings,
			version: currentVersion,
			calendars: settings.calendars.map((calendar, index) =>
				index === 0
					? {
							...calendar,
							directory,
							startProp: result?.startProp ?? primaryCalendar.startProp,
							endProp: result?.endProp ?? primaryCalendar.endProp,
							dateProp: result?.dateProp ?? primaryCalendar.dateProp,
						}
					: calendar
			),
		}));

		await this.ensureCalendarBundlesReady();

		const bundle = this.calendarBundles.at(0);
		if (bundle) {
			await bundle.activateCalendarView();
		}
	}

	private maybeStartOnboardingTour(): void {
		if (this.settingsStore.currentSettings.tutorialCompleted) return;
		startPrismaTour(this);
	}
}
