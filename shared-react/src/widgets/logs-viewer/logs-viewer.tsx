import {
	buildLogExportFilename,
	formatLogEntriesForExport,
	type LogEntry,
	type LogExportFormat,
	type LogFileInfo,
	type LogFileSource,
	type LogService,
} from "@real1ty/obsidian-plugins";
import { Notice } from "obsidian";
import {
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
	type Ref,
	type UIEvent,
} from "react";

import { useScopedStyles } from "../../hooks/styles/use-styles";
import { Button } from "../../primitives/atoms/button";
import { testIdAttr } from "../../utils/test-id";
import { VirtualList, type VirtualListHandle } from "../../virtual/virtual-list";
import { PrivacyDisclaimer } from "../privacy-disclaimer/privacy-disclaimer";
import { applyLogViewFilters, EMPTY_LOG_VIEW_FILTERS, observedScopes, type LogViewFilters } from "./filters";
import { LogRow } from "./log-row";
import { BUFFER_SOURCE, LogsToolbar } from "./logs-toolbar";
import { buildLogsViewerStyles } from "./logs-viewer.styles";
import { useLogBuffer } from "./use-log-buffer";

/** Entries fetched per "load more" when the source is a file. */
const DISK_PAGE_SIZE = 500;
const ROW_HEIGHT_PX = 30;
/** Scroll depth beyond which the list stops adopting new entries. */
const FOLLOW_THRESHOLD_PX = 8;
/** Past this many entries a clipboard payload is unwieldy; point at "Save to file" instead. */
const LARGE_COPY_ENTRIES = 2000;

/**
 * The viewer's actions, for chrome React does not own — the leaf's page header.
 * A type alias rather than an interface so it satisfies `ReactViewHandle`'s
 * index signature.
 */
export type LogsViewerHandle = {
	copyAll: () => void;
	copyFiltered: () => void;
	/** Saves the selected rows, or every shown row when nothing is selected. */
	save: () => void;
	clear: () => void;
};

export interface LogsViewerProps {
	/** The live buffer. Always the default source. */
	service: LogService;
	/** On-disk history. Omit (or leave empty) and the source picker never appears. */
	files?: LogFileSource | undefined;
	/** The plugin's privacy page, already UTM-tracked. */
	privacyUrl: string;
	/**
	 * Writes an export into the vault and resolves with the created path. The
	 * plugin owns this because only it knows where its exports belong.
	 */
	onSave: (content: string, filename: string) => Promise<string>;
	/** Absolute vault root, so redaction can collapse paths under it to `vault://`. */
	vaultPath?: string | undefined;
	/** Extra keys whose values are elided in redacted mode (plugin-configured sensitive properties). */
	sensitiveKeys?: readonly string[] | undefined;
	/** Export shape for both copy and save. Default `json`. */
	format?: LogExportFormat | undefined;
	/** Base name of a saved export, before the timestamp. Default `logs`. */
	filenamePrefix?: string | undefined;
}

function toggleIn(set: ReadonlySet<number>, value: number): Set<number> {
	const next = new Set(set);
	if (!next.delete(value)) next.add(value);
	return next;
}

/**
 * The Logs view: the plugin's own log stream, filterable and exportable
 * without opening the developer console.
 *
 * Two sources feed one table — the live in-memory buffer, and the JSON-lines
 * files the file sink wrote in earlier sessions. Everything below the source
 * switch is common: the same filters, the same virtualized table, the same
 * export path. See [[spec-logs-viewer-view]].
 */
export const LogsViewer = memo(function LogsViewer({
	service,
	files,
	privacyUrl,
	onSave,
	vaultPath,
	sensitiveKeys,
	format = "json",
	filenamePrefix,
	ref,
}: LogsViewerProps & { ref?: Ref<LogsViewerHandle> | undefined }) {
	const { cls, tid } = useScopedStyles("logs-viewer", buildLogsViewerStyles);
	const listRef = useRef<VirtualListHandle>(null);

	const [source, setSource] = useState(BUFFER_SOURCE);
	const [filters, setFilters] = useState<LogViewFilters>(EMPTY_LOG_VIEW_FILTERS);
	const [fullDetail, setFullDetail] = useState(false);
	const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
	const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
	const [atTop, setAtTop] = useState(true);
	// Mirrors `atTop` so the scroll handler acts on the transition, not on every
	// scroll event — re-copying the buffer per frame would defeat the point.
	const atTopRef = useRef(true);

	const [fileList, setFileList] = useState<readonly LogFileInfo[]>([]);
	const [diskEntries, setDiskEntries] = useState<LogEntry[]>([]);
	const [diskHasMore, setDiskHasMore] = useState(false);

	const live = source === BUFFER_SOURCE;
	const { entries: bufferEntries, pending, adopt } = useLogBuffer(service, live && atTop);

	useEffect(() => {
		if (!files) return;
		let cancelled = false;
		void files.list().then((list) => {
			if (!cancelled) setFileList(list);
		});
		return () => {
			cancelled = true;
		};
	}, [files]);

	// A source switch starts the view over: the previous file's page is
	// meaningless against the new one, and so is a selection keyed by its lines.
	const changeSource = useCallback(
		(next: string) => {
			setSource(next);
			setExpanded(new Set());
			setSelected(new Set());
			setDiskEntries([]);
			setDiskHasMore(false);
			if (next === BUFFER_SOURCE) adopt();
		},
		[adopt]
	);

	useEffect(() => {
		if (live || !files) return;
		let cancelled = false;
		// The active file is still being appended to, so a cached line index for
		// it is stale the moment the sink flushes again.
		files.invalidate(source);
		void files.page(source, 0, DISK_PAGE_SIZE).then((page) => {
			if (cancelled) return;
			setDiskEntries(page.entries);
			setDiskHasMore(page.hasMore);
		});
		return () => {
			cancelled = true;
		};
	}, [source, live, files]);

	const loadMore = useCallback(() => {
		if (!files || live) return;
		void files.page(source, diskEntries.length, DISK_PAGE_SIZE).then((page) => {
			setDiskEntries((current) => [...current, ...page.entries]);
			setDiskHasMore(page.hasMore);
		});
	}, [files, live, source, diskEntries.length]);

	const entries = live ? bufferEntries : diskEntries;
	const shown = useMemo(() => applyLogViewFilters(entries, filters), [entries, filters]);
	const scopes = useMemo(() => observedScopes(entries), [entries]);

	const exportOptions = useMemo(
		() => ({
			format,
			fullDetail,
			...(vaultPath !== undefined ? { vaultPath } : {}),
			...(sensitiveKeys !== undefined ? { sensitiveKeys } : {}),
		}),
		[format, fullDetail, vaultPath, sensitiveKeys]
	);

	const copy = useCallback(
		(list: readonly LogEntry[], label: string) => {
			if (list.length === 0) {
				new Notice("Nothing to copy.");
				return;
			}
			void navigator.clipboard
				.writeText(formatLogEntriesForExport(list, exportOptions))
				.then(() => {
					const hint = list.length > LARGE_COPY_ENTRIES ? " — for a payload this large prefer Save to file" : "";
					new Notice(`Copied ${list.length} ${label}${hint}.`);
				})
				.catch(() => new Notice("Failed to copy."));
		},
		[exportOptions]
	);

	const copyAll = useCallback(() => copy(entries, "entries"), [copy, entries]);
	const copyFiltered = useCallback(() => copy(shown, "filtered entries"), [copy, shown]);
	const copyEntry = useCallback((entry: LogEntry) => copy([entry], "entry"), [copy]);

	const save = useCallback(() => {
		// A selection is an explicit narrowing; without one the visible slice is
		// what the user means by "these logs".
		const list = selected.size > 0 ? shown.filter((entry) => selected.has(entry.seq)) : shown;
		if (list.length === 0) {
			new Notice("Nothing to save.");
			return;
		}
		const filename = buildLogExportFilename(Date.now(), format, filenamePrefix);
		void onSave(formatLogEntriesForExport(list, exportOptions), filename)
			.then((path) => new Notice(`Saved ${list.length} entries to ${path}`))
			.catch(() => new Notice("Failed to save the log export."));
	}, [selected, shown, format, filenamePrefix, onSave, exportOptions]);

	const clear = useCallback(() => {
		service.clear();
		setExpanded(new Set());
		setSelected(new Set());
	}, [service]);

	useImperativeHandle(ref, () => ({ copyAll, copyFiltered, save, clear }), [copyAll, copyFiltered, save, clear]);

	const toggleExpanded = useCallback((seq: number) => setExpanded((current) => toggleIn(current, seq)), []);
	const toggleSelected = useCallback((seq: number) => setSelected((current) => toggleIn(current, seq)), []);

	const handleScroll = useCallback(
		(event: UIEvent<HTMLDivElement>) => {
			const top = event.currentTarget.scrollTop <= FOLLOW_THRESHOLD_PX;
			if (top === atTopRef.current) return;
			atTopRef.current = top;
			setAtTop(top);
			// Scrolling back to the top is the user saying they are done reading —
			// catch the table up on whatever piled up while they were down there.
			if (top) adopt();
		},
		[adopt]
	);

	const showPending = useCallback(() => {
		adopt();
		listRef.current?.scrollToIndex(0, { align: "start" });
		atTopRef.current = true;
		setAtTop(true);
	}, [adopt]);

	const renderRow = useCallback(
		(entry: LogEntry) => (
			<LogRow
				entry={entry}
				expanded={expanded.has(entry.seq)}
				selected={selected.has(entry.seq)}
				onToggleExpanded={toggleExpanded}
				onToggleSelected={toggleSelected}
				onCopy={copyEntry}
				cls={cls}
				tid={tid}
			/>
		),
		[expanded, selected, toggleExpanded, toggleSelected, copyEntry, cls, tid]
	);

	return (
		<div className={cls()} {...testIdAttr(tid())}>
			<PrivacyDisclaimer
				docsUrl={privacyUrl}
				fullDetail={fullDetail}
				onFullDetailChange={setFullDetail}
				variant="inline"
				testId={tid("privacy")}
			/>
			<LogsToolbar
				source={source}
				files={fileList}
				onSourceChange={changeSource}
				filters={filters}
				onFiltersChange={setFilters}
				scopes={scopes}
				total={entries.length}
				shown={shown.length}
				selected={selected.size}
				cls={cls}
				tid={tid}
			/>

			{live && pending > 0 && (
				<button type="button" className={cls("pending")} onClick={showPending} {...testIdAttr(tid("pending"))}>
					{`${pending} new ${pending === 1 ? "entry" : "entries"} — show`}
				</button>
			)}

			{shown.length === 0 ? (
				<p className={cls("empty")} {...testIdAttr(tid("empty"))}>
					{entries.length === 0
						? "No log entries yet. Lower the minimum level in Settings → Logging while reproducing a problem."
						: "No entries match these filters."}
				</p>
			) : (
				<VirtualList
					ref={listRef}
					items={shown}
					estimateSize={ROW_HEIGHT_PX}
					getKey={(entry) => entry.seq}
					renderItem={renderRow}
					onScroll={handleScroll}
					className={cls("list")}
				/>
			)}

			{!live && diskHasMore && (
				<Button onClick={loadMore} testId={tid("load-more")}>
					Load older entries
				</Button>
			)}
		</div>
	);
});
