import { minsToTimeStr, parseTimeToMins } from "@real1ty-obsidian-plugins";

import type { CalendarEvent } from "../../types/calendar";
import { isTimedEvent } from "../../types/calendar";
import type { CategoryAssignmentPreset } from "../../types/settings";
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

export interface CategoryContext {
	availableCategories: string[];
	presets: CategoryAssignmentPreset[];
}

export function buildCategoryContextBlock(context: CategoryContext): string {
	if (context.availableCategories.length === 0 && context.presets.length === 0) {
		return "";
	}

	let block = "\n\n## User Categories & Event Name Mappings";

	if (context.availableCategories.length > 0) {
		block += `\n\nAvailable categories: ${context.availableCategories.join(", ")}`;
	}

	if (context.presets.length > 0) {
		block += "\n\nEvent name → category mappings (auto-assigned when creating events):";
		for (const preset of context.presets) {
			block += `\n- "${preset.eventName}" → [${preset.categories.join(", ")}]`;
		}
	}

	block += `

Category matching rules:
- Always use the categories listed above when they match what the user is describing. Categories are assigned automatically based on event names — you do not need to set them manually.
- If the user mentions an event name that closely matches one of the event name mappings above, use the exact event name from the mapping (the user may have a typo).
- Only use a category NOT in the list if the user explicitly asks to create a new category or refers to something clearly unrelated to any existing category.
- If the user's text has a typo that resembles an existing category, use the existing category spelling.`;

	return block;
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

export function buildSystemPromptWithContext(
	context: CalendarContext,
	basePrompt: string,
	categoryContext?: CategoryContext
): string {
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
${categoryStatsTable}Total: ${context.totalDuration}${categoryContext ? buildCategoryContextBlock(categoryContext) : ""}`;
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

export interface PatternAnalysis {
	earliestStart: string;
	latestEnd: string;
	avgEventsPerDay: number;
	typicalBlockMins: number;
	recurringBlocks: Array<{
		title: string;
		typicalStart: string;
		typicalDurationMins: number;
		frequency: number;
	}>;
	dailyTemplate: string;
	activeDays: string[];
}

export function analyzePreviousPatterns(events: AIEventSummary[]): PatternAnalysis {
	const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const timedEvents = events.filter((e) => !e.allDay && e.end);

	if (timedEvents.length === 0) {
		return {
			earliestStart: "09:00",
			latestEnd: "17:00",
			avgEventsPerDay: 0,
			typicalBlockMins: 0,
			recurringBlocks: [],
			dailyTemplate: "No previous events to analyze.",
			activeDays: [],
		};
	}

	// Group events by day (YYYY-MM-DD)
	const byDay = new Map<string, AIEventSummary[]>();
	for (const event of timedEvents) {
		const dayKey = event.start.slice(0, 10);
		const existing = byDay.get(dayKey);
		if (existing) {
			existing.push(event);
		} else {
			byDay.set(dayKey, [event]);
		}
	}

	// Find earliest start and latest end across all days
	let earliestMins = 24 * 60;
	let latestMins = 0;
	for (const event of timedEvents) {
		const startMins = parseTimeToMins(event.start);
		const endMins = event.end ? parseTimeToMins(event.end) : startMins;
		if (startMins < earliestMins) earliestMins = startMins;
		if (endMins > latestMins) latestMins = endMins;
	}

	const earliestStart = minsToTimeStr(earliestMins);
	const latestEnd = minsToTimeStr(latestMins);

	// Average events per day (only counting days that have events)
	const dayCount = byDay.size;
	const avgEventsPerDay = Math.round((timedEvents.length / dayCount) * 10) / 10;

	// Active days of the week
	const activeDaysSet = new Set<string>();
	for (const dayKey of byDay.keys()) {
		const date = new Date(dayKey + "T00:00:00");
		activeDaysSet.add(DAY_NAMES[date.getDay()]);
	}
	const activeDays = DAY_NAMES.filter((d) => activeDaysSet.has(d));

	// Recurring block detection: group by title, find blocks appearing 3+ days at similar times
	const titleOccurrences = new Map<string, Array<{ startMins: number; durationMins: number }>>();
	for (const event of timedEvents) {
		const startMins = parseTimeToMins(event.start);
		const endMins = event.end ? parseTimeToMins(event.end) : startMins + 60;
		const entry = titleOccurrences.get(event.title);
		if (entry) {
			entry.push({ startMins, durationMins: endMins - startMins });
		} else {
			titleOccurrences.set(event.title, [{ startMins, durationMins: endMins - startMins }]);
		}
	}

	const recurringBlocks: PatternAnalysis["recurringBlocks"] = [];
	for (const [title, occurrences] of titleOccurrences) {
		if (occurrences.length < 3) continue;

		// Check if start times cluster within a 30-minute window
		const sortedStarts = occurrences.map((o) => o.startMins).sort((a, b) => a - b);
		const medianStart = sortedStarts[Math.floor(sortedStarts.length / 2)];
		const inWindow = occurrences.filter((o) => Math.abs(o.startMins - medianStart) <= 30);

		if (inWindow.length >= 3) {
			const avgDuration = Math.round(inWindow.reduce((sum, o) => sum + o.durationMins, 0) / inWindow.length);
			recurringBlocks.push({
				title,
				typicalStart: minsToTimeStr(medianStart),
				typicalDurationMins: avgDuration,
				frequency: inWindow.length,
			});
		}
	}

	// Daily template: pick the day with the most events, format as time slots
	let bestDay = "";
	let bestCount = 0;
	for (const [dayKey, dayEvents] of byDay) {
		if (dayEvents.length > bestCount) {
			bestCount = dayEvents.length;
			bestDay = dayKey;
		}
	}

	let dailyTemplate = "No template available.";
	const templateEvents = byDay.get(bestDay);
	if (templateEvents) {
		const sorted = [...templateEvents].sort((a, b) => a.start.localeCompare(b.start));
		dailyTemplate = sorted
			.map((e) => {
				const startTime = e.start.slice(11, 16);
				const endTime = e.end ? e.end.slice(11, 16) : "??:??";
				return `${startTime}-${endTime} ${e.title}`;
			})
			.join("\n");
	}

	const allDurations = timedEvents
		.map((e) => {
			const s = parseTimeToMins(e.start);
			const en = e.end ? parseTimeToMins(e.end) : s + 60;
			return en - s;
		})
		.filter((d) => d > 0)
		.sort((a, b) => a - b);
	const typicalBlockMins = allDurations.length > 0 ? allDurations[Math.floor(allDurations.length / 2)] : 0;

	return { earliestStart, latestEnd, avgEventsPerDay, typicalBlockMins, recurringBlocks, dailyTemplate, activeDays };
}

export interface PlanningContext {
	calendarName: string;
	currentDateRange: string;
	currentStart: string;
	currentEnd: string;
	currentEvents: AIEventSummary[];
	previousDateRange: string;
	previousEvents: AIEventSummary[];
}

export function buildPlanningContext(
	calendarName: string,
	currentStart: Date,
	currentEnd: Date,
	currentEvents: CalendarEvent[],
	previousStart: Date,
	previousEnd: Date,
	previousEvents: CalendarEvent[]
): PlanningContext {
	return {
		calendarName,
		currentDateRange: formatDateRange(currentStart, currentEnd),
		currentStart: currentStart.toISOString(),
		currentEnd: currentEnd.toISOString(),
		currentEvents: currentEvents.map(mapEventToManipulationSummary),
		previousDateRange: formatDateRange(previousStart, previousEnd),
		previousEvents: previousEvents.map(mapEventToSummary),
	};
}

export interface PlanningPromptFlags {
	gapDetection: boolean;
	dayCoverage: boolean;
}

export function buildPlanningSystemPrompt(
	context: PlanningContext,
	basePrompt: string,
	categoryContext?: CategoryContext,
	flags?: PlanningPromptFlags
): string {
	const currentEventsJson = JSON.stringify(context.currentEvents, null, 2);
	const previousEventsJson = JSON.stringify(context.previousEvents, null, 2);
	const patterns = analyzePreviousPatterns(context.previousEvents);

	let patternsBlock = `## Detected Patterns from Previous Interval
- Day typically starts at: ${patterns.earliestStart}
- Day typically ends at: ${patterns.latestEnd}
- Average events per day: ${patterns.avgEventsPerDay}${patterns.typicalBlockMins > 0 ? `\n- Typical event duration: ~${patterns.typicalBlockMins} minutes` : ""}
- Days with events: ${patterns.activeDays.length > 0 ? patterns.activeDays.join(", ") : "None detected"}`;

	if (patterns.recurringBlocks.length > 0) {
		patternsBlock += "\n- Recurring blocks:";
		for (const block of patterns.recurringBlocks) {
			patternsBlock += `\n  - "${block.title}" at ${block.typicalStart}, ~${block.typicalDurationMins}min, ${block.frequency} days/interval`;
		}
	}

	patternsBlock += `\n\n## Daily Template (from previous interval)\n${patterns.dailyTemplate}`;

	const enableDayCoverage = flags?.dayCoverage ?? true;
	const enableGapDetection = flags?.gapDetection ?? true;

	const planningRules: string[] = [];
	if (enableDayCoverage) {
		planningRules.push(
			"FILL ALL DAYS: Create events for EVERY day in the interval. Never skip a day including weekends."
		);
	}
	planningRules.push(
		"NO OVERLAPS: Events overlap ONLY when one event's time range crosses into another's (e.g., 09:00-10:30 and 10:00-11:00 overlap). Sharing a boundary is NOT an overlap — 09:00-10:00 and 10:00-11:00 do NOT overlap."
	);
	if (enableGapDetection) {
		planningRules.push(
			"CONTIGUOUS SCHEDULING: Events MUST be exactly back-to-back with zero gaps. When one ends at 18:30, the next MUST start at 18:30 — not 18:31, not 18:35. Every minute of gap is a validation error."
		);
	}
	const blockSizeRule =
		patterns.typicalBlockMins > 0
			? `BLOCK SIZES: The user's typical event duration is ~${patterns.typicalBlockMins} minutes. Use similar block sizes unless the user specifies otherwise.`
			: "BLOCK SIZES: Choose block sizes based on what the user requests. If not specified, use reasonable durations.";

	planningRules.push(
		"EXACT DURATION ACCOUNTING: When the user requests a specific amount of time for an activity (whether in hours, minutes, or any unit), the TOTAL minutes across all created events for that activity must match exactly. Before outputting, verify your math: sum up the duration of every event for each requested activity and confirm it matches.",
		"RESPECT EXISTING: Plan around existing events unless the user says otherwise.",
		`MATCH PATTERNS: Start days at ${patterns.earliestStart}, end at ${patterns.latestEnd}. Preserve recurring blocks (meals, routines) at their detected times.`,
		blockSizeRule,
		`BOUNDARIES: All events must fall within ${context.currentStart} to ${context.currentEnd}.`,
		'FORMAT: Use ISO datetime format "YYYY-MM-DDTHH:mm:ss". Respond with ONLY a JSON array of operations.',
		"For edits, only include fields that should change.",
		"For deletes, reference the filePath of the event to remove."
	);

	const numberedRules = planningRules.map((rule, i) => `${i + 1}. ${rule}`).join("\n");

	return `${basePrompt}

You are an AI assistant for Prisma Calendar. The user will describe how they want to allocate their time for the current interval.
You MUST respond with ONLY a JSON code block containing an array of operations. No other text.

Available operations:
- create: { "type": "create", "title": string, "start": ISO datetime, "end": ISO datetime, "allDay"?: boolean, "categories"?: string[], "location"?: string, "participants"?: string[] }
- edit: { "type": "edit", "filePath": string, "title"?: string, "start"?: ISO datetime, "end"?: ISO datetime, "allDay"?: boolean, "categories"?: string[], "location"?: string, "participants"?: string[] }
- delete: { "type": "delete", "filePath": string }

${patternsBlock}

## Planning Rules (MANDATORY — violations will be rejected and you will be asked to fix them)
${numberedRules}

## Calendar Context
- Calendar: ${context.calendarName}
- Current interval: ${context.currentDateRange}

## Current Events (${context.currentEvents.length} events — plan around these)
\`\`\`json
${currentEventsJson}
\`\`\`

## Previous Interval Events (${context.previousEvents.length} events — learn patterns from these)
- Previous interval: ${context.previousDateRange}
\`\`\`json
${previousEventsJson}
\`\`\`${categoryContext ? buildCategoryContextBlock(categoryContext) : ""}`;
}

export function buildManipulationSystemPrompt(
	context: ManipulationContext,
	basePrompt: string,
	categoryContext?: CategoryContext
): string {
	const eventsJson = JSON.stringify(context.events, null, 2);

	return `${basePrompt}

You are an AI assistant for Prisma Calendar. The user will describe calendar changes in natural language.
You MUST respond with ONLY a JSON code block containing an array of operations. No other text.

Available operations:
- create: { "type": "create", "title": string, "start": ISO datetime, "end": ISO datetime, "allDay"?: boolean, "categories"?: string[], "location"?: string, "participants"?: string[] }
- edit: { "type": "edit", "filePath": string, "title"?: string, "start"?: ISO datetime, "end"?: ISO datetime, "allDay"?: boolean, "categories"?: string[], "location"?: string, "participants"?: string[] }
- delete: { "type": "delete", "filePath": string }

Rules (MANDATORY — violations will be rejected and you will be asked to fix them):
- Use ISO datetime format: "YYYY-MM-DDTHH:mm:ss"
- For edits, only include fields that should change
- For deletes, reference the filePath of the event to remove
- To replace an event: delete the old one, then create a new one
- Events overlap ONLY when one event's time range crosses into another's. Sharing a boundary is NOT an overlap — 09:00-10:00 and 10:00-11:00 do NOT overlap. NEVER create truly overlapping events.
- When adjusting times, ensure events are contiguous with zero gaps — if one ends at 18:30, the next starts at 18:30 exactly.
- When shifting events, preserve their durations. Shift rather than shrink
- Verify no events overlap before responding

## Calendar Context
- Calendar: ${context.calendarName}
- Date range: ${context.dateRange}

## Events (${context.events.length} events)
\`\`\`json
${eventsJson}
\`\`\`${categoryContext ? buildCategoryContextBlock(categoryContext) : ""}`;
}
