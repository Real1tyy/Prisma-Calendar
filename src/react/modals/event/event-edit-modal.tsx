import { parseIntoList, serializeFrontmatterValue } from "@real1ty-obsidian-plugins";
import { showReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";

import { createDefaultState, type EventFormState } from "../../../components/modals/event/event-form-state";
import { loadSimpleFieldValues } from "../../../components/modals/event/event-frontmatter-mapper";
import { CSS_PREFIX } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { MinimizedModalManager, type MinimizedModalState } from "../../../core/minimized-modal-manager";
import type { Frontmatter } from "../../../types";
import type { UpdateEventData } from "../../../types/event-boundaries";
import type { SingleCalendarConfig } from "../../../types/settings";
import { isWeekdaySupported, parseRecurrenceType } from "../../../utils/dates/recurring";
import { extractInstanceDate, extractZettelId, removeZettelId } from "../../../utils/events/zettel-id";
import { categorizeProperties, formatDateOnly, formatDateTimeForInput } from "../../../utils/format";
import { getVirtualKind } from "../../../utils/frontmatter/extended-props";
import { getCategoriesFromFilePath, getFileAndFrontmatter } from "../../../utils/obsidian";
import { buildEventSaveData } from "../../event-form/build-event-save-data";
import { EventForm, type EventFormValues } from "../../event-form/event-form";
import type { EventModalData } from "./event-create-modal";
import {
	buildMinimizedState,
	openSavePresetFlow,
	saveMinimizedModalState,
	serializeProps,
	setExtendedPropSafe,
} from "./shared-modal-helpers";

interface OpenEditModalOptions {
	restoreState?: MinimizedModalState;
	onBeforeOpen?: () => void;
	/**
	 * Whether to ensure a ZettelID is appended to the event on save. Defaults to
	 * true. Mirrors the imperative `EventEditModal.setEnsureZettelIdOnSave(...)`
	 * setter so callers that need to bypass ZettelID generation (e.g. importing
	 * external events with their own IDs) can opt out.
	 */
	ensureZettelIdOnSave?: boolean;
}

export interface EditFormDerivedState {
	initialState: EventFormState;
	originalFrontmatter: Frontmatter;
	originalCustomPropertyKeys: Set<string>;
	customPropsInit: Record<string, string>;
	originalZettelId: string | null;
	instanceDateStr: string | null;
	titleHadInstanceDate: boolean;
}

export function deriveEditFormState(
	app: App,
	bundle: CalendarBundle,
	eventData: EventModalData,
	restoreState?: MinimizedModalState
): EditFormDerivedState {
	const settings = bundle.settingsStore.currentSettings;
	const filePath = eventData.extendedProps?.filePath ?? null;

	let originalFrontmatter: Frontmatter = {};
	if (filePath && getVirtualKind(eventData) === "none") {
		try {
			const { frontmatter } = getFileAndFrontmatter(app, filePath);
			originalFrontmatter = { ...frontmatter };
		} catch (error) {
			console.error("[EventEdit] Error loading existing frontmatter:", error);
		}
	}

	const { originalZettelId, instanceDateStr, titleHadInstanceDate, displayTitle } = extractTitleMetadata(
		eventData.title || "",
		filePath
	);

	const simpleFieldValues = loadSimpleFieldValues(originalFrontmatter, settings);
	const categories = filePath ? getCategoriesFromFilePath(app, filePath, settings.categoryProp) : [];
	const participants = settings.participantsProp ? parseIntoList(originalFrontmatter[settings.participantsProp]) : [];
	const prerequisites = settings.prerequisiteProp
		? parseIntoList(originalFrontmatter[settings.prerequisiteProp], { splitCommas: false }).filter((p) => p.trim())
		: [];

	const initialState: EventFormState = restoreState?.formState ?? {
		...createDefaultState(),
		title: displayTitle,
		allDay: eventData.allDay ?? false,
		virtual: eventData.extendedProps?.["virtualKind"] === "manual",
		start: eventData.start ? formatDateTimeForInput(eventData.start) : "",
		end: eventData.end ? formatDateTimeForInput(eventData.end) : "",
		date: eventData.allDay && eventData.start ? formatDateOnly(eventData.start) : "",
		categories,
		participants,
		prerequisites,
		location: simpleFieldValues.location ?? "",
		icon: simpleFieldValues.icon ?? "",
		breakMinutes: simpleFieldValues.breakMinutes ?? "",
		markAsDone: simpleFieldValues.markAsDone ?? false,
		skip: simpleFieldValues.skip ?? false,
		notifyBefore: loadNotifyBefore(originalFrontmatter, settings, eventData.allDay ?? false),
		recurring: loadRecurringState(originalFrontmatter, settings),
	};

	const { displayProperties, otherProperties } = categorizeProperties(
		originalFrontmatter,
		settings,
		eventData.allDay ?? false
	);
	const originalCustomPropertyKeys = new Set([
		...displayProperties.map(([k]) => k),
		...otherProperties.map(([k]) => k),
	]);

	const customPropsInit: Record<string, string> = {};
	for (const [k, v] of [...displayProperties, ...otherProperties]) {
		customPropsInit[k] = serializeFrontmatterValue(v);
	}

	return {
		initialState,
		originalFrontmatter,
		originalCustomPropertyKeys,
		customPropsInit,
		originalZettelId,
		instanceDateStr,
		titleHadInstanceDate,
	};
}

export function openEventEditModal(
	app: App,
	bundle: CalendarBundle,
	eventData: EventModalData,
	options: OpenEditModalOptions = {}
): void {
	const filePath = eventData.extendedProps?.filePath ?? null;
	const {
		initialState,
		originalFrontmatter,
		originalCustomPropertyKeys,
		customPropsInit,
		originalZettelId,
		instanceDateStr,
		titleHadInstanceDate,
	} = deriveEditFormState(app, bundle, eventData, options.restoreState);

	const restoreState = options.restoreState;

	options.onBeforeOpen?.();
	const ensureZettelIdOnSave = options.ensureZettelIdOnSave ?? true;

	showReactModal({
		app,
		cls: "prisma-event-modal",
		cssPrefix: CSS_PREFIX,
		render: (close) => (
			<EventForm
				mode="edit"
				bundle={bundle}
				initialState={initialState}
				initialStopwatchSnapshot={restoreState?.stopwatch}
				initialCustomProperties={
					restoreState?.customProperties ? serializeProps(restoreState.customProperties) : customPropsInit
				}
				originalFrontmatter={originalFrontmatter}
				originalCustomPropertyKeys={originalCustomPropertyKeys}
				currentFilePath={eventData.extendedProps?.filePath ?? null}
				onSubmit={(values) => {
					handleEditSubmit(
						bundle,
						eventData,
						values,
						originalFrontmatter,
						originalCustomPropertyKeys,
						originalZettelId,
						instanceDateStr,
						titleHadInstanceDate,
						ensureZettelIdOnSave
					);
					close();
				}}
				onCancel={close}
				onMinimize={(values) => {
					saveMinimizedModalState(values, "edit", filePath ?? null, originalFrontmatter, bundle);
					close();
				}}
				onSavePreset={(state, customProps) => openSavePresetFlow(app, bundle, state, customProps)}
				onUnmountWithActiveStopwatch={(values) =>
					buildMinimizedState(values, {
						modalType: "edit",
						filePath: filePath ?? null,
						originalFrontmatter,
						bundle,
					})
				}
			/>
		),
	});
}

interface TitleMetadata {
	originalZettelId: string | null;
	instanceDateStr: string | null;
	titleHadInstanceDate: boolean;
	displayTitle: string;
}

function extractTitleMetadata(rawTitle: string, filePath: string | null): TitleMetadata {
	let originalZettelId: string | null = null;
	let displayTitle = rawTitle;

	if (rawTitle) {
		const zettelId = extractZettelId(rawTitle);
		if (zettelId) {
			originalZettelId = `-${zettelId}`;
			displayTitle = removeZettelId(rawTitle);
		}
	}

	const basename = filePath?.split("/").pop()?.replace(/\.md$/, "") || "";
	let instanceDateStr: string | null = null;
	let titleHadInstanceDate = false;

	if (basename) {
		if (!originalZettelId) {
			const zettelIdFromPath = extractZettelId(basename);
			if (zettelIdFromPath) originalZettelId = `-${zettelIdFromPath}`;
		}
		const instanceDate = extractInstanceDate(basename);
		if (instanceDate) {
			instanceDateStr = instanceDate;
			titleHadInstanceDate = displayTitle.includes(instanceDate);
		}
	}

	return { originalZettelId, instanceDateStr, titleHadInstanceDate, displayTitle };
}

function handleEditSubmit(
	bundle: CalendarBundle,
	eventData: EventModalData,
	values: EventFormValues,
	originalFrontmatter: Frontmatter,
	originalCustomPropertyKeys: Set<string>,
	originalZettelId: string | null,
	instanceDateStr: string | null,
	titleHadInstanceDate: boolean,
	ensureZettelIdOnSave: boolean
): void {
	const settings = bundle.settingsStore.currentSettings;
	const saveData = buildEventSaveData(
		values,
		settings,
		originalFrontmatter,
		originalCustomPropertyKeys,
		bundle.plugin.syncStore.data.readOnly
	);

	saveData.title = composeTitleWithZettel(
		values.formState.title,
		originalZettelId,
		instanceDateStr,
		titleHadInstanceDate
	);
	saveData.filePath = eventData.extendedProps?.filePath ?? null;

	const wasManualVirtual = eventData.extendedProps?.["virtualKind"] === "manual";
	const virtualEventId = eventData.extendedProps?.["virtualEventId"] as string | undefined;

	if (saveData.virtual && wasManualVirtual && virtualEventId) {
		void bundle.virtualEventStore.updateFromEventData(virtualEventId, saveData);
		return;
	}

	if (saveData.virtual && !wasManualVirtual && saveData.filePath) {
		void bundle.convertToVirtual(saveData.filePath);
		return;
	}

	if (!saveData.virtual && wasManualVirtual && virtualEventId) {
		void bundle.convertToReal(virtualEventId);
		return;
	}

	if (!saveData.filePath) {
		console.error("[EventEdit] Broken invariant: updateEvent reached without filePath.");
		return;
	}

	const updateData: UpdateEventData = { ...saveData, filePath: saveData.filePath };

	bundle
		.updateEvent(updateData, { ensureZettelId: ensureZettelIdOnSave })
		.then((newFilePath) => {
			if (newFilePath && newFilePath !== saveData.filePath) {
				setExtendedPropSafe(eventData, "filePath", newFilePath);
				// Mirror base-event-modal-edit-modal.ts:314-321 — if the user
				// saved with a still-active stopwatch, the modal is closing now
				// and EventForm's unmount-cleanup will save state under the OLD
				// filePath. Patch the manager state so subsequent persists hit
				// the renamed file.
				const minState = MinimizedModalManager.getState();
				if (minState && minState.modalType === "edit" && minState.filePath === saveData.filePath) {
					MinimizedModalManager.saveState({ ...minState, filePath: newFilePath }, bundle);
				}
			}
		})
		.catch((error: unknown) => console.error("[EventEdit] Error updating event:", error));
}

export function composeTitleWithZettel(
	userTitle: string,
	originalZettelId: string | null,
	instanceDateStr: string | null,
	titleHadInstanceDate: boolean
): string {
	if (!originalZettelId) return userTitle;
	if (instanceDateStr && !titleHadInstanceDate) {
		return `${userTitle} ${instanceDateStr}${originalZettelId}`;
	}
	return `${userTitle}${originalZettelId}`;
}

function loadRecurringState(fm: Frontmatter, settings: SingleCalendarConfig) {
	const rruleType = fm[settings.rruleProp] as string | undefined;
	if (!rruleType) {
		return {
			enabled: false,
			rruleType: "",
			weekdays: [] as string[],
			customFreq: "DAILY",
			customInterval: "1",
			untilDate: "",
			futureInstancesCount: "",
			generatePastEvents: false,
		};
	}

	const weekdays: string[] = [];
	if (isWeekdaySupported(rruleType)) {
		const rruleSpec = fm[settings.rruleSpecProp] as string | undefined;
		if (rruleSpec) {
			weekdays.push(...rruleSpec.split(",").map((d) => d.trim().toLowerCase()));
		}
	}

	const parsed = parseRecurrenceType(rruleType);
	const untilDate = fm[settings.rruleUntilProp];
	const futureCount = fm[settings.futureInstancesCountProp];
	const generatePast = fm[settings.generatePastEventsProp];

	return {
		enabled: true,
		rruleType,
		weekdays,
		customFreq: parsed?.freq ?? "DAILY",
		customInterval: parsed?.interval.toString() ?? "1",
		untilDate: typeof untilDate === "string" ? formatDateOnly(untilDate) : "",
		futureInstancesCount: typeof futureCount === "number" && futureCount > 0 ? String(futureCount) : "",
		generatePastEvents: generatePast === true,
	};
}

function loadNotifyBefore(fm: Frontmatter, settings: SingleCalendarConfig, isAllDay: boolean): string {
	if (!settings.enableNotifications) return "";
	const propName = isAllDay ? settings.daysBeforeProp : settings.minutesBeforeProp;
	const value = fm[propName];
	return typeof value === "number" && value >= 0 ? value.toString() : "";
}
