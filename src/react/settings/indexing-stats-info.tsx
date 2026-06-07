import { useObservable } from "@real1ty-obsidian-plugins-react";
import { Notice } from "obsidian";
import { memo, useCallback } from "react";

import { cls, tid } from "../../constants";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { formatIndexingTally } from "../../core/indexing-stats";

interface IndexingStatsInfoProps {
	bundle: CalendarBundle;
}

/**
 * Live "is my folder wired up?" panel for the Properties tab. Shows the
 * per-planning-system tally and a one-click reindex for when a property remap
 * needs the already-indexed notes re-read.
 */
export const IndexingStatsInfo = memo(function IndexingStatsInfo({ bundle }: IndexingStatsInfoProps) {
	const stats = useObservable(bundle.indexingStats$, null);

	const handleReindex = useCallback(() => {
		bundle.refreshCalendar();
		new Notice("Prisma Calendar — reindexing…");
	}, [bundle]);

	return (
		<div className={cls("settings-info-box")}>
			<h4>Indexing</h4>
			<p data-testid={tid("indexing-stats")}>{stats ? `Indexed: ${formatIndexingTally(stats)}` : "Indexing…"}</p>
			<p className="setting-item-description">
				How the notes in this planning system's folder resolved. If events are missing, try reindexing to re-read them.
			</p>
			<button
				type="button"
				className={cls("calendar-action-button")}
				data-testid={tid("reindex-calendar")}
				onClick={handleReindex}
			>
				Reindex
			</button>
		</div>
	);
});
