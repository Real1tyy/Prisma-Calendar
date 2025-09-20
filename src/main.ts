import { onceAsync } from "@real1ty-obsidian-plugins/utils/async-utils";
import { Notice, Plugin } from "obsidian";
import { CalendarView, CustomCalendarSettingsTab } from "./components";
import { CalendarBundle, SettingsStore } from "./core";
import { createDefaultCalendarConfig } from "./types";

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
			id: "toggle-batch-selection",
			name: "Toggle Batch Selection",
			callback: () => {
				const calendarView = this.app.workspace.getActiveViewOfType(CalendarView);
				if (calendarView) {
					calendarView.toggleBatchSelection();
				}
			},
		});

		type CalendarViewAction = (view: CalendarView) => void;

		const addBatchCommand = (id: string, name: string, action: CalendarViewAction): void => {
			this.addCommand({
				id,
				name: `Batch: ${name}`,
				callback: () => {
					const calendarView = this.app.workspace.getActiveViewOfType(CalendarView);
					if (!calendarView) return;
					if (calendarView.isInBatchSelectionMode()) {
						action(calendarView);
					} else {
						new Notice("Prisma Calendar: Batch selection mode is not active");
					}
				},
			});
		};

		addBatchCommand("batch-select-all", "Select All", (view) => view.selectAll());
		addBatchCommand("batch-clear-selection", "Clear Selection", (view) => view.clearSelection());
		addBatchCommand("batch-duplicate-selection", "Duplicate Selection", (view) =>
			view.duplicateSelection()
		);
		addBatchCommand("batch-delete-selection", "Delete Selection", (view) => view.deleteSelection());
		addBatchCommand("batch-open-selection", "Open Selection", (view) => view.openSelection());
		addBatchCommand("batch-clone-next-week", "Clone to Next Week", (view) =>
			view.cloneSelection(1)
		);
		addBatchCommand("batch-clone-prev-week", "Clone to Previous Week", (view) =>
			view.cloneSelection(-1)
		);
		addBatchCommand("batch-move-next-week", "Move to Next Week", (view) => view.moveSelection(1));
		addBatchCommand("batch-move-prev-week", "Move to Previous Week", (view) =>
			view.moveSelection(-1)
		);

		type UndoRedoAction = (view: CalendarView) => Promise<boolean>;

		const addUndoRedoCommand = (id: string, name: string, action: UndoRedoAction): void => {
			this.addCommand({
				id,
				name,
				callback: async () => {
					const calendarView = this.app.workspace.getActiveViewOfType(CalendarView);
					if (calendarView) {
						const success = await action(calendarView);
						if (!success) {
							new Notice(`Nothing to ${name.toLowerCase()}`);
						}
					} else {
						new Notice("No active calendar view");
					}
				},
			});
		};

		addUndoRedoCommand("undo", "Undo", (view) => view.undo());
		addUndoRedoCommand("redo", "Redo", (view) => view.redo());

		this.app.workspace.onLayoutReady(() => {
			this.ensureCalendarBundlesReady();
		});
	}

	async onunload() {
		for (const bundle of this.calendarBundles) {
			bundle.destroy();
		}
		this.calendarBundles = [];
		this.registeredViewTypes.clear();
	}

	private initializeCalendarBundles(): void {
		const settings = this.settingsStore.currentSettings;

		for (const calendarConfig of settings.calendars) {
			if (calendarConfig.enabled) {
				const bundle = new CalendarBundle(this, calendarConfig.id, this.settingsStore);
				this.calendarBundles.push(bundle);
			}
		}
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

			console.info("Created default calendar as none existed");
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

	registerViewTypeSafe(viewType: string, viewCreator: (leaf: any) => any): boolean {
		if (this.registeredViewTypes.has(viewType)) {
			return false;
		}
		this.registerView(viewType, viewCreator);
		this.registeredViewTypes.add(viewType);
		return true;
	}
}
