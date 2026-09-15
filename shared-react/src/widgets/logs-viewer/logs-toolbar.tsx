import { LOG_LEVELS, type LogFileInfo, type LogLevel } from "@real1ty/obsidian-plugins";
import { memo, useCallback } from "react";

import type { ScopedTheme } from "../../contexts/theme-context";
import { Button } from "../../primitives/atoms/button";
import { DatetimeLocalInput } from "../../primitives/controls/datetime-local-input";
import { Dropdown } from "../../primitives/controls/dropdown";
import { TextInput } from "../../primitives/controls/text-input";
import { testIdAttr } from "../../utils/test-id";
import { formatLogDate, type LogViewFilters } from "./filters";

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
	onCopyAll: () => void;
	onCopyFiltered: () => void;
	onSave: () => void;
	onClear: (() => void) | undefined;
}

function fileLabel(file: LogFileInfo): string {
	const kb = Math.max(1, Math.round(file.size / 1024));
	const when = file.rotatedAt === null ? "current session" : formatLogDate(file.rotatedAt);
	return `${when} · ${kb} KB`;
}

const LevelChips = memo(function LevelChips({
	levels,
	onChange,
	cls,
	tid,
}: Pick<ScopedTheme, "cls" | "tid"> & {
	levels: readonly LogLevel[];
	onChange: (levels: readonly LogLevel[]) => void;
}) {
	const toggle = useCallback(
		(level: LogLevel) => onChange(levels.includes(level) ? levels.filter((l) => l !== level) : [...levels, level]),
		[levels, onChange]
	);

	return (
		<div className={cls("levels")} role="group" aria-label="Filter by level">
			{LOG_LEVELS.map((level) => (
				<button
					key={level}
					type="button"
					className={cls("level-chip")}
					data-level={level}
					// No selection means no restriction, so every chip reads as active.
					aria-pressed={levels.length === 0 || levels.includes(level)}
					onClick={() => toggle(level)}
					{...testIdAttr(tid("level", level))}
				>
					{level}
				</button>
			))}
		</div>
	);
});

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
	onCopyAll,
	onCopyFiltered,
	onSave,
	onClear,
	cls,
	tid,
}: LogsToolbarProps) {
	const patch = useCallback(
		(fields: Partial<LogViewFilters>) => onFiltersChange({ ...filters, ...fields }),
		[filters, onFiltersChange]
	);
	const setLevels = useCallback((levels: readonly LogLevel[]) => patch({ levels }), [patch]);
	const setScope = useCallback((scope: string) => patch({ scope }), [patch]);
	const setQuery = useCallback((query: string) => patch({ query }), [patch]);
	const setFrom = useCallback((from: string) => patch({ from }), [patch]);
	const setTo = useCallback((to: string) => patch({ to }), [patch]);
	const reset = useCallback(
		() => onFiltersChange({ levels: [], scope: "", from: "", to: "", query: "" }),
		[onFiltersChange]
	);

	const sourceOptions: Record<string, string> = { [BUFFER_SOURCE]: "This session (in memory)" };
	for (const file of files) sourceOptions[file.path] = fileLabel(file);

	return (
		<div className={cls("toolbar")} {...testIdAttr(tid("toolbar"))}>
			<div className={cls("toolbar-row")}>
				{files.length > 0 && (
					<label className={cls("field")}>
						{"Source"}
						<Dropdown value={source} options={sourceOptions} onChange={onSourceChange} testId={tid("source")} />
					</label>
				)}
				<LevelChips levels={filters.levels} onChange={setLevels} cls={cls} tid={tid} />
				<label className={cls("field")}>
					{"Scope"}
					<Dropdown
						value={filters.scope}
						options={{ "": "All scopes", ...Object.fromEntries(scopes.map((scope) => [scope, scope])) }}
						onChange={setScope}
						testId={tid("scope")}
					/>
				</label>
			</div>

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

			<div className={cls("toolbar-row")}>
				<span className={cls("counts")} {...testIdAttr(tid("counts"))}>
					{`${total} entries · ${shown} shown${selected > 0 ? ` · ${selected} selected` : ""}`}
				</span>
				<div className={cls("actions")}>
					<Button onClick={onCopyAll} testId={tid("copy-all")}>
						Copy all
					</Button>
					<Button onClick={onCopyFiltered} testId={tid("copy-filtered")}>
						Copy filtered
					</Button>
					<Button onClick={onSave} variant="primary" testId={tid("save")}>
						{selected > 0 ? `Save ${selected} selected` : "Save to file"}
					</Button>
					{onClear && (
						<Button onClick={onClear} variant="warning" testId={tid("clear")}>
							Clear buffer
						</Button>
					)}
				</div>
			</div>
		</div>
	);
});
