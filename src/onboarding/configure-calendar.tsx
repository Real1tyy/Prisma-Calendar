import { openReactModal, TextInput } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { memo, useCallback, useEffect, useState } from "react";

import type { DirectorySuggestion } from "./directory-suggestions";
import { scanVaultForDirectorySuggestions } from "./directory-suggestions";
import { computePrefill, Field, PropertyFields, SuggestionList } from "./property-config";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfigureCalendarResult {
	directory: string;
	startProp: string;
	endProp: string;
	dateProp: string;
}

export interface ConfigureCalendarControllerProps {
	initialValues: ConfigureCalendarResult;
	loadSuggestions: () => Promise<DirectorySuggestion[]>;
	onSubmit: (result: ConfigureCalendarResult) => void;
	onCancel: () => void;
}

// ─── Open helper ─────────────────────────────────────────────────────────────

export async function openConfigureCalendarModal(
	app: App,
	initialValues: ConfigureCalendarResult
): Promise<ConfigureCalendarResult | null> {
	return openReactModal<ConfigureCalendarResult>({
		app,
		cls: "prisma-configure-calendar-modal",
		testId: "prisma-configure-calendar-modal",
		render: (submit, cancel) => (
			<ConfigureCalendarController
				loadSuggestions={() => scanVaultForDirectorySuggestions(app)}
				initialValues={initialValues}
				onSubmit={submit}
				onCancel={cancel}
			/>
		),
	});
}

// ─── Controller ──────────────────────────────────────────────────────────────

export const ConfigureCalendarController = memo(function ConfigureCalendarController({
	initialValues,
	loadSuggestions,
	onSubmit,
	onCancel,
}: ConfigureCalendarControllerProps) {
	const [suggestions, setSuggestions] = useState<DirectorySuggestion[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [directory, setDirectory] = useState(initialValues.directory);
	const [startProp, setStartProp] = useState(initialValues.startProp);
	const [endProp, setEndProp] = useState(initialValues.endProp);
	const [dateProp, setDateProp] = useState(initialValues.dateProp);

	const tid = (suffix: string) => `prisma-configure-${suffix}`;
	const matchedSuggestion = suggestions.find((s) => s.directory === directory.trim()) ?? null;

	useEffect(() => {
		let cancelled = false;
		void loadSuggestions()
			.then((items) => {
				if (!cancelled) setSuggestions(items);
			})
			.catch(() => {
				if (!cancelled) setSuggestions([]);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [loadSuggestions]);

	const selectSuggestion = useCallback(
		(suggestion: DirectorySuggestion): void => {
			setDirectory(suggestion.directory);
			const prefill = computePrefill(suggestion);
			setStartProp(prefill.startProp || initialValues.startProp);
			setEndProp(prefill.endProp || initialValues.endProp);
			setDateProp(prefill.dateProp || initialValues.dateProp);
		},
		[initialValues]
	);

	const handleSubmit = (): void => {
		onSubmit({
			directory: directory.trim() || initialValues.directory,
			startProp: startProp.trim() || initialValues.startProp,
			endProp: endProp.trim() || initialValues.endProp,
			dateProp: dateProp.trim() || initialValues.dateProp,
		});
	};

	return (
		<div className="prisma-configure-calendar">
			<h2 className="prisma-configure-calendar-title">Configure calendar</h2>
			<p className="prisma-configure-calendar-desc">
				Set the directory and property names for this planning system. Prisma scans your vault to detect folders with
				date-like frontmatter so you can pick one directly.
			</p>

			<Field label="Event folder" hint="The folder Prisma reads event notes from.">
				<TextInput
					value={directory}
					placeholder={initialValues.directory || "e.g. Calendar, Tasks"}
					onChange={setDirectory}
					debounceMs={0}
					testId={tid("directory-input")}
				/>
			</Field>

			<div className="prisma-first-launch-suggestions">
				<SuggestionList
					suggestions={suggestions}
					isLoading={isLoading}
					selectedDirectory={directory}
					onSelect={selectSuggestion}
					testIdPrefix="prisma-configure"
				/>
			</div>

			<PropertyFields
				startProp={startProp}
				endProp={endProp}
				dateProp={dateProp}
				onStartPropChange={setStartProp}
				onEndPropChange={setEndProp}
				onDatePropChange={setDateProp}
				placeholders={initialValues}
				suggestion={matchedSuggestion}
				testIdPrefix="prisma-configure"
			/>

			<div className="prisma-configure-calendar-actions">
				<button type="button" onClick={onCancel} data-testid={tid("cancel")}>
					Cancel
				</button>
				<button type="button" className="mod-cta" onClick={handleSubmit} data-testid={tid("save")}>
					Save
				</button>
			</div>
		</div>
	);
});
