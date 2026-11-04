export interface WeekViewEventCreationEdgeInput {
	viewType: string;
	edgeArea: string;
	eventStart: Date | null;
	eventEnd: Date | null;
	allDay: boolean;
	eventRect: DOMRect;
	clientX: number;
	clientY: number;
	snapDurationMinutes: number;
}

export function getWeekViewEventEdgeCreateDate(input: WeekViewEventCreationEdgeInput): Date | null {
	const edgePercent = Number(input.edgeArea);
	if (
		input.viewType !== "timeGridWeek" ||
		input.allDay ||
		!input.eventStart ||
		!input.eventEnd ||
		!Number.isFinite(edgePercent) ||
		edgePercent <= 0 ||
		input.snapDurationMinutes <= 0 ||
		input.eventRect.width <= 0 ||
		input.eventRect.height <= 0 ||
		input.clientX < input.eventRect.right - (input.eventRect.width * edgePercent) / 100
	) {
		return null;
	}

	const durationMs = input.eventEnd.getTime() - input.eventStart.getTime();
	if (durationMs <= 0) return null;

	const verticalFraction = Math.min(1, Math.max(0, (input.clientY - input.eventRect.top) / input.eventRect.height));
	const clickedAt = new Date(input.eventStart.getTime() + durationMs * verticalFraction);
	clickedAt.setSeconds(0, 0);
	clickedAt.setMinutes(clickedAt.getMinutes() - (clickedAt.getMinutes() % input.snapDurationMinutes));
	return clickedAt;
}
