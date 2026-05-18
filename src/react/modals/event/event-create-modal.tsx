import { showReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";

import {
	applyPresetToState,
	createDefaultState,
	type EventFormState,
} from "../../../components/modals/event/event-form-state";
import { CSS_PREFIX } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { MinimizedModalManager, type MinimizedModalState } from "../../../core/minimized-modal-manager";
import { formatDateOnly, formatDateTimeForInput } from "../../../utils/format";
import { openFileInNewTab } from "../../../utils/obsidian";
import { buildEventSaveData } from "../../event-form/build-event-save-data";
import { EventForm, type EventFormValues } from "../../event-form/event-form";
import {
	buildMinimizedState,
	openSavePresetFlow,
	saveMinimizedModalState,
	serializeProps,
	setExtendedPropSafe,
} from "./shared-modal-helpers";

export interface EventModalData {
	title: string;
	start: string | Date | null;
	end?: string | Date | null;
	allDay?: boolean;
	setExtendedProp?: (name: string, value: unknown) => void;
	extendedProps?: {
		filePath?: string | null | undefined;
		[key: string]: unknown;
	};
}

interface OpenCreateModalOptions {
	autoStartStopwatch?: boolean;
	openCreatedInNewTab?: boolean;
	restoreState?: MinimizedModalState;
}

export function openEventCreateModal(
	app: App,
	bundle: CalendarBundle,
	eventData: EventModalData,
	options: OpenCreateModalOptions = {}
): void {
	const settings = bundle.settingsStore.currentSettings;

	let initialState: EventFormState = options.restoreState?.formState ?? {
		...createDefaultState(),
		title: eventData.title || "",
		allDay: eventData.allDay ?? false,
		start: eventData.start ? toInputFormat(eventData.start) : "",
		end: eventData.end ? toInputFormat(eventData.end) : "",
		date: eventData.allDay && eventData.start ? toDateOnly(eventData.start) : "",
	};

	if (!options.restoreState && settings.defaultPresetId) {
		const presets = settings.eventPresets;
		const defaultPreset = presets.find((p) => p.id === settings.defaultPresetId);
		if (defaultPreset) {
			initialState = applyPresetToState(initialState, defaultPreset);
		}
	}

	const restoreState = options.restoreState;

	showReactModal({
		app,
		cls: "prisma-event-modal",
		cssPrefix: CSS_PREFIX,
		render: (close) => (
			<EventForm
				mode="create"
				bundle={bundle}
				initialState={initialState}
				initialStopwatchSnapshot={restoreState?.stopwatch}
				initialCustomProperties={
					restoreState?.customProperties ? serializeProps(restoreState.customProperties) : undefined
				}
				autoStartStopwatch={options.autoStartStopwatch === true}
				currentFilePath={eventData.extendedProps?.filePath ?? null}
				onSubmit={(values) => {
					handleCreateSubmit(app, bundle, eventData, values, options);
					close();
				}}
				onCancel={close}
				onMinimize={(values) => {
					saveMinimizedModalState(values, "create", null, {}, bundle);
					close();
				}}
				onSavePreset={(state, customProps) => {
					openSavePresetFlow(app, bundle, state, customProps);
				}}
				onUnmountWithActiveStopwatch={(values) =>
					buildMinimizedState(values, {
						modalType: "create",
						filePath: null,
						originalFrontmatter: {},
						bundle,
					})
				}
			/>
		),
	});
}

function handleCreateSubmit(
	app: App,
	bundle: CalendarBundle,
	eventData: EventModalData,
	values: EventFormValues,
	options: OpenCreateModalOptions
): void {
	const settings = bundle.settingsStore.currentSettings;
	const saveData = buildEventSaveData(values, settings, {}, new Set(), bundle.plugin.syncStore.data.readOnly);

	if (saveData.virtual) {
		void bundle.createVirtualEvent(saveData);
		return;
	}

	bundle
		.createEvent(saveData)
		.then(async (filePath) => {
			if (!filePath) return;
			setExtendedPropSafe(eventData, "filePath", filePath);
			// If submit ran with a live stopwatch, EventForm's unmount-cleanup
			// already auto-saved a {create, filePath: null} state. Without this
			// upgrade, restoring opens a fresh create modal and a second Save
			// duplicates the just-created file. Rebind to {edit, <new path>}
			// so further edits propagate. No-op when no such pending state.
			MinimizedModalManager.upgradeCreateToEdit(filePath, saveData.preservedFrontmatter);
			if (options.openCreatedInNewTab) {
				await openFileInNewTab(app, filePath);
			}
		})
		.catch((error) => {
			console.error("[EventCreate] Error creating event:", error);
		});
}

function toInputFormat(value: string | Date | null | undefined): string {
	if (!value) return "";
	return formatDateTimeForInput(value);
}

function toDateOnly(value: string | Date | null | undefined): string {
	if (!value) return "";
	return formatDateOnly(value);
}
