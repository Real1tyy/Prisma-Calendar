import type { ClsFn } from "../../../utils/css-utils";
import type { GanttConfig, Viewport } from "../gantt-types";
import { MS_PER_DAY } from "../gantt-types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthSpan {
	label: string;
	startX: number;
	endX: number;
}

function collectMonthSpans(viewport: Viewport): MonthSpan[] {
	const spans: MonthSpan[] = [];
	const startDate = new Date(viewport.startMs);
	startDate.setHours(0, 0, 0, 0);

	let currentMs = startDate.getTime();
	let currentMonth = -1;
	let currentYear = -1;
	let spanStartX = 0;

	while (currentMs <= viewport.endMs + MS_PER_DAY) {
		const date = new Date(currentMs);
		const month = date.getMonth();
		const year = date.getFullYear();

		if (month !== currentMonth || year !== currentYear) {
			if (currentMonth !== -1) {
				spans.push({
					label: `${MONTH_NAMES[currentMonth]} ${currentYear}`,
					startX: spanStartX,
					endX: viewport.toX(currentMs),
				});
			}
			currentMonth = month;
			currentYear = year;
			spanStartX = viewport.toX(currentMs);
		}

		currentMs += MS_PER_DAY;
	}

	if (currentMonth !== -1) {
		spans.push({
			label: `${MONTH_NAMES[currentMonth]} ${currentYear}`,
			startX: spanStartX,
			endX: viewport.toX(viewport.endMs),
		});
	}

	return spans;
}

export function renderHeader(container: HTMLElement, viewport: Viewport, config: GanttConfig, cls: ClsFn): void {
	container.empty();
	container.style.width = `${viewport.widthPx}px`;
	container.style.height = `${config.headerHeight}px`;

	for (const span of collectMonthSpans(viewport)) {
		const centerX = Math.max(0, Math.min(viewport.widthPx, (span.startX + span.endX) / 2));
		const monthLabel = container.createDiv({ cls: cls("gantt-month-label") });
		monthLabel.style.left = `${centerX}px`;
		monthLabel.textContent = span.label;
	}

	const startDate = new Date(viewport.startMs);
	startDate.setHours(0, 0, 0, 0);
	let currentMs = startDate.getTime();

	while (currentMs <= viewport.endMs) {
		const date = new Date(currentMs);
		const x = viewport.toX(currentMs);

		if (x + viewport.pxPerDay >= 0 && x <= viewport.widthPx) {
			const tick = container.createDiv({ cls: cls("gantt-day-tick") });
			tick.style.left = `${x}px`;
			tick.style.width = `${viewport.pxPerDay}px`;
			tick.textContent = String(date.getDate());
		}

		currentMs += MS_PER_DAY;
	}
}
