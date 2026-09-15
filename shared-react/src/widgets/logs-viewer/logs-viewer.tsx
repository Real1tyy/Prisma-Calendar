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
	type KeyboardEvent,
	type Ref,
	type UIEvent,
} from "react";

import { useScopedStyles } from "../../hooks/styles/use-styles";
import { Button } from "../../primitives/atoms/button";
import { testIdAttr } from "../../utils/test-id";
import { VirtualList, type VirtualListHandle } from "../../virtual/virtual-list";
import {
	applyLogViewFilters,
	EMPTY_LOG_VIEW_FILTERS,
	logTimeBounds,
	observedScopes,
	type LogViewFilters,
} from "./filters";
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
	copySelected: () => void;
	/** Saves the selected rows, or every shown row when nothing is selected. */
	save: () => void;
	clear: () => void;
	/** Focus and select the search — the leaf's `Mod+F`, which Obsidian's keymap claims before React sees it. */
	focusSearch: () => void;
};

/**
 * `page` fills its container and owns the keyboard from the moment it opens —
 * the Logs leaf. `embedded` is a fixed-height panel inside another surface
 * (the Doctor), with its actions inline because there is no header to hold them.
 */
export type LogsViewerVariant = "page" | "embedded";

export interface LogsViewerProps {
	/** The live buffer. Always the default source. */
	service: LogService;
	/** On-disk history. Omit (or leave empty) and the source picker never appears. */
	files?: LogFileSource | undefined;
	/**
	 * Writes an export into the vault and resolves with the created path. The
	 * plugin owns this because only it knows where its exports belong.
	 */
	onSave: (content: string, filename: string) => Promise<string>;
	/** Absolute vault root, so export redaction can collapse paths under it to `vault://`. */
	vaultPath?: string | undefined;
	/** Extra keys whose values are elided in exports (plugin-configured sensitive properties). */
	sensitiveKeys?: readonly string[] | undefined;
	/** Export shape for both copy and save. Default `json`. */
	format?: LogExportFormat | undefined;
	/** Base name of a saved export, before the timestamp. Default `logs`. */
	filenamePrefix?: string | undefined;
	variant?: LogsViewerVariant | undefined;
}

function toggleIn(set: ReadonlySet<number>, value: number): Set<number> {
	const next = new Set(set);
	if (!next.delete(value)) next.add(value);
	return next;
}

function isTextField(target: EventTarget): boolean {
	return (
		target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
	);
}

/**
 * The plugin's own log stream as a developer tool: filter by level, scope,
 * text and time, read each entry as an OTLP-shaped record, and copy or save
 * exactly the lines that matter.
 *
 * Two sources feed one table — the live in-memory buffer, and the JSON-lines
 * files the file sink wrote in earlier sessions. Everything below the source
 * switch is common. Mounted as the Logs leaf and inside the Doctor.
 * See [[spec-logs-viewer-view]] and
 * [[spec-logs-explorer-searchable-log-modal-open-logs-and-the-doctor-logs-section]].
 */
export const LogsViewer = memo(function LogsViewer({
	service,
	files,
	onSave,
	vaultPath,
	sensitiveKeys,
	format = "json",
	filenamePrefix,
	variant = "page",
	ref,
}: LogsViewerProps & { ref?: Ref<LogsViewerHandle> | undefined }) {
	const { cls, tid } = useScopedStyles("logs-viewer", buildLogsViewerStyles);
	const listRef = useRef<VirtualListHandle>(null);
	const searchRef = useRef<HTMLInputElement>(null);

	const [source, setSource] = useState(BUFFER_SOURCE);
	const [filters, setFilters] = useState<LogViewFilters>(EMPTY_LOG_VIEW_FILTERS);
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

	// Opening the logs is almost always the first step of a search. Inside the
	// Doctor the panel is one section of many, so it does not grab focus.
	useEffect(() => {
		if (variant === "page") searchRef.current?.focus();
	}, [variant]);

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
	// meaningless against the new one, and so is a selection keyed by its lines —
	// and so is a time range read from the other source's entries.
	const changeSource = useCallback(
		(next: string) => {
			setSource(next);
			setExpanded(new Set());
			setSelected(new Set());
			setDiskEntries([]);
			setDiskHasMore(false);
			setFilters((current) => ({ ...current, from: "", to: "" }));
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
	const bounds = useMemo(() => logTimeBounds(entries), [entries]);
	const selectedEntries = useMemo(() => shown.filter((entry) => selected.has(entry.seq)), [shown, selected]);

	// Exports are redacted the same way as every other plugin export; the
	// on-screen table shows the buffer as recorded.
	const exportOptions = useMemo(
		() => ({
			format,
			...(vaultPath !== undefined ? { vaultPath } : {}),
			...(sensitiveKeys !== undefined ? { sensitiveKeys } : {}),
		}),
		[format, vaultPath, sensitiveKeys]
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
	const copySelected = useCallback(() => copy(selectedEntries, "selected entries"), [copy, selectedEntries]);
	const copyEntry = useCallback((entry: LogEntry) => copy([entry], "entry"), [copy]);

	const save = useCallback(() => {
		// A selection is an explicit narrowing; without one the visible slice is
		// what the user means by "these logs".
		const list = selectedEntries.length > 0 ? selectedEntries : shown;
		if (list.length === 0) {
			new Notice("Nothing to save.");
			return;
		}
		const filename = buildLogExportFilename(Date.now(), format, filenamePrefix);
		void onSave(formatLogEntriesForExport(list, exportOptions), filename)
			.then((path) => new Notice(`Saved ${list.length} entries to ${path}`))
			.catch(() => new Notice("Failed to save the log export."));
	}, [selectedEntries, shown, format, filenamePrefix, onSave, exportOptions]);

	const clear = useCallback(() => {
		service.clear();
		setExpanded(new Set());
		setSelected(new Set());
	}, [service]);

	const focusSearch = useCallback(() => {
		searchRef.current?.focus();
		searchRef.current?.select();
	}, []);

	useImperativeHandle(ref, () => ({ copyAll, copyFiltered, copySelected, save, clear, focusSearch }), [
		copyAll,
		copyFiltered,
		copySelected,
		save,
		clear,
		focusSearch,
	]);

	const toggleExpanded = useCallback((seq: number) => setExpanded((current) => toggleIn(current, seq)), []);
	const toggleSelected = useCallback((seq: number) => setSelected((current) => toggleIn(current, seq)), []);
	const clearSelection = useCallback(() => setSelected(new Set()), []);
	const allShownSelected = shown.length > 0 && selectedEntries.length === shown.length;
	const toggleSelectAll = useCallback(
		() => setSelected(allShownSelected ? new Set() : new Set(shown.map((entry) => entry.seq))),
		[allShownSelected, shown]
	);

	// Scoped to the viewer's own subtree, so Ctrl/Cmd+F in an editor elsewhere in
	// the workspace still reaches Obsidian. Inside a leaf Obsidian's keymap claims
	// Mod+F first, so the leaf also binds it on its Scope (`registerLogsViewKeys`);
	// this handler is what serves the embedded Doctor mount.
	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
			const key = event.key.toLowerCase();
			if (key === "f") {
				event.preventDefault();
				event.stopPropagation();
				focusSearch();
			} else if (key === "a" && !isTextField(event.target)) {
				event.preventDefault();
				event.stopPropagation();
				toggleSelectAll();
			}
		},
		[focusSearch, toggleSelectAll]
	);

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
				query={filters.query}
				onToggleExpanded={toggleExpanded}
				onToggleSelected={toggleSelected}
				onCopy={copyEntry}
				cls={cls}
				tid={tid}
			/>
		),
		[expanded, selected, filters.query, toggleExpanded, toggleSelected, copyEntry, cls, tid]
	);

	const inlineActions =
		variant === "embedded" ? (
			<>
				<Button onClick={copyFiltered} testId={tid("copy-filtered")}>
					Copy filtered
				</Button>
				<Button onClick={copyAll} testId={tid("copy-all")}>
					Copy all
				</Button>
				<Button onClick={save} testId={tid("save")}>
					Save to file
				</Button>
			</>
		) : undefined;

	return (
		<div className={`${cls()} ${cls(variant)}`} tabIndex={-1} onKeyDown={handleKeyDown} {...testIdAttr(tid())}>
			<LogsToolbar
				source={source}
				files={fileList}
				onSourceChange={changeSource}
				filters={filters}
				onFiltersChange={setFilters}
				scopes={scopes}
				bounds={bounds}
				searchRef={searchRef}
				actions={inlineActions}
				cls={cls}
				tid={tid}
			/>

			<div className={cls("status")}>
				<span className={cls("counts")} {...testIdAttr(tid("counts"))}>
					{`${entries.length} entries · ${shown.length} shown${selected.size > 0 ? ` · ${selectedEntries.length} selected` : ""}`}
				</span>
				{selected.size > 0 && (
					<>
						<Button onClick={copySelected} testId={tid("copy-selected")}>
							Copy selected
						</Button>
						<Button onClick={clearSelection} testId={tid("clear-selection")}>
							Clear selection
						</Button>
					</>
				)}
				{live && pending > 0 && (
					<button type="button" className={cls("pending")} onClick={showPending} {...testIdAttr(tid("pending"))}>
						{`${pending} new ${pending === 1 ? "entry" : "entries"} — show`}
					</button>
				)}
			</div>

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
