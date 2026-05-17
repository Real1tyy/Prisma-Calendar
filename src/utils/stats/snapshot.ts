import { toLocalISOString } from "@real1ty-obsidian-plugins";

import type { EventStore } from "../../core/event-store";
import type { CalendarEvent } from "../../types/calendar";
import { aggregateStats, type AggregationMode, type Stats } from "./aggregation";
import { boundsByInterval, type StatsInterval } from "./periods";

export interface StatsSnapshotOptions {
	date: Date;
	interval: StatsInterval;
	mode: AggregationMode;
	categoryProp: string;
	includeSkipped?: boolean;
}

export interface StatsSnapshot {
	bounds: { start: Date; end: Date };
	events: CalendarEvent[];
	skippedEvents: CalendarEvent[];
	filteredEvents: CalendarEvent[];
	stats: Stats;
}

export async function buildStatsSnapshot(
	eventStore: EventStore,
	options: StatsSnapshotOptions
): Promise<StatsSnapshot> {
	const bounds = boundsByInterval(options.date, options.interval);
	const query = { start: toLocalISOString(bounds.start), end: toLocalISOString(bounds.end) };

	const events = await eventStore.getEvents(query);
	const skippedEvents = options.includeSkipped ? eventStore.getSkippedEvents(query) : [];
	const filteredEvents = options.includeSkipped ? [...events, ...skippedEvents] : events;
	const stats = aggregateStats(filteredEvents, bounds.start, bounds.end, options.mode, options.categoryProp);

	return { bounds, events, skippedEvents, filteredEvents, stats };
}
