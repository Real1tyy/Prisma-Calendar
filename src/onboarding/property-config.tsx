import { TextInput } from "@real1ty-obsidian-plugins-react";
import type { ReactNode } from "react";
import { memo, useCallback, useState } from "react";

import type { DirectorySuggestion } from "./directory-suggestions";

// ─── Shared layout ──────────────────────────────────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
	return (
		<div className="prisma-first-launch-field">
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
			setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
		});
	}, [name]);

	return (
		<span
			role="button"
			tabIndex={0}
			className={`prisma-first-launch-copyable-prop${copied ? " is-copied" : ""}`}
			onClick={copy}
			onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && copy()}
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
	if (!props || props.length === 0) return null;
	return (
		<span className="prisma-first-launch-prop-category">
			<span className="prisma-first-launch-prop-category-label">{label}:</span>{" "}
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
	if (!props || props.length === 0) return null;
	return (
		<div className="prisma-first-launch-prefill">
			<span className="prisma-first-launch-prefill-label">Use</span>
			{props.map((p) => (
				<button
					key={p}
					type="button"
					className="prisma-first-launch-prefill-btn"
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
	startProp: string;
	endProp: string;
	dateProp: string;
}

export function computePrefill(suggestion: DirectorySuggestion): PrefillResult {
	const dt = suggestion.datetimeProps ?? [];
	const startMatch = dt.find((p) => p.toLowerCase().includes("start"));
	const endMatch = dt.find((p) => p.toLowerCase().includes("end"));

	const startProp = startMatch ?? dt[0] ?? "";
	const endProp = endMatch ?? dt.find((p) => p !== startProp) ?? dt[1] ?? "";
	const dateProp = (suggestion.dateProps ?? [])[0] ?? "";

	return { startProp, endProp, dateProp };
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
			<div className="prisma-first-launch-muted">Scanning your vault for folders with date-like frontmatter...</div>
		);
	}

	if (suggestions.length === 0) {
		return (
			<div className="prisma-first-launch-muted">
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
					className={`prisma-first-launch-suggestion${selectedDirectory.trim() === suggestion.directory ? " is-selected" : ""}`}
					onClick={() => onSelect(suggestion)}
					onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(suggestion)}
					data-testid={tid(`suggestion-${suggestion.directory.replace(/[^\w-]+/g, "-").toLowerCase()}`)}
				>
					<span className="prisma-first-launch-mode-title">{suggestion.directory}</span>
					<span className="prisma-first-launch-mode-desc">
						{suggestion.fileCount} note{suggestion.fileCount === 1 ? "" : "s"}
					</span>
					<div className="prisma-first-launch-prop-categories">
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
				<div className="prisma-first-launch-multi-hint">
					Each folder can be its own planning system with independent properties and configuration. You can create more
					in Settings later.
				</div>
			) : null}
		</>
	);
});

// ─── Property fields row (input + prefill) ──────────────────────────────────

export interface PropertyFieldsProps {
	startProp: string;
	endProp: string;
	dateProp: string;
	onStartPropChange: (value: string) => void;
	onEndPropChange: (value: string) => void;
	onDatePropChange: (value: string) => void;
	placeholders: { startProp: string; endProp: string; dateProp: string };
	suggestion: DirectorySuggestion | null;
	testIdPrefix: string;
}

export const PropertyFields = memo(function PropertyFields({
	startProp,
	endProp,
	dateProp,
	onStartPropChange,
	onEndPropChange,
	onDatePropChange,
	placeholders,
	suggestion,
	testIdPrefix,
}: PropertyFieldsProps) {
	const tid = (suffix: string) => `${testIdPrefix}-${suffix}`;

	return (
		<>
			<Field label="Start property" hint="Starting datetime value for timed events.">
				<div className="prisma-first-launch-field-row">
					<TextInput
						value={startProp}
						placeholder={placeholders.startProp}
						onChange={onStartPropChange}
						debounceMs={0}
						testId={tid("start-prop")}
					/>
					{suggestion ? (
						<PrefillButtons
							props={suggestion.datetimeProps}
							onSelect={onStartPropChange}
							testIdPrefix={tid("prefill-start")}
						/>
					) : null}
				</div>
			</Field>
			<Field label="End property" hint="Ending datetime value for timed events.">
				<div className="prisma-first-launch-field-row">
					<TextInput
						value={endProp}
						placeholder={placeholders.endProp}
						onChange={onEndPropChange}
						debounceMs={0}
						testId={tid("end-prop")}
					/>
					{suggestion ? (
						<PrefillButtons
							props={suggestion.datetimeProps}
							onSelect={onEndPropChange}
							testIdPrefix={tid("prefill-end")}
						/>
					) : null}
				</div>
			</Field>
			<Field label="Date property" hint="Date value for all-day events.">
				<div className="prisma-first-launch-field-row">
					<TextInput
						value={dateProp}
						placeholder={placeholders.dateProp}
						onChange={onDatePropChange}
						debounceMs={0}
						testId={tid("date-prop")}
					/>
					{suggestion ? (
						<PrefillButtons
							props={suggestion.dateProps}
							onSelect={onDatePropChange}
							testIdPrefix={tid("prefill-date")}
						/>
					) : null}
				</div>
			</Field>
		</>
	);
});
