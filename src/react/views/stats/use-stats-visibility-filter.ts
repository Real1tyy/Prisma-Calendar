import { useCallback, useMemo, useState } from "react";

import type { WeeklyStatEntry } from "../../../utils/stats";

export interface StatsVisibilityFilter {
	hiddenLabels: ReadonlySet<string>;
	visibleEntries: WeeklyStatEntry[];
	visibleTotalDuration: number;
	visibleEventCount: number;
	hasHidden: boolean;
	onVisibilityChange: (label: string, visible: boolean) => void;
	clearHidden: () => void;
}

export function useStatsVisibilityFilter(entries: WeeklyStatEntry[] | undefined): StatsVisibilityFilter {
	const [hiddenLabels, setHiddenLabels] = useState<ReadonlySet<string>>(() => new Set());

	const onVisibilityChange = useCallback((label: string, visible: boolean) => {
		setHiddenLabels((prev) => {
			const next = new Set(prev);
			if (visible) next.delete(label);
			else next.add(label);
			return next;
		});
	}, []);

	const clearHidden = useCallback(() => setHiddenLabels(new Set()), []);

	const visibleEntries = useMemo(
		() => entries?.filter((e) => !hiddenLabels.has(e.name)) ?? [],
		[entries, hiddenLabels]
	);
	const visibleTotalDuration = useMemo(() => visibleEntries.reduce((sum, e) => sum + e.duration, 0), [visibleEntries]);
	const visibleEventCount = useMemo(() => visibleEntries.reduce((sum, e) => sum + e.count, 0), [visibleEntries]);

	return {
		hiddenLabels,
		visibleEntries,
		visibleTotalDuration,
		visibleEventCount,
		hasHidden: hiddenLabels.size > 0,
		onVisibilityChange,
		clearHidden,
	};
}
