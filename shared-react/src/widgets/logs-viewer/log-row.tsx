import { createLogJsonReplacer, type LogEntry } from "@real1ty/obsidian-plugins";
import { memo, useCallback } from "react";

import type { ScopedTheme } from "../../contexts/theme-context";
import { testIdAttr } from "../../utils/test-id";
import { formatLogDate, formatLogTime } from "./filters";

export interface LogRowProps extends Pick<ScopedTheme, "cls" | "tid"> {
	entry: LogEntry;
	expanded: boolean;
	selected: boolean;
	onToggleExpanded: (seq: number) => void;
	onToggleSelected: (seq: number) => void;
	onCopy: (entry: LogEntry) => void;
}

/** Pretty-print the structured payload with the same degradations the sink uses. */
function prettyData(data: unknown): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the overload types this `string`, but a root `toJSON()` returning undefined makes `JSON.stringify` return undefined at runtime.
		return JSON.stringify(data, createLogJsonReplacer(), 2) ?? "";
	} catch {
		return String(data);
	}
}

export const LogRow = memo(function LogRow({
	entry,
	expanded,
	selected,
	onToggleExpanded,
	onToggleSelected,
	onCopy,
	cls,
	tid,
}: LogRowProps) {
	const toggleExpanded = useCallback(() => onToggleExpanded(entry.seq), [onToggleExpanded, entry.seq]);
	const toggleSelected = useCallback(() => onToggleSelected(entry.seq), [onToggleSelected, entry.seq]);
	const copy = useCallback(() => onCopy(entry), [onCopy, entry]);
	const hasData = entry.data !== undefined;

	return (
		<div className={cls("row")} data-level={entry.level} {...testIdAttr(tid("row"))}>
			<div className={cls("row-main")}>
				<input
					type="checkbox"
					className={cls("row-select")}
					checked={selected}
					onChange={toggleSelected}
					aria-label={`Select entry ${entry.seq}`}
					{...testIdAttr(tid("row-select"))}
				/>
				<span className={cls("row-time")} title={formatLogDate(entry.ts)}>
					{formatLogTime(entry.ts)}
				</span>
				<span className={cls("row-level")} data-level={entry.level}>
					{entry.level}
				</span>
				<span className={cls("row-scope")}>{entry.scope}</span>
				<button
					type="button"
					className={cls("row-message")}
					onClick={toggleExpanded}
					aria-expanded={expanded}
					disabled={!hasData}
					{...testIdAttr(tid("row-message"))}
				>
					{entry.message}
					{hasData && <span className={cls("row-caret")}>{expanded ? " ▾" : " ▸"}</span>}
				</button>
				<button type="button" className={cls("row-copy")} onClick={copy} {...testIdAttr(tid("row-copy"))}>
					Copy
				</button>
			</div>
			{expanded && hasData && (
				<pre className={cls("row-data")} {...testIdAttr(tid("row-data"))}>
					{prettyData(entry.data)}
				</pre>
			)}
		</div>
	);
});
