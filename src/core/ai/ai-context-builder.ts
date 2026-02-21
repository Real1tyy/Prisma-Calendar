import type { CalendarEvent } from "../../types/calendar";
import { isTimedEvent } from "../../types/calendar";
import { aggregateStats, formatDuration, formatPercentage, type Stats } from "../../utils/weekly-stats";

export interface CalendarContext {
	calendarName: string;
	viewType: string;
	viewLabel: string;
	dateRange: string;
	events: AIEventSummary[];
	statsByName: AIStatEntry[];
	statsByCategory: AIStatEntry[];
	totalDuration: string;
}

export interface AIEventSummary {
	title: string;
	filePath?: string;
	start: string;
	end?: string;
	allDay: boolean;
	categories?: string[];
	location?: string;
	status?: string;
}

interface AIStatEntry {
	name: string;
	count: number;
	duration: string;
	percentage: string;
}

const VIEW_TYPE_LABELS: Record<string, string> = {
	dayGridMonth: "Monthly View",
	timeGridWeek: "Weekly View",
	timeGridDay: "Daily View",
	listWeek: "List View",
};

export function getViewLabel(viewType: string): string {
	return VIEW_TYPE_LABELS[viewType] ?? viewType;
}

export function buildCalendarContext(
	calendarName: string,
	viewType: string,
	currentStart: Date,
	currentEnd: Date,
	events: CalendarEvent[],
	categoryProp?: string
): CalendarContext {
	const viewLabel = VIEW_TYPE_LABELS[viewType] ?? viewType;
	const dateRange = formatDateRange(currentStart, currentEnd);
	const eventSummaries = events.map(mapEventToSummary);

	const nameStats = aggregateStats(events, currentStart, currentEnd, "name", categoryProp);
	const categoryStats = aggregateStats(events, currentStart, currentEnd, "category", categoryProp);

	return {
		calendarName,
		viewType,
		viewLabel,
		dateRange,
		events: eventSummaries,
		statsByName: mapStatsToEntries(nameStats),
		statsByCategory: mapStatsToEntries(categoryStats),
		totalDuration: formatDuration(nameStats.totalDuration),
	};
}

function mapEventToSummary(event: CalendarEvent): AIEventSummary {
	const summary: AIEventSummary = {
		title: event.title,
		start: event.start,
		allDay: event.allDay,
	};

	if (isTimedEvent(event)) {
		summary.end = event.end;
	}

	if (event.metadata?.categories && event.metadata.categories.length > 0) {
		summary.categories = event.metadata.categories;
	}

	if (event.metadata?.location) {
		summary.location = event.metadata.location;
	}

	if (event.metadata?.status) {
		summary.status = event.metadata.status;
	}

	return summary;
}

function mapStatsToEntries(stats: Stats): AIStatEntry[] {
	return stats.entries.map((entry) => ({
		name: entry.name,
		count: entry.count,
		duration: formatDuration(entry.duration),
		percentage: formatPercentage(entry.duration, stats.totalDuration),
	}));
}

function formatDateRange(start: Date, end: Date): string {
	const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
	const yearOptions: Intl.DateTimeFormatOptions = { ...options, year: "numeric" };

	const startStr = start.toLocaleDateString("en-US", options);
	const endDate = new Date(end);
	endDate.setDate(endDate.getDate() - 1);
	const endStr = endDate.toLocaleDateString("en-US", yearOptions);

	return `${startStr} – ${endStr}`;
}

export function buildSystemPromptWithContext(context: CalendarContext, basePrompt: string): string {
	const eventsJson = JSON.stringify(context.events, null, 2);

	let nameStatsTable = "| Name | Count | Duration | % |\n|------|-------|----------|---|\n";
	for (const entry of context.statsByName) {
		nameStatsTable += `| ${entry.name} | ${entry.count} | ${entry.duration} | ${entry.percentage} |\n`;
	}

	let categoryStatsTable = "| Category | Count | Duration | % |\n|----------|-------|----------|---|\n";
	for (const entry of context.statsByCategory) {
		categoryStatsTable += `| ${entry.name} | ${entry.count} | ${entry.duration} | ${entry.percentage} |\n`;
	}

	return `${basePrompt}

Answer based ONLY on the data provided below. Do not make up events or numbers.
Be concise. Use Markdown formatting when helpful.

## Current View
- Calendar: ${context.calendarName}
- View: ${context.viewLabel}
- Date range: ${context.dateRange}

## Events (${context.events.length} events)
\`\`\`json
${eventsJson}
\`\`\`

## Statistics by Event Name
${nameStatsTable}Total: ${context.totalDuration}

## Statistics by Category
${categoryStatsTable}Total: ${context.totalDuration}`;
}

export const NO_CONTEXT_PROMPT_SUFFIX =
	"\n\nNo calendar view is currently open, so you don't have access to specific event data. Answer general questions about calendars and scheduling.";

export interface ManipulationContext {
	calendarName: string;
	dateRange: string;
	events: AIEventSummary[];
}

export function buildManipulationContext(
	calendarName: string,
	currentStart: Date,
	currentEnd: Date,
	events: CalendarEvent[]
): ManipulationContext {
	const dateRange = formatDateRange(currentStart, currentEnd);
	const eventSummaries = events.map(mapEventToManipulationSummary);

	return {
		calendarName,
		dateRange,
		events: eventSummaries,
	};
}

function mapEventToManipulationSummary(event: CalendarEvent): AIEventSummary {
	const summary: AIEventSummary = {
		title: event.title,
		filePath: event.ref.filePath,
		start: event.start,
		allDay: event.allDay,
	};

	if (isTimedEvent(event)) {
		summary.end = event.end;
	}

	if (event.metadata?.categories && event.metadata.categories.length > 0) {
		summary.categories = event.metadata.categories;
	}

	if (event.metadata?.location) {
		summary.location = event.metadata.location;
	}

	if (event.metadata?.status) {
		summary.status = event.metadata.status;
	}

	return summary;
}

export function buildManipulationSystemPrompt(context: ManipulationContext, basePrompt: string): string {
	const eventsJson = JSON.stringify(context.events, null, 2);

	return `${basePrompt}

You are an AI assistant for Prisma Calendar. The user will describe calendar changes in natural language.
You MUST respond with ONLY a JSON code block containing an array of operations. No other text.

Available operations:
- create: { "type": "create", "title": string, "start": ISO datetime, "end": ISO datetime, "allDay"?: boolean, "categories"?: string[], "location"?: string, "participants"?: string[] }
- edit: { "type": "edit", "filePath": string, "title"?: string, "start"?: ISO datetime, "end"?: ISO datetime, "allDay"?: boolean, "categories"?: string[], "location"?: string, "participants"?: string[] }
- delete: { "type": "delete", "filePath": string }

Rules:
- Use ISO datetime format: "YYYY-MM-DDTHH:mm:ss"
- For edits, only include fields that should change
- For deletes, reference the filePath of the event to remove
- To replace an event: delete the old one, then create a new one

## Calendar Context
- Calendar: ${context.calendarName}
- Date range: ${context.dateRange}

## Events (${context.events.length} events)
\`\`\`json
${eventsJson}
\`\`\``;
}
