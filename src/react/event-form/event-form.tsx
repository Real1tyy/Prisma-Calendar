import {
	isObsidianLink,
	parseFrontmatterRecord,
	serializeFrontmatterValue,
	toLocalISOString,
} from "@real1ty-obsidian-plugins";
import { useZodForm } from "@real1ty-obsidian-plugins-react";
import { Notice } from "obsidian";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useController, useWatch } from "react-hook-form";

import {
	applyPresetToState,
	createDefaultState,
	type EventFormState,
	EventFormStateSchema,
} from "../../components/modals/event/event-form-state";
import { showCategoryEventsModal } from "../../components/modals/series/bases-view";
import { TitleInputSuggest } from "../../components/title-input-suggest";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { Frontmatter } from "../../types";
import { isTimedEvent } from "../../types/calendar";
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
}: EventFormConfig) {
	const settings = bundle.settingsStore.currentSettings;
	const form = useZodForm({
		schema: EventFormStateSchema,
		defaultValues: initialState ?? createDefaultState(),
	});

	const [suppressAutoCategories, setSuppressAutoCategories] = useState(
		() => (initialState?.categories.length ?? 0) > 0
	);
	const initialMarkAsDoneRef = useRef(initialState?.markAsDone ?? false);
	const stopwatchSnapshotRef = useRef<StopwatchSnapshot | null>(initialStopwatchSnapshot ?? null);
	const stopwatchRef = useRef<StopwatchHandle | null>(null);

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

	const displayKeySet = useMemo(
		() => new Set([...settings.frontmatterDisplayProperties, ...settings.frontmatterDisplayPropertiesAllDay]),
		[settings.frontmatterDisplayProperties, settings.frontmatterDisplayPropertiesAllDay]
	);

	const [displayProperties, setDisplayProperties] = useState<Record<string, string>>(
		() => splitByDisplayKeys(initialCustomProperties, displayKeySet).display
	);
	const [otherProperties, setOtherProperties] = useState<Record<string, string>>(
		() => splitByDisplayKeys(initialCustomProperties, displayKeySet).other
	);

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
		const customProps = parseFrontmatterRecord({ ...displayProperties, ...otherProperties });
		return {
			formState: state,
			customProperties: customProps,
			stopwatchSnapshot: stopwatchSnapshotRef.current,
			initialMarkAsDoneState: initialMarkAsDoneRef.current,
		};
	}, [captureStopwatchSnapshot, form, metadataValues, displayProperties, otherProperties]);

	const handleSubmit = useCallback(() => {
		applyAutoCategories();
		const title = form.getValues("title");
		const titleCheck = validateEventTitle(title);
		if (!titleCheck.ok) {
			new Notice(titleCheck.message);
			return;
		}
		onSubmit(collectFormValues());
	}, [applyAutoCategories, form, onSubmit, collectFormValues]);

	const handleMinimize = useCallback(() => {
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
		setDisplayProperties({});
		setOtherProperties({});
		setSuppressAutoCategories(false);
	}, [form]);

	const handleSavePreset = useCallback(() => {
		const values = collectFormValues();
		onSavePreset?.(values.formState, values.customProperties);
	}, [collectFormValues, onSavePreset]);

	const handleStopwatchStart = useCallback(
		(startTime: Date) => {
			form.setValue("start", formatDateTimeForInput(startTime));
			const endMs = startTime.getTime() + 5 * 60 * 1000;
			form.setValue("end", formatDateTimeForInput(new Date(endMs)));
		},
		[form]
	);

	const handleStopwatchContinue = useCallback((): Date | null => {
		const startValue = form.getValues("start");
		if (!startValue) return null;
		return new Date(startValue);
	}, [form]);

	const handleStopwatchStop = useCallback(
		(endTime: Date) => {
			form.setValue("end", formatDateTimeForInput(endTime));
		},
		[form]
	);

	const handleBreakUpdate = useCallback((breakMinutes: number) => {
		setMetadataValues((prev) => ({ ...prev, breakMinutes: breakMinutes.toString() }));
	}, []);

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
			form.reset(updated);
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

			if (preset.customProperties) {
				const serialized: Record<string, string> = {};
				for (const [k, v] of Object.entries(preset.customProperties)) {
					serialized[k] = serializeFrontmatterValue(v);
				}
				const { display, other } = splitByDisplayKeys(serialized, displayKeySet);
				setDisplayProperties(display);
				setOtherProperties(other);
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

	return (
		<div className="prisma-event-modal-content">
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
				<TitleField form={form} onBlur={handleTitleBlur} bundle={bundle} />

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
						categories={categories}
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
						prerequisites={prerequisites}
						onChange={handlePrerequisitesChange}
						getDisplayName={getPrerequisiteDisplayName}
						onAssign={handleAssignPrerequisites}
					/>
				)}

				{/* Participants */}
				{settings.participantsProp && (
					<ParticipantSection
						participants={participants}
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
					initialProperties={Object.entries(displayProperties).map(([key, value]) => ({ key, value }))}
					onPropertiesChange={setDisplayProperties}
				/>
				<div className="prisma-other-section-spacing">
					<CustomPropertiesSection
						section="other"
						title="Other Properties"
						initialProperties={Object.entries(otherProperties).map(([key, value]) => ({ key, value }))}
						onPropertiesChange={setOtherProperties}
					/>
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
}: {
	form: UseFormReturn<EventFormState>;
	onBlur: () => void;
	bundle: CalendarBundle;
}) {
	const { field } = useController({ control: form.control, name: "title" });
	const inputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		const inputEl = inputRef.current;
		if (!inputEl) return;
		const suggest = new TitleInputSuggest(bundle.plugin.app, inputEl, bundle);
		return () => {
			suggest.destroy();
		};
	}, [bundle]);

	return (
		<PrismaSettingItem name="Title" testId="prisma-event-field-title">
			<div className="prisma-title-input-wrapper">
				<input
					ref={inputRef}
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
