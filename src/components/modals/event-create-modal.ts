import { MinimizedModalManager } from "../../core/minimized-modal-manager";
import { BaseEventModal } from "./base-event-modal";

export class EventCreateModal extends BaseEventModal {
	private autoStartStopwatch = false;

	setAutoStartStopwatch(autoStart: boolean): void {
		this.autoStartStopwatch = autoStart;
	}

	protected getModalTitle(): string {
		return "Create Event";
	}

	protected getSaveButtonText(): string {
		return "Create";
	}

	protected initialize(): Promise<void> {
		// No initialization needed for create mode
		return Promise.resolve();
	}

	onOpen(): void {
		super.onOpen();

		if (this.autoStartStopwatch && this.stopwatch) {
			this.stopwatch.expand();
			requestAnimationFrame(() => {
				setTimeout(() => {
					this.stopwatch?.start();
				}, 100);
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
		const eventData = this.buildEventData();

		this.bundle
			.createEvent(eventData)
			.then((filePath) => {
				if (filePath && this.isStopwatchActive()) {
					const state = MinimizedModalManager.getState();
					if (state && state.modalType === "create") {
						state.modalType = "edit";
						state.filePath = filePath;
						MinimizedModalManager.saveState(state);
					}
				}
			})
			.catch((error) => {
				console.error("Error creating event:", error);
			});

		this.close();
	}
}
