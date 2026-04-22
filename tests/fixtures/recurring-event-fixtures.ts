import { DateTime } from "luxon";
import { BehaviorSubject, Subject } from "rxjs";
import { vi } from "vitest";

import type { RecurringEventManager } from "../../src/core/recurring-event-manager";
import type { EventMetadata } from "../../src/types/event-metadata";
import type { Weekday } from "../../src/types/recurring";
import { createDefaultMetadata } from "./event-fixtures";

export type RecurringManagerApp = {
	vault: Record<string, ReturnType<typeof vi.fn>>;
	metadataCache: Record<string, ReturnType<typeof vi.fn>>;
	fileManager: Record<string, ReturnType<typeof vi.fn>>;
	plugins: { plugins: Record<string, unknown> };
};

export const RECURRING_MANAGER_SETTINGS = {
	id: "default",
	name: "Main Calendar",
	enabled: true,
	directory: "Calendar",
	startProp: "Start Date",
	endProp: "End Date",
	allDayProp: "All Day",
	rruleProp: "RRule",
	rruleSpecProp: "RRuleSpec",
	rruleUntilProp: "RRuleUntil",
	rruleIdProp: "RRuleID",
	instanceDateProp: "Recurring Instance Date",
	futureInstancesCount: 2,
};

export function createRecurringManagerApp(): RecurringManagerApp {
	return {
		vault: {
			getMarkdownFiles: vi.fn(() => []),
			create: vi.fn().mockResolvedValue({ path: "", basename: "" }),
			getAbstractFileByPath: vi.fn(() => null),
			cachedRead: vi.fn().mockResolvedValue(""),
			createFolder: vi.fn().mockResolvedValue(undefined),
			getAbstractFileByPathInsensitive: vi.fn(() => null),
		},
		metadataCache: { getFileCache: vi.fn(() => null) },
		fileManager: { processFrontMatter: vi.fn().mockResolvedValue({}) },
		plugins: { plugins: {} },
	};
}

export function createRecurringIndexer() {
	return {
		events$: new Subject(),
		indexingComplete$: new BehaviorSubject(true),
	};
}

export function createRecurringSettingsStore(overrides: Partial<typeof RECURRING_MANAGER_SETTINGS> = {}) {
	return {
		value: { ...RECURRING_MANAGER_SETTINGS, ...overrides },
		subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
	};
}

export interface RecurringEventOverrides {
	rRuleId?: string;
	title?: string;
	skip?: boolean;
	type?: "daily" | "weekly" | "monthly" | "yearly";
	startISO?: string;
	endISO?: string;
	untilISO?: string;
	futureInstancesCount?: number;
	metadata?: Partial<EventMetadata>;
}

export function buildRecurringEvent(overrides: RecurringEventOverrides = {}) {
	const {
		rRuleId = "test-rrule",
		title = "Team Meeting",
		skip = false,
		type = "weekly",
		startISO = "2024-01-01T10:00:00",
		endISO = "2024-01-01T11:00:00",
		untilISO,
		futureInstancesCount = 2,
		metadata = {},
	} = overrides;

	return {
		rRuleId,
		title,
		rrules: {
			type,
			allDay: false,
			weekdays: [] as Weekday[],
			...(untilISO ? { until: DateTime.fromISO(untilISO) } : {}),
			startTime: DateTime.fromISO(startISO),
			endTime: DateTime.fromISO(endISO),
		},
		frontmatter: {
			"Start Date": `${startISO}.000Z`,
			...(untilISO ? { RRuleUntil: untilISO } : {}),
		},
		futureInstancesCount,
		sourceFilePath: `${rRuleId}.md`,
		metadata: createDefaultMetadata({
			skip,
			...(untilISO ? { rruleUntil: DateTime.fromISO(untilISO) } : {}),
			...metadata,
		}),
		content: "",
	};
}

export async function registerRecurringEvent(
	manager: RecurringEventManager,
	event: ReturnType<typeof buildRecurringEvent>
) {
	await (manager as any).handleIndexerEvent({
		type: "recurring-event-found",
		filePath: event.sourceFilePath,
		recurringEvent: event,
	});
}
