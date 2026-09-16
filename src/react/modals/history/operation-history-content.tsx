import type { CommandManager, HistoryEntry } from "@real1ty/obsidian-plugins";
import { VirtualList } from "@real1ty/obsidian-plugins-react";
import { Notice } from "obsidian";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cls, tid } from "../../../constants";
import { HistoryEntryRow } from "./history-entry-row";

const ROW_HEIGHT = 62;

export interface OperationHistoryContentProps {
	manager: CommandManager;
	/** Calendar name, shown so a multi-calendar vault knows whose log this is. */
	calendarName: string;
}

export function OperationHistoryContent({ manager, calendarName }: OperationHistoryContentProps) {
	const [entries, setEntries] = useState<readonly HistoryEntry[]>(() => manager.getHistory());
	const [newestFirst, setNewestFirst] = useState(true);

	// External undo/redo (Ctrl+Z with the modal open) has to land in the list too.
	useEffect(() => manager.onHistoryChange(() => setEntries(manager.getHistory())), [manager]);

	const rows = useMemo(() => (newestFirst ? [...entries].reverse() : [...entries]), [entries, newestFirst]);

	const toggle = useCallback(
		(entry: HistoryEntry) => {
			void (entry.applied ? manager.undoEntry(entry.id) : manager.redoEntry(entry.id)).then((ok) => {
				if (!ok) new Notice(`Could not ${entry.applied ? "undo" : "redo"}: ${entry.description}`);
			});
		},
		[manager]
	);

	const span = useCallback(
		(entry: HistoryEntry) => {
			void (entry.applied ? manager.revertTo(entry.id) : manager.restoreTo(entry.id)).then((count) => {
				const verb = entry.applied ? "Reverted" : "Restored";
				new Notice(
					count === 0 ? `Nothing to ${entry.applied ? "revert" : "restore"}` : `${verb} ${count} operation(s)`
				);
			});
		},
		[manager]
	);

	const clear = useCallback(() => {
		void manager.clearHistory();
	}, [manager]);

	return (
		<div className={cls("history-modal")} data-testid={tid("history-modal")}>
			<div className={cls("history-modal-header")}>
				<div className={cls("history-modal-summary")} data-testid={tid("history-count")}>
					{entries.length === 0
						? `No operations recorded for ${calendarName}`
						: `${entries.length} operation${entries.length === 1 ? "" : "s"} · ${calendarName}`}
				</div>
				<div className={cls("history-modal-controls")}>
					<button
						type="button"
						data-testid={tid("history-sort-toggle")}
						onClick={() => setNewestFirst((current) => !current)}
					>
						{newestFirst ? "Newest first" : "Oldest first"}
					</button>
					<button
						type="button"
						className="mod-warning"
						disabled={entries.length === 0}
						data-testid={tid("history-clear")}
						onClick={clear}
					>
						Clear history
					</button>
				</div>
			</div>

			{rows.length === 0 ? (
				<div className={cls("history-modal-empty")} data-testid={tid("history-empty")}>
					No operations recorded yet. Create, edit or batch-update events and they'll show up here.
				</div>
			) : (
				<VirtualList
					items={rows}
					estimateSize={ROW_HEIGHT}
					getKey={(entry) => entry.id}
					className={cls("history-modal-list")}
					renderItem={(entry) => <HistoryEntryRow entry={entry} onToggle={toggle} onSpan={span} />}
				/>
			)}
		</div>
	);
}
