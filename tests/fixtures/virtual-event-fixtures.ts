import type { VirtualEventData } from "../../src/types/virtual-event";

export function createVirtualEventData(overrides: Partial<VirtualEventData> = {}): VirtualEventData {
	return {
		id: "ve-1",
		title: "Virtual Meeting",
		start: "2025-03-15T09:00:00",
		end: "2025-03-15T10:00:00",
		allDay: false,
		properties: {},
		...overrides,
	};
}

export function createAllDayVirtualEventData(overrides: Partial<VirtualEventData> = {}): VirtualEventData {
	return createVirtualEventData({
		title: "Day Off",
		start: "2025-03-15T00:00:00",
		end: null,
		allDay: true,
		...overrides,
	});
}
