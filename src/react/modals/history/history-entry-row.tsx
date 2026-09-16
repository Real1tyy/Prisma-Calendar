import type { HistoryEntry } from "@real1ty/obsidian-plugins";
import { DateTime } from "luxon";
import { memo, useCallback } from "react";

import { cls, tid } from "../../../constants";

export interface HistoryEntryRowProps {
	entry: HistoryEntry;
	onToggle: (entry: HistoryEntry) => void;
	onSpan: (entry: HistoryEntry) => void;
}

const RESTORED_HINT = "Recorded in a previous session — the operation can no longer be replayed.";

export const HistoryEntryRow = memo(function HistoryEntryRow({ entry, onToggle, onSpan }: HistoryEntryRowProps) {
	const handleToggle = useCallback(() => onToggle(entry), [onToggle, entry]);
	const handleSpan = useCallback(() => onSpan(entry), [onSpan, entry]);

	const when = DateTime.fromMillis(entry.timestamp);

	return (
		<div
			className={cls("history-entry", entry.applied ? "history-entry-applied" : "history-entry-undone")}
			data-testid={tid("history-entry", entry.id)}
			data-applied={entry.applied}
			data-replayable={entry.replayable}
		>
			<div className={cls("history-entry-info")}>
				<div className={cls("history-entry-description")}>{entry.description}</div>
				<div className={cls("history-entry-meta")}>
					<span className={cls("history-entry-time")} title={when.toLocaleString(DateTime.DATETIME_MED_WITH_SECONDS)}>
						{when.toRelative()}
					</span>
					<span className={cls("history-entry-type")}>{entry.type}</span>
					{!entry.replayable && (
						<span className={cls("history-entry-restored")} title={RESTORED_HINT}>
							Previous session
						</span>
					)}
				</div>
			</div>

			<span
				className={cls("history-entry-state")}
				data-testid={tid("history-entry-state", entry.id)}
				aria-label={entry.applied ? "Applied" : "Undone"}
			>
				{entry.applied ? "Applied" : "Undone"}
			</span>

			<div className={cls("history-entry-actions")}>
				<button
					type="button"
					disabled={!entry.replayable}
					title={entry.replayable ? undefined : RESTORED_HINT}
					data-testid={tid("history-entry-toggle", entry.id)}
					onClick={handleToggle}
				>
					{entry.applied ? "Undo" : "Redo"}
				</button>
				{/* Span actions stay live on a non-replayable row: they operate on
				    everything from here to the end of the log, skipping the members
				    that can no longer be replayed. */}
				<button type="button" data-testid={tid("history-entry-span", entry.id)} onClick={handleSpan}>
					{entry.applied ? "Revert to here" : "Restore to here"}
				</button>
			</div>
		</div>
	);
});
