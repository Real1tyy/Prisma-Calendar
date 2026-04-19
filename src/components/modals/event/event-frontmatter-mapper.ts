import type { Frontmatter } from "../../../types";
import type { EventEditableFormFields } from "../../../types/event-fields";
import { NonNegativeInt, PositiveInt } from "../../../types/event-fields";
import type { SingleCalendarConfig } from "../../../types/settings";
import { setEventBasics, setUntrackedEventBasics } from "../../../utils/frontmatter/basics";
import { setBooleanProp } from "../../../utils/frontmatter-writer";

export function loadSimpleFieldValues(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig
): Partial<EventEditableFormFields> {
	const values: Partial<EventEditableFormFields> = {};

	if (settings.locationProp) {
		const v = frontmatter[settings.locationProp];
		values.location = typeof v === "string" ? v : "";
	}

	if (settings.iconProp) {
		const v = frontmatter[settings.iconProp];
		values.icon = typeof v === "string" ? v : "";
	}

	if (settings.breakProp) {
		const v = frontmatter[settings.breakProp];
		values.breakMinutes = typeof v === "number" && v > 0 ? v.toString() : "";
	}

	if (settings.statusProperty) {
		const v = frontmatter[settings.statusProperty];
		values.markAsDone = v === settings.doneValue;
	}

	if (settings.skipProp) {
		values.skip = frontmatter[settings.skipProp] === true;
	}

	if (settings.enableNotifications) {
		const isAllDay = frontmatter[settings.allDayProp] === true;
		const propName = isAllDay ? settings.daysBeforeProp : settings.minutesBeforeProp;
		const v = frontmatter[propName];
		values.notifyBefore = typeof v === "number" && v >= 0 ? v.toString() : "";
	}

	return values;
}

export interface RecurringFieldsInput {
	enabled: boolean;
	rruleType: string;
	weekdays: string[];
	customIntervalDSL?: string;
	futureInstancesCount?: string;
	generatePastEvents: boolean;
}

export function applyRecurringFieldsToFrontmatter(
	fm: Frontmatter,
	original: Frontmatter,
	settings: SingleCalendarConfig,
	input: RecurringFieldsInput,
	isUntracked: boolean
): void {
	if (!isUntracked && input.enabled) {
		fm[settings.rruleProp] = input.rruleType;

		if (input.weekdays.length > 0) {
			fm[settings.rruleSpecProp] = input.weekdays.join(", ");
		} else {
			delete fm[settings.rruleSpecProp];
		}

		const futureCount = PositiveInt.parse(input.futureInstancesCount ?? "");
		if (futureCount !== undefined) {
			fm[settings.futureInstancesCountProp] = futureCount;
		} else {
			delete fm[settings.futureInstancesCountProp];
		}

		setBooleanProp(fm, settings.generatePastEventsProp, input.generatePastEvents);
	} else if (original[settings.rruleProp]) {
		delete fm[settings.rruleProp];
		delete fm[settings.rruleSpecProp];
		delete fm[settings.rruleIdProp];
		delete fm[settings.futureInstancesCountProp];
		delete fm[settings.generatePastEventsProp];
	}
}

export function applyNotificationToFrontmatter(
	fm: Frontmatter,
	settings: SingleCalendarConfig,
	notifyValue: string | undefined,
	isAllDay: boolean,
	skipNewlyCreated: boolean,
	start: string
): void {
	if (notifyValue === undefined) return;

	const parsed = NonNegativeInt.parse(notifyValue);
	if (parsed !== undefined) {
		if (isAllDay) {
			fm[settings.daysBeforeProp] = parsed;
			delete fm[settings.minutesBeforeProp];
		} else {
			fm[settings.minutesBeforeProp] = parsed;
			delete fm[settings.daysBeforeProp];
		}
	} else {
		delete fm[settings.minutesBeforeProp];
		delete fm[settings.daysBeforeProp];
	}

	if (settings.enableNotifications && skipNewlyCreated && start) {
		const startDate = new Date(start);
		const oneMinuteFromNow = new Date(Date.now() + 60000);
		if (startDate < oneMinuteFromNow) {
			fm[settings.alreadyNotifiedProp] = true;
		}
	}
}

export function applyDateFieldsToFrontmatter(
	fm: Frontmatter,
	settings: SingleCalendarConfig,
	data: { title: string; start: string; end?: string; allDay: boolean; isUntracked: boolean }
): void {
	if (data.isUntracked) {
		setUntrackedEventBasics(fm, settings);
	} else {
		setEventBasics(fm, settings, {
			title: data.title,
			start: data.start,
			end: data.end,
			allDay: data.allDay,
		});
	}
}
