import {
	afterRender,
	isObsidianLink,
	parseAsLocalDate,
	parseFrontmatterRecord,
	serializeFrontmatterValue,
	toLocalISOString,
	toSafeString,
} from "@real1ty-obsidian-plugins";
import { useZodForm } from "@real1ty-obsidian-plugins-react";
import { Notice } from "obsidian";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useController, useWatch } from "react-hook-form";

import {
	applyPresetToState,
	createDefaultState,
	type CustomPropertyEntry,
	type EventFormState,
	EventFormStateSchema,
} from "../../components/modals/event/event-form-state";
import { showCategoryEventsModal } from "../../components/modals/series/bases-view";
import { TitleInputSuggest } from "../../components/title-input-suggest";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { MinimizedModalManager, type MinimizedModalState } from "../../core/minimized-modal-manager";
import type { Frontmatter } from "../../types";
import { isTimedEvent } from "../../types/calendar";
import { PositiveFloat } from "../../types/event-boundaries";
import type { EventPreset } from "../../types/settings";
import { autoAssignCategories, findAdjacentEvent } from "../../utils/events/matching";
import { extractCleanDisplayName } from "../../utils/events/naming";
import { validateEventTitle } from "../../utils/events/title-validation";
import { formatDateTimeForInput } from "../../utils/format";
import { openCategoryAssignModal, openPrerequisiteAssignModal } from "../modals";
import { Stopwatch, type StopwatchHandle, type StopwatchSnapshot } from "../views/stopwatch";
import { PrismaCheckbox } from "./prisma-checkbox";
import { PrismaSettingItem } from "./prisma-setting-item";
import {
	CategorySection,
	CustomPropertiesSection,
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
		() =>
			new Set([
				...(settings.frontmatterDisplayProperties || []),
				...(settings.frontmatterDisplayPropertiesAllDay || []),
			]),
		[settings.frontmatterDisplayProperties, settings.frontmatterDisplayPropertiesAllDay]
	);

	const initialFormState = useMemo<EventFormState>(() => {
		const base = initialState ?? createDefaultState();
		const split = splitByDisplayKeys(initialCustomProperties, displayKeySet);
		return {
			...base,
			customPropertiesDisplay: recordToEntries(split.display),
			customPropertiesOther: recordToEntries(split.other),
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const form = useZodForm({
		schema: EventFormStateSchema,
		defaultValues: initialFormState,
	});

	const [suppressAutoCategories, setSuppressAutoCategories] = useState(
		() => (initialState?.categories.length ?? 0) > 0
	);
	const initialMarkAsDoneRef = useRef(initialState?.markAsDone ?? false);
	const stopwatchSnapshotRef = useRef<StopwatchSnapshot | null>(initialStopwatchSnapshot ?? null);
	const stopwatchRef = useRef<StopwatchHandle | null>(null);
	// Baseline break minutes captured at stopwatch Start / Continue, so subsequent
	// onBreakUpdate callbacks emit `initial + session` and don't overwrite the
	// user-entered value. Mirrors base-event-modal.ts:504-543.
	const initialBreakMinutesRef = useRef(0);
	const titleInputRef = useRef<HTMLInputElement | null>(null);
	// Skip the unmount auto-save when the user clicked Minimize explicitly
	// (avoids double-save). Save button does NOT set a parallel flag — imperative
	// parity (base-event-modal.ts onClose) keeps the running stopwatch's
	// minimized state alive after a save so the user can restore and continue
	// tracking.
	const isMinimizingRef = useRef(false);

	const setStopwatchHandle = useCallback(
		(handle: StopwatchHandle | null) => {
			stopwatchRef.current = handle;
			if (handle) {
				if (initialStopwatchSnapshot) handle.importState(initialStopwatchSnapshot);
				if (autoStartStopwatch) {
					handle.expand();
					queueMicrotask(() => handle.start());
				}
			}
		},
		[autoStartStopwatch, initialStopwatchSnapshot]
	);

	const captureStopwatchSnapshot = useCallback(() => {
		const handle = stopwatchRef.current;
		if (!handle) return;
		stopwatchSnapshotRef.current = handle.exportState();
	}, []);

	// Cache the latest snapshot whenever the stopwatch fires a callback. The
	// useEffect cleanup that auto-saves on dismiss runs AFTER the Stopwatch
	// child unmounts (and its ref is nulled), so we cannot inspect the handle
	// at teardown — we rely on this cached snapshot instead. Mirrors the
	// imperative `extractMinimizedState` capturing live state via callbacks.
	const refreshSnapshotFromHandle = useCallback(() => {
		const handle = stopwatchRef.current;
		if (!handle) return;
		stopwatchSnapshotRef.current = handle.exportState();
	}, []);

	const [metadataValues, setMetadataValues] = useState<Record<string, unknown>>(() => ({
		location: initialState?.location ?? "",
		icon: initialState?.icon ?? "",
		breakMinutes: initialState?.breakMinutes ?? "",
		markAsDone: initialState?.markAsDone ?? false,
		skip: initialState?.skip ?? false,
	}));

	const categories = useWatch({ control: form.control, name: "categories" });
	const participants = useWatch({ control: form.control, name: "participants" });
	const prerequisites = useWatch({ control: form.control, name: "prerequisites" });

	const categoryColors = useMemo(() => {
		return new Map(bundle.categoryTracker.getCategoriesWithColors().map((c) => [c.name, c.color]));
	}, [bundle]);

	const defaultColor = settings.defaultNodeColor;

	const getDisplayName = useCallback((link: string) => {
		return isObsidianLink(link) ? extractCleanDisplayName(link) : link;
	}, []);

	const getPrerequisiteDisplayName = useCallback((link: string) => {
		return extractCleanDisplayName(link);
	}, []);

	const handleCategoriesChange = useCallback(
		(cats: string[]) => {
			form.setValue("categories", cats);
			setSuppressAutoCategories(true);
		},
		[form]
	);

	const handleAssignCategories = useCallback(() => {
		setSuppressAutoCategories(true);
		const categoriesWithColors = bundle.categoryTracker.getCategoriesWithColors();
		void openCategoryAssignModal(
			bundle.plugin.app,
			categoriesWithColors,
			defaultColor,
			form.getValues("categories")
		).then((selected) => {
			if (selected) form.setValue("categories", selected);
		});
	}, [bundle, defaultColor, form]);

	const handleAssignPrerequisites = useCallback(() => {
		void openPrerequisiteAssignModal(bundle.plugin.app, bundle, form.getValues("prerequisites")).then((selected) => {
			if (selected) form.setValue("prerequisites", selected);
		});
	}, [bundle, form]);

	const handleCategoryClick = useCallback(
		(name: string) => {
			showCategoryEventsModal(bundle.plugin.app, name, settings);
		},
		[bundle, settings]
	);

	const handleParticipantsChange = useCallback(
		(p: string[]) => {
			form.setValue("participants", p);
		},
		[form]
	);

	const handlePrerequisitesChange = useCallback(
		(p: string[]) => {
			form.setValue("prerequisites", p);
		},
		[form]
	);

	const applyAutoCategories = useCallback(() => {
		if (suppressAutoCategories) return;
		const title = form.getValues("title").trim();
		if (!title) return;

		const hasAutoAssign = settings.autoAssignCategoryByName || settings.categoryAssignmentPresets.length > 0;
		if (!hasAutoAssign) return;

		const availableCategories = bundle.categoryTracker.getCategories();
		const assigned = autoAssignCategories(title, settings, availableCategories, bundle.plugin.isProEnabled);
		if (assigned.length > 0) {
			form.setValue("categories", assigned);
		}
	}, [suppressAutoCategories, form, settings, bundle]);

	const collectFormValues = useCallback((): EventFormValues => {
		captureStopwatchSnapshot();
		const state = applyMetadataToState(form.getValues(), metadataValues);
		const displayRecord = customPropertiesToRecord(state.customPropertiesDisplay);
		const otherRecord = customPropertiesToRecord(state.customPropertiesOther);
		const customProps = parseFrontmatterRecord({ ...displayRecord, ...otherRecord });
		return {
			formState: state,
			customProperties: customProps,
			stopwatchSnapshot: stopwatchSnapshotRef.current,
			initialMarkAsDoneState: initialMarkAsDoneRef.current,
		};
	}, [captureStopwatchSnapshot, form, metadataValues]);

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
		applyAutoCategories();
		onSubmit(collectFormValues());
	}, [applyAutoCategories, form, onSubmit, collectFormValues]);

	const handleMinimize = useCallback(() => {
		isMinimizingRef.current = true;
		onMinimize?.(collectFormValues());
	}, [onMinimize, collectFormValues]);

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
		stopwatchRef.current?.reset();
		initialBreakMinutesRef.current = 0;
	}, [form]);

	const handleSavePreset = useCallback(() => {
		const values = collectFormValues();
		onSavePreset?.(values.formState, values.customProperties);
	}, [collectFormValues, onSavePreset]);

	const captureInitialBreakMinutes = useCallback(() => {
		setMetadataValues((prev) => {
			const parsed = PositiveFloat.parse(toSafeString(prev["breakMinutes"]) ?? "") ?? 0;
			initialBreakMinutesRef.current = parsed;
			return prev;
		});
	}, []);

	const handleStopwatchStart = useCallback(
		(startTime: Date) => {
			captureInitialBreakMinutes();
			form.setValue("start", formatDateTimeForInput(startTime));
			const endMs = startTime.getTime() + 5 * 60 * 1000;
			form.setValue("end", formatDateTimeForInput(new Date(endMs)));
			// Stopwatch fires onStart before transitioning state to "running" (see
			// stopwatch.tsx start() — onStart fires, then beginTracking() flips
			// state). Defer the snapshot refresh so we capture the post-transition
			// state, not the still-idle pre-transition one.
			queueMicrotask(refreshSnapshotFromHandle);
		},
		[captureInitialBreakMinutes, form, refreshSnapshotFromHandle]
	);

	const handleStopwatchContinue = useCallback((): Date | null => {
		captureInitialBreakMinutes();
		const startValue = form.getValues("start");
		if (!startValue) return null;

		// Mirror base-event-modal.ts:524-532 — if the existing end stamp is in the
		// past the user is resuming work after a gap; push end forward to "now".
		const endValue = form.getValues("end");
		if (endValue) {
			const endDate = parseAsLocalDate(endValue);
			if (endDate && endDate.getTime() < Date.now()) {
				form.setValue("end", formatDateTimeForInput(new Date()));
			}
		}

		// Stopwatch will transition to running on the next tick; cache eagerly.
		queueMicrotask(refreshSnapshotFromHandle);
		return parseAsLocalDate(startValue);
	}, [captureInitialBreakMinutes, form, refreshSnapshotFromHandle]);

	const handleStopwatchStop = useCallback(
		(endTime: Date) => {
			form.setValue("end", formatDateTimeForInput(endTime));
			refreshSnapshotFromHandle();
		},
		[form, refreshSnapshotFromHandle]
	);

	const handleBreakUpdate = useCallback(
		(breakMinutes: number) => {
			const total = initialBreakMinutesRef.current + breakMinutes;
			setMetadataValues((prev) => ({ ...prev, breakMinutes: total.toString() }));
			refreshSnapshotFromHandle();
		},
		[refreshSnapshotFromHandle]
	);

	// Preset selector
	const [presets, setPresets] = useState<EventPreset[]>(settings.eventPresets);

	useEffect(() => {
		const sub = bundle.settingsStore.settings$.subscribe((s) => {
			setPresets(s.eventPresets);
		});
		return () => sub.unsubscribe();
	}, [bundle]);

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

	// Title blur → auto-category
	const handleTitleBlur = useCallback(() => {
		applyAutoCategories();
	}, [applyAutoCategories]);

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

	const handleFillPrevious = useCallback(() => fillFromAdjacent("previous"), [fillFromAdjacent]);
	const handleFillNext = useCallback(() => fillFromAdjacent("next"), [fillFromAdjacent]);

	const allDay = useWatch({ control: form.control, name: "allDay" });

	// Keep the latest handleSubmit / collectFormValues references reachable from
	// the long-lived keydown / unmount effects without re-binding them on every
	// keystroke. Mirrors the imperative scope.register pattern in
	// base-event-modal.ts:1148.
	const handleSubmitRef = useRef(handleSubmit);
	handleSubmitRef.current = handleSubmit;
	const collectFormValuesRef = useRef(collectFormValues);
	collectFormValuesRef.current = collectFormValues;
	const onUnmountWithActiveStopwatchRef = useRef(onUnmountWithActiveStopwatch);
	onUnmountWithActiveStopwatchRef.current = onUnmountWithActiveStopwatch;

	// Focus the title input after Obsidian's Modal class has finished setting up
	// the dialog (which steals focus). React's `autoFocus` runs before the steal
	// — wait two animation frames and reclaim focus. Mirrors base-event-modal.ts
	// onOpen(): `void afterRender().then(() => this.titleInput.focus())`.
	useEffect(() => {
		let cancelled = false;
		void afterRender().then(() => {
			if (cancelled) return;
			titleInputRef.current?.focus();
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// Auto-save state to MinimizedModalManager if the user dismisses the modal
	// (ESC / click-outside) while a stopwatch is active. Mirrors
	// base-event-modal.ts:229-235. Skipped when explicit Minimize / Submit ran.
	// Reads the cached snapshot rather than the live handle because the
	// Stopwatch child has already unmounted by the time this cleanup runs.
	useEffect(() => {
		return () => {
			if (isMinimizingRef.current) return;
			const snapshot = stopwatchSnapshotRef.current;
			if (!snapshot || (snapshot.state !== "running" && snapshot.state !== "paused")) return;
			const values = collectFormValuesRef.current();
			const stateFactory = onUnmountWithActiveStopwatchRef.current;
			if (stateFactory) {
				const state = stateFactory(values);
				MinimizedModalManager.saveState(state, bundle);
			}
		};
	}, [bundle]);

	// Enter-to-save hotkey (#7). Mirrors registerSubmitHotkey in
	// base-event-modal.ts:1148. Scoped to the form root so inputs that
	// `stopPropagation` on Enter (e.g. participant input) opt out.
	const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key !== "Enter") return;
		const target = e.target as HTMLElement | null;
		// Multiline / button targets keep native Enter semantics.
		if (target instanceof HTMLTextAreaElement) return;
		if (target instanceof HTMLButtonElement) return;
		// Selects native-enter to open the dropdown; don't hijack.
		if (target instanceof HTMLSelectElement) return;
		e.preventDefault();
		handleSubmitRef.current();
	}, []);

	return (
		<div className="prisma-event-modal-content" onKeyDown={handleKeyDown}>
			<div className="prisma-event-modal-body">
				{/* Header controls */}
				<div className="prisma-event-modal-header">
					<h2>{mode === "create" ? "Create Event" : "Edit Event"}</h2>
					<VirtualToggle form={form} />
					<div className="prisma-event-modal-header-controls">
						<button
							type="button"
							className="prisma-event-modal-minimize-button"
							onClick={handleMinimize}
							title="Minimize modal (preserves all form data)"
							data-testid="prisma-event-btn-minimize"
						>
							−
						</button>
						<button
							type="button"
							className="prisma-event-modal-clear-button"
							onClick={handleClear}
							data-testid="prisma-event-btn-clear"
						>
							Clear
						</button>
						<PresetSelector presets={presets} onChange={handlePresetChange} />
					</div>
				</div>

				{/* Title */}
				<TitleField form={form} onBlur={handleTitleBlur} bundle={bundle} titleInputRef={titleInputRef} />

				{/* Timing */}
				<TimingSection
					form={form}
					showDurationField={settings.showDurationField}
					onFillPrevious={handleFillPrevious}
					onFillNext={handleFillNext}
				/>

				{/* Stopwatch */}
				{settings.showStopwatch && !allDay && (
					<div className="prisma-stopwatch-field">
						<Stopwatch
							ref={setStopwatchHandle}
							onStart={handleStopwatchStart}
							onContinueRequested={handleStopwatchContinue}
							onStop={handleStopwatchStop}
							onBreakUpdate={handleBreakUpdate}
						/>
					</div>
				)}

				{/* Recurrence */}
				<RecurrenceSection form={form} />

				{/* Categories */}
				{settings.categoryProp && (
					<CategorySection
						value={categories}
						onChange={handleCategoriesChange}
						categoryColors={categoryColors}
						defaultColor={defaultColor}
						onAssign={handleAssignCategories}
						onCategoryClick={handleCategoryClick}
					/>
				)}

				{/* Prerequisites */}
				{settings.prerequisiteProp && (
					<PrerequisiteSection
						value={prerequisites}
						onChange={handlePrerequisitesChange}
						getDisplayName={getPrerequisiteDisplayName}
						onAssign={handleAssignPrerequisites}
					/>
				)}

				{/* Participants */}
				{settings.participantsProp && (
					<ParticipantSection
						value={participants}
						onChange={handleParticipantsChange}
						getDisplayName={getDisplayName}
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

			{/* Footer */}
			<div className="prisma-event-modal-footer">
				<div className="prisma-modal-button-container">
					<button type="button" onClick={onCancel} data-testid="prisma-event-btn-cancel">
						Cancel
					</button>
					{onSavePreset && (
						<button type="button" onClick={handleSavePreset} data-testid="prisma-event-btn-save-preset">
							Save as preset
						</button>
					)}
					<button type="button" className="prisma-mod-cta" onClick={handleSubmit} data-testid="prisma-event-btn-save">
						{mode === "create" ? "Create" : "Save"}
					</button>
				</div>
			</div>
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
	titleInputRef: MutableRefObject<HTMLInputElement | null>;
}) {
	const { field } = useController({ control: form.control, name: "title" });
	const enableSuggest = bundle.settingsStore.currentSettings.titleAutocomplete;

	useEffect(() => {
		if (!enableSuggest) return;
		const inputEl = titleInputRef.current;
		if (!inputEl) return;
		const suggest = new TitleInputSuggest(bundle.plugin.app, inputEl, bundle);
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

function VirtualToggle({ form }: { form: UseFormReturn<EventFormState> }) {
	const { field } = useController({ control: form.control, name: "virtual" });
	return (
		<PrismaCheckbox
			style="labeled-toggle"
			label="Virtual"
			value={field.value}
			onChange={field.onChange}
			testId="prisma-event-control-virtual"
		/>
	);
}

function PresetSelector({ presets, onChange }: { presets: EventPreset[]; onChange: (id: string) => void }) {
	// Always-empty controlled select. Acts as a one-shot trigger: picking a
	// preset fires onChange (which applies it to the form) and then the
	// dropdown immediately resets to blank so the user can pick the same
	// preset again to re-apply, and the initial state isn't tied to any
	// option (no "first preset auto-selected" trap).
	return (
		<div className="prisma-event-preset-selector-wrapper">
			<span className="prisma-event-preset-label">Preset:</span>
			<select
				className="prisma-event-preset-select"
				value=""
				onChange={(e) => {
					const id = e.target.value;
					if (!id) return;
					onChange(id);
					e.target.value = "";
				}}
				data-testid="prisma-event-control-preset"
			>
				<option value="" />
				{presets.map((p) => (
					<option key={p.id} value={p.id}>
						{p.name}
					</option>
				))}
			</select>
		</div>
	);
}

function applyMetadataToState(state: EventFormState, metadata: Record<string, unknown>): EventFormState {
	state.location = String(metadata["location"] ?? "");
	state.icon = String(metadata["icon"] ?? "");
	state.breakMinutes = String(metadata["breakMinutes"] ?? "");
	state.markAsDone = metadata["markAsDone"] === true;
	state.skip = metadata["skip"] === true;
	return state;
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
