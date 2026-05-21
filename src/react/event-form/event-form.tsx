import { parseFrontmatterRecord, serializeFrontmatterValue, toLocalISOString } from "@real1ty-obsidian-plugins";
import { useFocusOnMount, useHandleKeyDown, useSettingsFields, useZodForm } from "@real1ty-obsidian-plugins-react";
import { Notice } from "obsidian";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useController, useWatch, type UseFormReturn } from "react-hook-form";

import {
	applyPresetToState,
	createDefaultState,
	EventFormStateSchema,
	type CustomPropertyEntry,
	type EventFormState,
} from "../../components/modals/event/event-form-state";
import { TitleInputSuggest } from "../../components/title-input-suggest";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { MinimizedModalState } from "../../core/minimized-modal-manager";
import type { Frontmatter } from "../../types";
import { isTimedEvent } from "../../types/calendar";
import { findAdjacentEvent } from "../../utils/events/matching";
import { validateEventTitle } from "../../utils/events/title-validation";
import { Stopwatch, type StopwatchSnapshot } from "../views/stopwatch";
import { useEventFormCategories } from "./hooks/use-event-form-categories";
import { useEventFormLifecycle } from "./hooks/use-event-form-lifecycle";
import { useStopwatch } from "./hooks/use-stopwatch";
import { PrismaSettingItem } from "./prisma-setting-item";
import {
	CategorySection,
	CustomPropertiesSection,
	EventFormFooter,
	EventFormHeader,
	MetadataSection,
	NotificationSection,
	ParticipantSection,
	PrerequisiteSection,
	RecurrenceSection,
	TimingSection,
} from "./sections";
import { customPropertiesToRecord } from "./sections/custom-properties-section";

export interface EventFormValues {
	formState: EventFormState;
	customProperties: Record<string, unknown>;
	stopwatchSnapshot: StopwatchSnapshot | null;
	initialMarkAsDoneState: boolean;
}

export interface EventFormConfig {
	mode: "create" | "edit";
	bundle: CalendarBundle;
	initialState?: EventFormState | undefined;
	initialCustomProperties?: Record<string, string> | undefined;
	initialStopwatchSnapshot?: StopwatchSnapshot | undefined;
	originalFrontmatter?: Frontmatter | undefined;
	originalCustomPropertyKeys?: Set<string> | undefined;
	autoStartStopwatch?: boolean | undefined;
	currentFilePath?: string | null | undefined;
	onSubmit: (values: EventFormValues) => void;
	onCancel: () => void;
	onMinimize?: ((values: EventFormValues) => void) | undefined;
	onSavePreset?: ((state: EventFormState, customProperties: Record<string, unknown>) => void) | undefined;
	/**
	 * Auto-save state on unmount when the stopwatch is still active. Wires the
	 * imperative-modal `onClose` "if isStopwatchActive && !isMinimizing, save"
	 * behaviour (see base-event-modal.ts:229-235) into the React lifecycle.
	 */
	onUnmountWithActiveStopwatch?: ((values: EventFormValues) => MinimizedModalState) | undefined;
}

export const EventForm = memo(function EventForm({
	mode,
	bundle,
	initialState,
	initialCustomProperties,
	initialStopwatchSnapshot,
	autoStartStopwatch = false,
	currentFilePath,
	onSubmit,
	onCancel,
	onMinimize,
	onSavePreset,
	onUnmountWithActiveStopwatch,
}: EventFormConfig) {
	const settings = bundle.settingsStore.currentSettings;

	const displayKeySet = useMemo(
		() => new Set([...settings.frontmatterDisplayProperties, ...settings.frontmatterDisplayPropertiesAllDay]),
		[settings.frontmatterDisplayProperties, settings.frontmatterDisplayPropertiesAllDay]
	);

	const [initialFormState] = useState<EventFormState>(() => {
		const base = initialState ?? createDefaultState();
		const split = splitByDisplayKeys(initialCustomProperties, displayKeySet);
		return {
			...base,
			customPropertiesDisplay: recordToEntries(split.display),
			customPropertiesOther: recordToEntries(split.other),
		};
	});

	const form = useZodForm({
		schema: EventFormStateSchema,
		defaultValues: initialFormState,
	});

	const [suppressAutoCategories, setSuppressAutoCategories] = useState(
		() => (initialState?.categories.length ?? 0) > 0
	);
	const [initialMarkAsDone] = useState(() => initialState?.markAsDone ?? false);
	const titleInputRef = useRef<HTMLInputElement | null>(null);

	const [metadataValues, setMetadataValues] = useState<Record<string, unknown>>(() => ({
		location: initialState?.location ?? "",
		icon: initialState?.icon ?? "",
		breakMinutes: initialState?.breakMinutes ?? "",
		markAsDone: initialState?.markAsDone ?? false,
		skip: initialState?.skip ?? false,
	}));

	const {
		snapshotRef: stopwatchSnapshotRef,
		setHandle: setStopwatchHandle,
		refreshSnapshot: refreshStopwatchSnapshot,
		reset: resetStopwatch,
		onStart: onStopwatchStart,
		onContinueRequested: onStopwatchContinueRequested,
		onResumeRequested: onStopwatchResumeRequested,
		onStop: onStopwatchStop,
		onBreakUpdate: onStopwatchBreakUpdate,
	} = useStopwatch({
		form,
		initialSnapshot: initialStopwatchSnapshot ?? null,
		autoStart: autoStartStopwatch,
		setMetadataValues,
	});

	const categoriesApi = useEventFormCategories({
		bundle,
		settings,
		form,
		suppressAutoCategories,
		setSuppressAutoCategories,
	});

	const collectFormValues = useCallback((): EventFormValues => {
		refreshStopwatchSnapshot();
		const state = applyMetadataToState(form.getValues(), metadataValues);
		const displayRecord = customPropertiesToRecord(state.customPropertiesDisplay);
		const otherRecord = customPropertiesToRecord(state.customPropertiesOther);
		const customProps = parseFrontmatterRecord({ ...displayRecord, ...otherRecord });
		return {
			formState: state,
			customProperties: customProps,
			stopwatchSnapshot: stopwatchSnapshotRef.current,
			initialMarkAsDoneState: initialMarkAsDone,
		};
	}, [refreshStopwatchSnapshot, stopwatchSnapshotRef, form, metadataValues, initialMarkAsDone]);

	const handleSubmit = useCallback(() => {
		const titleCheck = validateEventTitle(form.getValues("title"));
		if (!titleCheck.ok) {
			new Notice(titleCheck.message);
			// Mirror base-event-modal.ts:1591 — focus the title field so the user
			// can correct the offending input without clicking back into it.
			titleInputRef.current?.focus();
			return;
		}
		// Reject submits with no temporal anchor: timed events need a start,
		// all-day events need a date. Without one, buildEventSaveData silently
		// falls back to isUntracked=true and writes an empty placeholder file —
		// not what the user expects when clicking Save on a Clear'd form.
		const isAllDay = form.getValues("allDay");
		if (isAllDay) {
			if (!form.getValues("date")) {
				new Notice("Pick a date before saving.");
				return;
			}
		} else if (!form.getValues("start")) {
			new Notice("Pick a start time before saving.");
			return;
		}
		categoriesApi.applyAutoCategories();
		onSubmit(collectFormValues());
	}, [categoriesApi, form, onSubmit, collectFormValues]);

	const { handleKeyDown, handleMinimize } = useEventFormLifecycle({
		bundle,
		stopwatchSnapshotRef,
		collectFormValues,
		submit: handleSubmit,
		onMinimize,
		onUnmountWithActiveStopwatch,
	});

	useHandleKeyDown({ key: "c", shift: true, mod: true }, categoriesApi.onAssignCategories);
	useHandleKeyDown({ key: "p", shift: true, mod: true }, categoriesApi.onAssignPrerequisites);

	const handleClear = useCallback(() => {
		const defaults = createDefaultState();
		form.reset(defaults);
		setMetadataValues({
			location: "",
			icon: "",
			breakMinutes: "",
			markAsDone: false,
			skip: false,
		});
		setSuppressAutoCategories(false);
		// Mirror base-event-modal.ts:1299 — wipe the stopwatch alongside the rest
		// of the form. Without this, a running stopwatch survives Clear and the
		// next onBreakUpdate writes into the just-cleared breakMinutes field.
		resetStopwatch();
	}, [form, resetStopwatch]);

	const handleSavePreset = useCallback(() => {
		const values = collectFormValues();
		onSavePreset?.(values.formState, values.customProperties);
	}, [collectFormValues, onSavePreset]);

	// Preset selector — reactive projection of settings.eventPresets per
	// docs/decisions/2026-05-13-settings-hook-tiers.md (replaces hand-rolled
	// settings$.subscribe).
	const [{ eventPresets: presets }] = useSettingsFields(bundle.settingsStore, ["eventPresets"]);

	const handlePresetChange = useCallback(
		(presetId: string) => {
			if (!presetId) return;
			const preset = presets.find((p) => p.id === presetId);
			if (!preset) return;

			const current = applyMetadataToState(form.getValues(), metadataValues);
			const updated = applyPresetToState(current, preset);

			let nextDisplay = updated.customPropertiesDisplay;
			let nextOther = updated.customPropertiesOther;
			if (preset.customProperties) {
				const serialized: Record<string, string> = {};
				for (const [k, v] of Object.entries(preset.customProperties)) {
					serialized[k] = serializeFrontmatterValue(v);
				}
				const split = splitByDisplayKeys(serialized, displayKeySet);
				nextDisplay = recordToEntries(split.display);
				nextOther = recordToEntries(split.other);
			}

			form.reset({
				...updated,
				customPropertiesDisplay: nextDisplay,
				customPropertiesOther: nextOther,
			});
			setMetadataValues({
				location: updated.location,
				icon: updated.icon,
				breakMinutes: updated.breakMinutes,
				markAsDone: updated.markAsDone,
				skip: updated.skip,
			});

			if (preset.categories !== undefined) {
				setSuppressAutoCategories(true);
			}
		},
		[form, presets, metadataValues, displayKeySet]
	);

	const fillFromAdjacent = useCallback(
		(direction: "previous" | "next"): Date | null => {
			const startVal = form.getValues("start");
			const isAllDay = form.getValues("allDay");
			const currentTimeISO = isAllDay || !startVal ? null : toLocalISOString(new Date(startVal));
			const adjacent = findAdjacentEvent(bundle.eventStore, currentTimeISO, currentFilePath ?? null, direction);
			if (!adjacent) {
				new Notice(`No ${direction} event found`);
				return null;
			}
			const isPrev = direction === "previous";
			const pickedISO = isPrev ? (isTimedEvent(adjacent) ? adjacent.end : undefined) : adjacent.start;
			if (!pickedISO) {
				new Notice(`${isPrev ? "Previous" : "Next"} event has no ${isPrev ? "end" : "start"} time`);
				return null;
			}
			new Notice(`${isPrev ? "Start" : "End"} time filled from ${direction} event`);
			return toDate(pickedISO);
		},
		[bundle, form, currentFilePath]
	);

	const allDay = useWatch({ control: form.control, name: "allDay" });

	// Retry focus for ~500ms — Obsidian's leaf-then-modal activation can
	// outlast a single focus call when Create is triggered from outside the
	// calendar (command palette, ribbon, hotkey). Stops on first user
	// interaction so we never steal focus from a deliberate click.
	useFocusOnMount(titleInputRef, { retryMs: 500 });

	return (
		<div className="prisma-event-modal-content" onKeyDown={handleKeyDown}>
			<div className="prisma-event-modal-body">
				<EventFormHeader
					mode={mode}
					form={form}
					presets={presets}
					onMinimize={handleMinimize}
					onClear={handleClear}
					onPresetChange={handlePresetChange}
				/>

				{/* Title */}
				<TitleField form={form} onBlur={categoriesApi.onTitleBlur} bundle={bundle} titleInputRef={titleInputRef} />

				{/* Timing */}
				<TimingSection form={form} showDurationField={settings.showDurationField} onFill={fillFromAdjacent} />

				{/* Stopwatch */}
				{settings.showStopwatch && !allDay && (
					<div className="prisma-stopwatch-field">
						<Stopwatch
							ref={setStopwatchHandle}
							onStart={onStopwatchStart}
							onContinueRequested={onStopwatchContinueRequested}
							onResumeRequested={onStopwatchResumeRequested}
							onStop={onStopwatchStop}
							onBreakUpdate={onStopwatchBreakUpdate}
						/>
					</div>
				)}

				{/* Recurrence */}
				<RecurrenceSection form={form} />

				{/* Categories */}
				{settings.categoryProp && (
					<CategorySection
						value={categoriesApi.categories}
						onChange={categoriesApi.onCategoriesChange}
						categoryColors={categoriesApi.categoryColors}
						defaultColor={settings.defaultNodeColor}
						onAssign={categoriesApi.onAssignCategories}
						onCategoryClick={categoriesApi.onCategoryClick}
					/>
				)}

				{/* Prerequisites */}
				{settings.prerequisiteProp && (
					<PrerequisiteSection
						value={categoriesApi.prerequisites}
						onChange={categoriesApi.onPrerequisitesChange}
						getDisplayName={categoriesApi.getPrerequisiteDisplayName}
						onAssign={categoriesApi.onAssignPrerequisites}
					/>
				)}

				{/* Participants */}
				{settings.participantsProp && (
					<ParticipantSection
						value={categoriesApi.participants}
						onChange={categoriesApi.onParticipantsChange}
						getDisplayName={categoriesApi.getDisplayName}
					/>
				)}

				{/* Metadata fields (location, icon, break, markAsDone, skip) */}
				<MetadataSection settings={settings} values={metadataValues} onChange={setMetadataValues} />

				{/* Notifications */}
				{settings.enableNotifications && <NotificationSection form={form} />}

				{/* Custom Properties */}
				<CustomPropertiesSection
					section="display"
					title="Display Properties"
					form={form}
					name="customPropertiesDisplay"
				/>
				<div className="prisma-other-section-spacing">
					<CustomPropertiesSection section="other" title="Other Properties" form={form} name="customPropertiesOther" />
				</div>
			</div>

			<EventFormFooter
				mode={mode}
				onCancel={onCancel}
				onSavePreset={onSavePreset ? handleSavePreset : undefined}
				onSubmit={handleSubmit}
			/>
		</div>
	);
});

function toDate(value: unknown): Date | null {
	if (value instanceof Date) return value;
	if (typeof value === "string" || typeof value === "number") {
		const d = new Date(value);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	return null;
}

function TitleField({
	form,
	onBlur,
	bundle,
	titleInputRef,
}: {
	form: UseFormReturn<EventFormState>;
	onBlur: () => void;
	bundle: CalendarBundle;
	titleInputRef: RefObject<HTMLInputElement | null>;
}) {
	const { field } = useController({ control: form.control, name: "title" });
	const enableSuggest = bundle.settingsStore.currentSettings.titleAutocomplete;

	// Latest field.onChange + onBlur behind a ref so the effect's identity
	// doesn't depend on either — without this, the suggester would tear down
	// and rebuild on every keystroke (and lose its `hasUserTyped` flag mid-edit).
	// Accepting a suggestion writes the chosen title AND runs the same blur
	// hook the input's onBlur fires (auto-category assignment) — the suggester
	// itself no longer blurs the input, so without this call the user would
	// lose auto-categories whenever they accepted via Enter / Tab / click.
	const acceptTitleRef = useRef<(title: string) => void>(() => {});
	useEffect(() => {
		acceptTitleRef.current = (title) => {
			field.onChange(title);
			onBlur();
		};
	});

	useEffect(() => {
		if (!enableSuggest) return;
		const inputEl = titleInputRef.current;
		if (!inputEl) return;
		const suggest = new TitleInputSuggest(bundle.plugin.app, inputEl, bundle, {
			onAcceptTitle: (title) => acceptTitleRef.current(title),
		});
		return () => {
			suggest.destroy();
		};
	}, [bundle, enableSuggest, titleInputRef]);

	return (
		<PrismaSettingItem name="Title" testId="prisma-event-field-title">
			<div className="prisma-title-input-wrapper">
				<input
					ref={titleInputRef}
					type="text"
					className="prisma-setting-item-control"
					value={field.value}
					onChange={(e) => field.onChange(e.target.value)}
					onBlur={onBlur}
					data-testid="prisma-event-control-title"
					autoFocus
				/>
			</div>
		</PrismaSettingItem>
	);
}

function applyMetadataToState(state: EventFormState, metadata: Record<string, unknown>): EventFormState {
	return {
		...state,
		location: serializeFrontmatterValue(metadata["location"]),
		icon: serializeFrontmatterValue(metadata["icon"]),
		breakMinutes: serializeFrontmatterValue(metadata["breakMinutes"]),
		markAsDone: metadata["markAsDone"] === true,
		skip: metadata["skip"] === true,
	};
}

function splitByDisplayKeys(
	props: Record<string, string> | undefined,
	displayKeys: Set<string>
): { display: Record<string, string>; other: Record<string, string> } {
	const display: Record<string, string> = {};
	const other: Record<string, string> = {};
	if (!props) return { display, other };
	for (const [k, v] of Object.entries(props)) {
		(displayKeys.has(k) ? display : other)[k] = v;
	}
	return { display, other };
}

function recordToEntries(record: Record<string, string>): CustomPropertyEntry[] {
	return Object.entries(record).map(([key, value]) => ({ key, value }));
}
