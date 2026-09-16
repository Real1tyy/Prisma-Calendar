import { createLogJsonReplacer, stringifyLogData, toOtlpLogRecord, type LogEntry } from "@real1ty/obsidian-plugins";
import { memo, useCallback, useMemo, type KeyboardEvent, type ReactNode } from "react";

import type { ScopedTheme } from "../../contexts/theme-context";
import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { testIdAttr } from "../../utils/test-id";
import { formatLogDate, formatLogTime } from "./filters";

export interface LogRowProps extends Pick<ScopedTheme, "cls" | "tid"> {
	entry: LogEntry;
	expanded: boolean;
	selected: boolean;
	/** The active search, highlighted wherever it occurs in the message or the inline data. */
	query: string;
	onToggleExpanded: (seq: number) => void;
	onToggleSelected: (seq: number) => void;
	onCopy: (entry: LogEntry) => void;
}

/** Pretty-print a value with the same degradations the sink uses. */
function prettyValue(value: unknown): string {
	if (typeof value === "string") return value;
	try {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the overload types this `string`, but a root `toJSON()` returning undefined makes `JSON.stringify` return undefined at runtime.
		return JSON.stringify(value, createLogJsonReplacer(), 2) ?? String(value);
	} catch {
		return String(value);
	}
}

/** Split `text` around every case-insensitive occurrence of `query`, wrapping the hits in `<mark>`. */
export function highlightMatches(text: string, query: string, markClass: string): ReactNode {
	if (query === "") return text;
	const haystack = text.toLowerCase();
	const needle = query.toLowerCase();
	const parts: ReactNode[] = [];
	let cursor = 0;
	for (let hit = haystack.indexOf(needle); hit !== -1; hit = haystack.indexOf(needle, cursor)) {
		if (hit > cursor) parts.push(text.slice(cursor, hit));
		parts.push(
			<mark key={hit} className={markClass}>
				{text.slice(hit, hit + needle.length)}
			</mark>
		);
		cursor = hit + needle.length;
	}
	if (parts.length === 0) return text;
	if (cursor < text.length) parts.push(text.slice(cursor));
	return parts;
}

/**
 * One log line: time, a severity badge, scope, then the message with the
 * structured data inlined after it as one-line JSON. The message never yields
 * space to the data — the preview takes what is left and truncates. Clicking
 * the line opens the full OTLP-shaped record underneath.
 */
export const LogRow = memo(function LogRow({
	entry,
	expanded,
	selected,
	query,
	onToggleExpanded,
	onToggleSelected,
	onCopy,
	cls,
	tid,
}: LogRowProps) {
	const toggleExpanded = useCallback(() => onToggleExpanded(entry.seq), [onToggleExpanded, entry.seq]);
	const toggleSelected = useCallback(() => onToggleSelected(entry.seq), [onToggleSelected, entry.seq]);
	const copy = useCallback(() => onCopy(entry), [onCopy, entry]);
	const onMessageKey = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			toggleExpanded();
		},
		[toggleExpanded]
	);

	const record = useMemo(() => toOtlpLogRecord(entry), [entry]);
	const inlineData = useMemo(() => stringifyLogData(entry.data), [entry.data]);
	const mark = cls("match");

	return (
		<div className={cls("row")} data-level={entry.level} data-expanded={expanded} {...testIdAttr(tid("row"))}>
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
				<span
					className={cls("row-level")}
					data-level={entry.level}
					title={`severityNumber ${record.severityNumber}`}
					{...testIdAttr(tid("row-level"))}
				>
					{record.severityText}
				</span>
				<span className={cls("row-scope")} title={entry.scope}>
					{entry.scope}
				</span>
				<div
					role="button"
					tabIndex={0}
					className={cls("row-message")}
					onClick={toggleExpanded}
					onKeyDown={onMessageKey}
					aria-expanded={expanded}
					title={entry.message}
					{...testIdAttr(tid("row-message"))}
				>
					<span className={cls("row-body")}>{highlightMatches(entry.message, query, mark)}</span>
					{inlineData !== "" && (
						<span className={cls("row-inline-data")} {...testIdAttr(tid("row-inline-data"))}>
							{highlightMatches(inlineData, query, mark)}
						</span>
					)}
				</div>
				<button
					type="button"
					className={`clickable-icon ${cls("row-copy")}`}
					onClick={copy}
					aria-label="Copy entry"
					{...testIdAttr(tid("row-copy"))}
				>
					<ObsidianIcon icon="copy" />
				</button>
			</div>
			{expanded && <LogRecordDetails entry={entry} cls={cls} tid={tid} />}
		</div>
	);
});

interface LogRecordDetailsProps extends Pick<ScopedTheme, "cls" | "tid"> {
	entry: LogEntry;
}

/** The expanded record, laid out as OTLP fields so it reads like any log backend's detail pane. */
const LogRecordDetails = memo(function LogRecordDetails({ entry, cls, tid }: LogRecordDetailsProps) {
	const record = toOtlpLogRecord(entry);
	const attributes = Object.entries(record.attributes);

	return (
		<div className={cls("row-data")} {...testIdAttr(tid("row-data"))}>
			<dl className={cls("record")}>
				<dt>timestamp</dt>
				<dd>{`${formatLogDate(entry.ts)} (${new Date(entry.ts).toISOString()})`}</dd>
				<dt>severity</dt>
				<dd>{`${record.severityText} · ${record.severityNumber}`}</dd>
				<dt>scope</dt>
				<dd>{record.instrumentationScope.name}</dd>
				<dt>body</dt>
				<dd className={cls("record-body")}>{record.body}</dd>
			</dl>
			{attributes.length > 0 && (
				<dl className={`${cls("record")} ${cls("record-attributes")}`} {...testIdAttr(tid("row-attributes"))}>
					{attributes.map(([key, value]) => (
						<div key={key} className={cls("attribute")} {...testIdAttr(tid("row-attribute", key))}>
							<dt>{key}</dt>
							<dd>
								{typeof value === "object" && value !== null ? (
									<pre className={cls("attribute-json")}>{prettyValue(value)}</pre>
								) : (
									prettyValue(value)
								)}
							</dd>
						</div>
					))}
				</dl>
			)}
		</div>
	);
});
