import { memo, useMemo } from "react";

import type { CalendarEvent } from "../../../types/calendar";
import { calculateCapacityFromEvents, formatBoundaryRange, formatCapacityLabel } from "../../../utils/stats/capacity";
import { formatDuration, formatDurationAsDecimalHours } from "../../../utils/stats";

interface CapacityLabelProps {
	events: CalendarEvent[];
	start: Date;
	end: Date;
	hourStart: number;
	hourEnd: number;
	showDecimalHours: boolean;
}

export const CapacityLabel = memo(function CapacityLabel({
	events,
	start,
	end,
	hourStart,
	hourEnd,
	showDecimalHours,
}: CapacityLabelProps) {
	const capacity = useMemo(
		() => calculateCapacityFromEvents(events, start, end, hourStart, hourEnd),
		[events, start, end, hourStart, hourEnd]
	);

	const formatDur = showDecimalHours ? formatDurationAsDecimalHours : formatDuration;
	const label = formatCapacityLabel(capacity, showDecimalHours);

	return (
		<div className="prisma-capacity-label">
			<span className="prisma-capacity-used">
				⏱ {label} ({capacity.percentUsed.toFixed(0)}%)
			</span>
			<span>·</span>
			<span className="prisma-capacity-remaining">{formatDur(capacity.remainingMs)} remaining</span>
			<span>·</span>
			<span className="prisma-capacity-bounds">{formatBoundaryRange(capacity)}</span>
		</div>
	);
});
