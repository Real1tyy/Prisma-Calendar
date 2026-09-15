import { memo, useCallback } from "react";

import type { ScopedTheme } from "../../contexts/theme-context";
import { testIdAttr } from "../../utils/test-id";
import type { LogTimeBounds } from "./filters";

/** Positions across the range. Fine enough to separate entries a few milliseconds apart in a short session. */
const STEPS = 1000;

export interface TimeRangeSliderProps extends Pick<ScopedTheme, "cls" | "tid"> {
	bounds: LogTimeBounds;
	start: number;
	end: number;
	onChange: (start: number, end: number) => void;
}

function toStep(ts: number, { min, max }: LogTimeBounds): number {
	return Math.round(((ts - min) / (max - min)) * STEPS);
}

function toTs(step: number, { min, max }: LogTimeBounds): number {
	return Math.round(min + (step / STEPS) * (max - min));
}

/**
 * Two thumbs over the loaded time range: drag the left one to drop older
 * entries, the right one to drop newer. The thumbs cannot cross.
 */
export const TimeRangeSlider = memo(function TimeRangeSlider({
	bounds,
	start,
	end,
	onChange,
	cls,
	tid,
}: TimeRangeSliderProps) {
	const startStep = toStep(Math.max(start, bounds.min), bounds);
	const endStep = toStep(Math.min(end, bounds.max), bounds);

	const moveStart = useCallback(
		(step: number) => onChange(toTs(Math.min(step, endStep), bounds), toTs(endStep, bounds)),
		[onChange, endStep, bounds]
	);
	const moveEnd = useCallback(
		(step: number) => onChange(toTs(startStep, bounds), toTs(Math.max(step, startStep), bounds)),
		[onChange, startStep, bounds]
	);

	return (
		<div className={cls("range")} {...testIdAttr(tid("range"))}>
			<div
				className={cls("range-fill")}
				style={{ left: `${(startStep / STEPS) * 100}%`, right: `${100 - (endStep / STEPS) * 100}%` }}
			/>
			<input
				type="range"
				min={0}
				max={STEPS}
				value={startStep}
				aria-label="Oldest entry shown"
				onChange={(event) => moveStart(Number(event.target.value))}
				{...testIdAttr(tid("range-start"))}
			/>
			<input
				type="range"
				min={0}
				max={STEPS}
				value={endStep}
				aria-label="Newest entry shown"
				onChange={(event) => moveEnd(Number(event.target.value))}
				{...testIdAttr(tid("range-end"))}
			/>
		</div>
	);
});
