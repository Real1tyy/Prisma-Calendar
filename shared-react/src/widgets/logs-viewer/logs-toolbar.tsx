import { LOG_LEVELS, type LogFileInfo, type LogLevel } from "@real1ty/obsidian-plugins";
import { memo, useCallback } from "react";

import type { ScopedTheme } from "../../contexts/theme-context";
import { Button } from "../../primitives/atoms/button";
import { DatetimeLocalInput } from "../../primitives/controls/datetime-local-input";
import { Dropdown } from "../../primitives/controls/dropdown";
import { TextInput } from "../../primitives/controls/text-input";
import { testIdAttr } from "../../utils/test-id";
import { EMPTY_LOG_VIEW_FILTERS, formatLogDate, type LogViewFilters } from "./filters";

/** Source id of the live in-memory buffer; every other value is a log file's path. */
export const BUFFER_SOURCE = "";

export interface LogsToolbarProps extends Pick<ScopedTheme, "cls" | "tid"> {
	source: string;
	files: readonly LogFileInfo[];
	onSourceChange: (source: string) => void;
	filters: LogViewFilters;
	onFiltersChange: (filters: LogViewFilters) => void;
	scopes: readonly string[];
	total: number;
	shown: number;
	selected: number;
}

function fileLabel(file: LogFileInfo): string {
	const kb = Math.max(1, Math.round(file.size / 1024));
	const when = file.rotatedAt === null ? "current session" : formatLogDate(file.rotatedAt);
	return `${when} · ${kb} KB`;
}

interface ToggleChipsProps<T extends string> extends Pick<ScopedTheme, "cls" | "tid"> {
	label: string;
	/** Test-id segment between the viewer scope and the value: `level` → `…-level-warn`. */
	kind: string;
	values: readonly T[];
	selected: readonly T[];
	onChange: (selected: readonly T[]) => void;
}

/**
 * A multi-select as a row of toggles. No selection means no restriction, so
 * every chip reads as pressed until the user narrows — the same convention for
 * levels and scopes.
 */
function ToggleChipsInner<T extends string>({
	label,
	kind,
	values,
	selected,
	onChange,
	cls,
	tid,
}: ToggleChipsProps<T>) {
	const toggle = useCallback(
		(value: T) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]),
		[selected, onChange]
	);

	return (
		<div className={cls("chips")} role="group" aria-label={label}>
			{values.map((value) => (
				<button
					key={value}
					type="button"
					className={cls("chip")}
					data-kind={kind}
					data-value={value}
					aria-pressed={selected.length === 0 || selected.includes(value)}
					onClick={() => toggle(value)}
					{...testIdAttr(tid(kind, value))}
				>
					{value}
				</button>
			))}
		</div>
	);
}

const ToggleChips = memo(ToggleChipsInner) as typeof ToggleChipsInner;

export const LogsToolbar = memo(function LogsToolbar({
	source,
	files,
	onSourceChange,
	filters,
	onFiltersChange,
	scopes,
	total,
	shown,
	selected,
	cls,
	tid,
}: LogsToolbarProps) {
	const patch = useCallback(
		(fields: Partial<LogViewFilters>) => onFiltersChange({ ...filters, ...fields }),
		[filters, onFiltersChange]
	);
	const setLevels = useCallback((levels: readonly LogLevel[]) => patch({ levels }), [patch]);
	const setScopes = useCallback((next: readonly string[]) => patch({ scopes: next }), [patch]);
	const setQuery = useCallback((query: string) => patch({ query }), [patch]);
	const setFrom = useCallback((from: string) => patch({ from }), [patch]);
	const setTo = useCallback((to: string) => patch({ to }), [patch]);
	const reset = useCallback(() => onFiltersChange(EMPTY_LOG_VIEW_FILTERS), [onFiltersChange]);

	const sourceOptions: Record<string, string> = { [BUFFER_SOURCE]: "This session (in memory)" };
	for (const file of files) sourceOptions[file.path] = fileLabel(file);

	// A picked scope stays offered after a source switch drops it from the
	// entries — otherwise it would keep filtering with no chip left to unpick.
	const scopeChoices = [...new Set([...scopes, ...filters.scopes])].sort();

	return (
		<div className={cls("toolbar")} {...testIdAttr(tid("toolbar"))}>
			<div className={cls("toolbar-row")}>
				{files.length > 0 && (
					<label className={cls("field")}>
						{"Source"}
						<Dropdown value={source} options={sourceOptions} onChange={onSourceChange} testId={tid("source")} />
					</label>
				)}
				<ToggleChips
					label="Filter by level"
					kind="level"
					values={LOG_LEVELS}
					selected={filters.levels}
					onChange={setLevels}
					cls={cls}
					tid={tid}
				/>
			</div>

			{scopeChoices.length > 0 && (
				<div className={cls("toolbar-row")}>
					<span className={cls("field")}>{"Scope"}</span>
					<ToggleChips
						label="Filter by scope"
						kind="scope"
						values={scopeChoices}
						selected={filters.scopes}
						onChange={setScopes}
						cls={cls}
						tid={tid}
					/>
				</div>
			)}

			<div className={cls("toolbar-row")}>
				<label className={cls("field", "grow")}>
					{"Search"}
					<TextInput
						value={filters.query}
						placeholder="Message or data…"
						onChange={setQuery}
						debounceMs={0}
						testId={tid("query")}
					/>
				</label>
				<label className={cls("field")}>
					{"From"}
					<DatetimeLocalInput value={filters.from} onChange={setFrom} testId={tid("from")} />
				</label>
				<label className={cls("field")}>
					{"To"}
					<DatetimeLocalInput value={filters.to} onChange={setTo} testId={tid("to")} />
				</label>
				<Button onClick={reset} testId={tid("reset")}>
					Reset filters
				</Button>
			</div>

			<span className={cls("counts")} {...testIdAttr(tid("counts"))}>
				{`${total} entries · ${shown} shown${selected > 0 ? ` · ${selected} selected` : ""}`}
			</span>
		</div>
	);
});
