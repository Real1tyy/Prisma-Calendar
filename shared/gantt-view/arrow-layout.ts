import type { ArrowLayout, BarLayout, GanttConfig, PackedTask } from "./gantt-types";

const ARROW_GAP = 12;
const CURVE_RADIUS = 5;

function arc(dx: number, dy: number, sweep: number): string {
	return `a ${CURVE_RADIUS} ${CURVE_RADIUS} 0 0 ${sweep} ${dx} ${dy}`;
}

function buildForwardPath(fromX: number, fromY: number, toX: number, toY: number): string {
	const midX = fromX + ARROW_GAP;
	const dy = toY - fromY;
	const absDy = Math.abs(dy);
	const sweepV = dy > 0 ? 1 : 0;
	const signY = dy > 0 ? 1 : -1;

	if (absDy < CURVE_RADIUS * 2) {
		return `M ${fromX},${fromY} H ${midX} V ${toY} H ${toX}`;
	}

	return [
		`M ${fromX},${fromY}`,
		`H ${midX - CURVE_RADIUS}`,
		arc(CURVE_RADIUS, CURVE_RADIUS * signY, sweepV),
		`V ${toY - CURVE_RADIUS * signY}`,
		arc(CURVE_RADIUS, CURVE_RADIUS * signY, 1 - sweepV),
		`H ${toX}`,
	].join(" ");
}

function buildWrapAroundPath(fromX: number, fromY: number, toX: number, toY: number, fromBarBottom: number): string {
	const dropY = fromBarBottom + ARROW_GAP;
	const leftX = toX - ARROW_GAP * 2;

	return [
		`M ${fromX},${fromY}`,
		`V ${dropY - CURVE_RADIUS}`,
		arc(-CURVE_RADIUS, CURVE_RADIUS, 1),
		`H ${leftX + CURVE_RADIUS}`,
		arc(-CURVE_RADIUS, CURVE_RADIUS, 0),
		`V ${toY - CURVE_RADIUS}`,
		arc(CURVE_RADIUS, CURVE_RADIUS, 0),
		`H ${toX}`,
	].join(" ");
}

export function layoutArrows(tasks: PackedTask[], bars: Map<string, BarLayout>, _config: GanttConfig): ArrowLayout[] {
	return tasks.flatMap((task) =>
		task.dependencies
			.map((depId) => {
				const fromBar = bars.get(depId);
				const toBar = bars.get(task.id);
				if (!fromBar || !toBar) return null;

				const fromX = fromBar.x + fromBar.width;
				const fromY = fromBar.y + fromBar.height / 2;
				const toX = toBar.x;
				const toY = toBar.y + toBar.height / 2;

				const path =
					toX > fromX + ARROW_GAP
						? buildForwardPath(fromX, fromY, toX, toY)
						: buildWrapAroundPath(fromX, fromY, toX, toY, fromBar.y + fromBar.height);

				return { fromTaskId: depId, toTaskId: task.id, path };
			})
			.filter((a): a is ArrowLayout => a !== null)
	);
}
