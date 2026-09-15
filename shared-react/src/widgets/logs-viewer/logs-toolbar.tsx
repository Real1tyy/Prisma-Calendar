import { LOG_LEVELS, type LogFileInfo, type LogLevel } from "@real1ty/obsidian-plugins";
import { memo, useCallback, type ReactNode, type Ref } from "react";

import type { ScopedTheme } from "../../contexts/theme-context";
import { Button } from "../../primitives/atoms/button";
import { DatetimeLocalInput } from "../../primitives/controls/datetime-local-input";
import { Dropdown } from "../../primitives/controls/dropdown";
import { TextInput } from "../../primitives/controls/text-input";
import { testIdAttr } from "../../utils/test-id";
import {
	boundToFilterValue,
	EMPTY_LOG_VIEW_FILTERS,
	formatLocalDateTimeInput,
	formatLogDate,
	parseLocalDateTime,
	type LogTimeBounds,
	type LogViewFilters,
} from "./filters";
import { TimeRangeSlider } from "./time-range-slider";

/** Source id of the live in-memory buffer; every other value is a log file's path. */
export const BUFFER_SOURCE = "";

/** `datetime-local` step in seconds — log lines are milliseconds apart, so minute precision cannot narrow them. */
const MS_STEP_SECONDS = 0.001;

export interface LogsToolbarProps extends Pick<ScopedTheme, "cls" | "tid"> {
	source: string;
	files: readonly LogFileInfo[];
	onSourceChange: (source: string) => void;
	filters: LogViewFilters;
	onFiltersChange: (filters: LogViewFilters) => void;
	scopes: readonly string[];
	/** The loaded entries' time range; `null` while there are none. */
	bounds: LogTimeBounds | null;
	searchRef: Ref<HTMLInputElement>;
	/** Rendered at the end of the search row — where an embedded viewer puts the actions a leaf keeps in its header. */
	actions?: ReactNode;
}

function fileLabel(file: LogFileInfo): string {
	const kb = Math.max(1, Math.round(file.size / 1024));
	const when = file.rotatedAt === null ? "current session" : formatLogDate(file.rotatedAt);
	return `Log file · ${when} · ${kb} KB`;
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
					data-level={kind === "level" ? value : undefined}
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
	bounds,
	searchRef,
	actions,
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
	const reset = useCallback(() => onFiltersChange(EMPTY_LOG_VIEW_FILTERS), [onFiltersChange]);

	// A bound typed back to the edge of the range reads as "unbounded" again.
	const setFrom = useCallback(
		(value: string) => {
			const ts = parseLocalDateTime(value);
			patch({ from: ts === undefined || !bounds ? value : boundToFilterValue(ts, bounds.min, "from") });
		},
		[patch, bounds]
	);
	const setTo = useCallback(
		(value: string) => {
			const ts = parseLocalDateTime(value);
			patch({ to: ts === undefined || !bounds ? value : boundToFilterValue(ts, bounds.max, "to") });
		},
		[patch, bounds]
	);
	const setRange = useCallback(
		(start: number, end: number) => {
			if (!bounds) return;
			patch({ from: boundToFilterValue(start, bounds.min, "from"), to: boundToFilterValue(end, bounds.max, "to") });
		},
		[patch, bounds]
	);

	const sourceOptions: Record<string, string> = { [BUFFER_SOURCE]: "This session (in memory)" };
	for (const file of files) sourceOptions[file.path] = fileLabel(file);

	// A picked scope stays offered after a source switch drops it from the
	// entries — otherwise it would keep filtering with no chip left to unpick.
	const scopeChoices = [...new Set([...scopes, ...filters.scopes])].sort();

	// An unset bound shows the loaded range's edge, so there is always a concrete time to narrow from.
	const fromTs = parseLocalDateTime(filters.from) ?? bounds?.min;
	const toTs = parseLocalDateTime(filters.to) ?? bounds?.max;

	return (
		<div className={cls("toolbar")} {...testIdAttr(tid("toolbar"))}>
			<div className={cls("toolbar-row")}>
				<span className={cls("label")}>{"Levels"}</span>
				<ToggleChips
					label="Filter by level"
					kind="level"
					values={LOG_LEVELS}
					selected={filters.levels}
					onChange={setLevels}
					cls={cls}
					tid={tid}
				/>
				{scopeChoices.length > 0 && (
					<>
						<span className={cls("divider")} aria-hidden="true" />
						<span className={cls("label")}>{"Scope"}</span>
						<ToggleChips
							label="Filter by scope"
							kind="scope"
							values={scopeChoices}
							selected={filters.scopes}
							onChange={setScopes}
							cls={cls}
							tid={tid}
						/>
					</>
				)}
			</div>

			<div className={cls("toolbar-row")}>
				{files.length > 0 && (
					<Dropdown value={source} options={sourceOptions} onChange={onSourceChange} testId={tid("source")} />
				)}
				<div className={cls("search")}>
					<TextInput
						value={filters.query}
						placeholder="Search message, scope or data…  (Ctrl/Cmd+F)"
						onChange={setQuery}
						debounceMs={0}
						inputRef={searchRef}
						testId={tid("query")}
					/>
				</div>
				<Button onClick={reset} testId={tid("reset")}>
					Reset filters
				</Button>
				{actions}
			</div>

			<div className={cls("toolbar-row", "time")}>
				<label className={cls("field")}>
					{"From"}
					<DatetimeLocalInput
						value={fromTs === undefined ? "" : formatLocalDateTimeInput(fromTs)}
						onChange={setFrom}
						step={MS_STEP_SECONDS}
						testId={tid("from")}
					/>
				</label>
				<label className={cls("field")}>
					{"To"}
					<DatetimeLocalInput
						value={toTs === undefined ? "" : formatLocalDateTimeInput(toTs)}
						onChange={setTo}
						step={MS_STEP_SECONDS}
						testId={tid("to")}
					/>
				</label>
			</div>
			{bounds && bounds.max > bounds.min && fromTs !== undefined && toTs !== undefined && (
				<TimeRangeSlider bounds={bounds} start={fromTs} end={toTs} onChange={setRange} cls={cls} tid={tid} />
			)}
		</div>
	);
});
