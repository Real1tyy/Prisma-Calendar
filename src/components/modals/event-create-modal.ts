import { afterRender } from "@real1ty-obsidian-plugins";

import { MinimizedModalManager } from "../../core/minimized-modal-manager";
import { openFileInNewTab } from "../../utils/obsidian";
import { BaseEventModal } from "./base-event-modal";

export class EventCreateModal extends BaseEventModal {
	private autoStartStopwatch = false;
	private openCreatedInNewTab = false;

	setAutoStartStopwatch(autoStart: boolean): void {
		this.autoStartStopwatch = autoStart;
	}

	setOpenCreatedInNewTab(openInNewTab: boolean): void {
		this.openCreatedInNewTab = openInNewTab;
	}

	protected getModalTitle(): string {
		return "Create Event";
	}

	protected getSaveButtonText(): string {
		return "Create";
	}

	protected getModalType(): "create" | "edit" {
		return "create";
	}

	protected initialize(): Promise<void> {
		// No initialization needed for create mode
		return Promise.resolve();
	}

	onOpen(): void {
		super.onOpen();

		if (this.autoStartStopwatch && this.stopwatch) {
			this.stopwatch.expand();
			void afterRender().then(() => {
				this.stopwatch?.start();
			});
		}
	}

	protected applyDefaultPreset(): void {
		const settings = this.bundle.settingsStore.currentSettings;

		if (settings.defaultPresetId) {
			const presets = settings.eventPresets || [];
			const defaultPreset = presets.find((p) => p.id === settings.defaultPresetId);

			if (defaultPreset) {
				this.applyPreset(defaultPreset);

				// Also set the selector to show the selected preset
				if (this.presetSelector) {
					this.presetSelector.value = defaultPreset.id;
				}
			}
		}
	}

	public saveEvent(): void {
		this.applyAutoCategories();

		const eventData = this.buildEventData();

		this.bundle
			.createEvent(eventData)
			.then(async (filePath) => {
				if (filePath) {
					this.setEventExtendedProp("filePath", filePath);

					if (this.isStopwatchActive()) {
						const state = MinimizedModalManager.getState();
						if (state && state.modalType === "create") {
							state.modalType = "edit";
							state.filePath = filePath;
							MinimizedModalManager.saveState(state, this.bundle);
						}
					}

					if (this.openCreatedInNewTab) {
						await openFileInNewTab(this.app, filePath);
					}
				}
			})
			.catch((error) => {
				console.error("[EventCreate] Error creating event:", error);
			});

		this.close();
	}
}
