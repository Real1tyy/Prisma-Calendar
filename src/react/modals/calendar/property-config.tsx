import { TextInput } from "@real1ty/obsidian-plugins-react";
import { memo, useCallback, useState, type ReactNode } from "react";

import { cls } from "../../../constants";
import type { DirectorySuggestion } from "../../../core/directory-suggestions";

// ─── Shared layout ──────────────────────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<div className={cls("first-launch-field")}>
			<label>{label}</label>
			{hint ? <small>{hint}</small> : null}
			{children}
		</div>
	);
}

// ─── Copyable property chip ─────────────────────────────────────────────────

const COPIED_FEEDBACK_MS = 1500;

function CopyableProp({ name, testId }: { name: string; testId: string }) {
	const [copied, setCopied] = useState(false);

	const copy = useCallback(() => {
		void navigator.clipboard.writeText(name).then(() => {
			setCopied(true);
			window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
		});
	}, [name]);

	return (
		<span
			role="button"
			tabIndex={0}
			className={cls(`first-launch-copyable-prop${copied ? " is-copied" : ""}`)}
			onClick={copy}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") copy();
			}}
			data-testid={testId}
		>
			{copied ? "Copied!" : name}
		</span>
	);
}

// ─── Property category line (datetime / date) ──────────────────────────────

export function PropCategoryLine({
	label,
	props,
	testIdPrefix,
}: {
	label: string;
	props: string[];
	testIdPrefix: string;
}) {
	if (props.length === 0) return null;
	return (
		<span className={cls("first-launch-prop-category")}>
			<span className={cls("first-launch-prop-category-label")}>{label}:</span>{" "}
			{props.map((p) => (
				<CopyableProp key={p} name={p} testId={`${testIdPrefix}-${p.replace(/[^\w-]+/g, "-").toLowerCase()}`} />
			))}
		</span>
	);
}

// ─── Prefill buttons (inline "Use X Y" next to inputs) ─────────────────────

export function PrefillButtons({
	props,
	onSelect,
	testIdPrefix,
}: {
	props: string[];
	onSelect: (value: string) => void;
	testIdPrefix: string;
}) {
	if (props.length === 0) return null;
	return (
		<div className={cls("first-launch-prefill")}>
			<span className={cls("first-launch-prefill-label")}>Use</span>
			{props.map((p) => (
				<button
					key={p}
					type="button"
					className={cls("first-launch-prefill-btn")}
					onClick={() => onSelect(p)}
					data-testid={`${testIdPrefix}-${p.replace(/[^\w-]+/g, "-").toLowerCase()}`}
				>
					{p}
				</button>
			))}
		</div>
	);
}

// ─── Smart prefill logic ────────────────────────────────────────────────────

export interface PrefillResult {
	startDateProp: string;
	endDateProp: string;
	startDayProp: string;
	endDayProp: string;
}

export function computePrefill(suggestion: DirectorySuggestion): PrefillResult {
	const dt = suggestion.datetimeProps;
	const startMatch = dt.find((p) => p.toLowerCase().includes("start"));
	const endMatch = dt.find((p) => p.toLowerCase().includes("end"));

	const startDateProp = startMatch ?? dt.at(0) ?? "";
	const endDateProp = endMatch ?? dt.find((p) => p !== startDateProp) ?? dt.at(1) ?? "";
	const endDayProp = suggestion.dateProps.find((p) => p.toLowerCase().includes("end")) ?? "";
	const startDayProp = suggestion.dateProps.find((p) => p !== endDayProp) ?? "";

	return { startDateProp, endDateProp, startDayProp, endDayProp };
}

// ─── Suggestion list ────────────────────────────────────────────────────────

export interface SuggestionListProps {
	suggestions: DirectorySuggestion[];
	isLoading: boolean;
	selectedDirectory: string;
	onSelect: (suggestion: DirectorySuggestion) => void;
	testIdPrefix: string;
	multiHint?: boolean;
}

export const SuggestionList = memo(function SuggestionList({
	suggestions,
	isLoading,
	selectedDirectory,
	onSelect,
	testIdPrefix,
	multiHint,
}: SuggestionListProps) {
	const tid = (suffix: string) => `${testIdPrefix}-${suffix}`;

	if (isLoading) {
		return (
			<div className={cls("first-launch-muted")}>Scanning your vault for folders with date-like frontmatter...</div>
		);
	}

	if (suggestions.length === 0) {
		return (
			<div className={cls("first-launch-muted")}>
				No existing folders with date-like frontmatter were detected. You can still type a folder above.
			</div>
		);
	}

	return (
		<>
			{suggestions.map((suggestion) => (
				<div
					key={suggestion.directory}
					role="button"
					tabIndex={0}
					className={cls(
						`first-launch-suggestion${selectedDirectory.trim() === suggestion.directory ? " is-selected" : ""}`
					)}
					onClick={() => onSelect(suggestion)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") onSelect(suggestion);
					}}
					data-testid={tid(`suggestion-${suggestion.directory.replace(/[^\w-]+/g, "-").toLowerCase()}`)}
				>
					<span className={cls("first-launch-mode-title")}>{suggestion.directory}</span>
					<span className={cls("first-launch-mode-desc")}>
						{suggestion.fileCount} note{suggestion.fileCount === 1 ? "" : "s"}
					</span>
					<div className={cls("first-launch-prop-categories")}>
						<PropCategoryLine
							label="Datetime properties"
							props={suggestion.datetimeProps}
							testIdPrefix={tid(`suggestion-${suggestion.directory.replace(/[^\w-]+/g, "-").toLowerCase()}-datetime`)}
						/>
						<PropCategoryLine
							label="Date properties"
							props={suggestion.dateProps}
							testIdPrefix={tid(`suggestion-${suggestion.directory.replace(/[^\w-]+/g, "-").toLowerCase()}-date`)}
						/>
					</div>
				</div>
			))}
			{multiHint && suggestions.length > 1 ? (
				<div className={cls("first-launch-multi-hint")}>
					Each folder can be its own planning system with independent properties and configuration. You can create more
					in Settings later.
				</div>
			) : null}
		</>
	);
});

// ─── Property fields row (input + prefill) ──────────────────────────────────

export interface PropertyFieldsProps {
	startDateProp: string;
	endDateProp: string;
	startDayProp: string;
	endDayProp: string;
	onStartDatePropChange: (value: string) => void;
	onEndDatePropChange: (value: string) => void;
	onStartDayPropChange: (value: string) => void;
	onEndDayPropChange: (value: string) => void;
	placeholders: { startDateProp: string; endDateProp: string; startDayProp: string; endDayProp: string };
	suggestion: DirectorySuggestion | null;
	testIdPrefix: string;
}

export const PropertyFields = memo(function PropertyFields({
	startDateProp,
	endDateProp,
	startDayProp,
	endDayProp,
	onStartDatePropChange,
	onEndDatePropChange,
	onStartDayPropChange,
	onEndDayPropChange,
	placeholders,
	suggestion,
	testIdPrefix,
}: PropertyFieldsProps) {
	const tid = (suffix: string) => `${testIdPrefix}-${suffix}`;

	return (
		<>
			<Field label="Start date property" hint="Start date and time of timed events.">
				<div className={cls("first-launch-field-row")}>
					<TextInput
						value={startDateProp}
						placeholder={placeholders.startDateProp}
						onChange={onStartDatePropChange}
						debounceMs={0}
						testId={tid("start-prop")}
					/>
					{suggestion ? (
						<PrefillButtons
							props={suggestion.datetimeProps}
							onSelect={onStartDatePropChange}
							testIdPrefix={tid("prefill-start")}
						/>
					) : null}
				</div>
			</Field>
			<Field label="End date property" hint="End date and time of timed events.">
				<div className={cls("first-launch-field-row")}>
					<TextInput
						value={endDateProp}
						placeholder={placeholders.endDateProp}
						onChange={onEndDatePropChange}
						debounceMs={0}
						testId={tid("end-prop")}
					/>
					{suggestion ? (
						<PrefillButtons
							props={suggestion.datetimeProps}
							onSelect={onEndDatePropChange}
							testIdPrefix={tid("prefill-end")}
						/>
					) : null}
				</div>
			</Field>
			<Field label="Start day property" hint="First day of all-day events (date only).">
				<div className={cls("first-launch-field-row")}>
					<TextInput
						value={startDayProp}
						placeholder={placeholders.startDayProp}
						onChange={onStartDayPropChange}
						debounceMs={0}
						testId={tid("date-prop")}
					/>
					{suggestion ? (
						<PrefillButtons
							props={suggestion.dateProps}
							onSelect={onStartDayPropChange}
							testIdPrefix={tid("prefill-date")}
						/>
					) : null}
				</div>
			</Field>
			<Field label="End day property" hint="Exclusive end of multi-day all-day events (the day after the last day).">
				<TextInput
					value={endDayProp}
					onChange={onEndDayPropChange}
					placeholder={placeholders.endDayProp}
					debounceMs={0}
					testId={tid("end-day-prop-input")}
				/>
				<PrefillButtons
					props={suggestion?.dateProps ?? []}
					onSelect={onEndDayPropChange}
					testIdPrefix={tid("end-day-prefill")}
				/>
			</Field>
		</>
	);
});
