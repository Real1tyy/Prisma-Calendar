import { memo } from "react";

import { cls, tid } from "../../constants";
import { formatIndexingTally, type IndexingTally } from "../../core/indexing-stats";

interface IndexingStatsInfoProps {
	tally: IndexingTally;
}

/**
 * Compact "is the active planning system wired up?" line shown under the
 * planning-system selector. Presentational — the parent computes the tally
 * on demand (no background re-classification), so this just renders it.
 */
export const IndexingStatsInfo = memo(function IndexingStatsInfo({ tally }: IndexingStatsInfoProps) {
	return (
		<div className={cls("indexing-stats")} data-testid={tid("indexing-stats")}>
			{formatIndexingTally(tally)}
		</div>
	);
});
