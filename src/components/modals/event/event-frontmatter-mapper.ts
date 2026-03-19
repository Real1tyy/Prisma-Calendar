import { parseIntoList } from "@real1ty-obsidian-plugins";
import { z } from "zod";

import type { Frontmatter } from "../../../types";
import type { SingleCalendarConfig } from "../../../types/settings";
import {
	parseCustomDoneProperty,
	setEventBasics,
	setMappedListProp,
	setMappedNumberProp,
	setMappedTextProp,
	setUntrackedEventBasics,
} from "../../../utils/event-frontmatter";
import { SimpleEditableFieldsSchema } from "./event-form-state";

export const SimpleFieldValuesSchema = SimpleEditableFieldsSchema.extend({
	notifyBefore: z.string().default("").describe("Notification lead time"),
});

export type SimpleFieldValues = z.infer<typeof SimpleFieldValuesSchema>;

export function loadSimpleFieldValues(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig
): Partial<SimpleFieldValues> {
	const values: Partial<SimpleFieldValues> = {};

	if (settings.locationProp) {
		const v = frontmatter[settings.locationProp];
		values.location = typeof v === "string" ? v : "";
	}

	if (settings.iconProp) {
		const v = frontmatter[settings.iconProp];
		values.icon = typeof v === "string" ? v : "";
	}

	if (settings.participantsProp) {
		values.participants = parseIntoList(frontmatter[settings.participantsProp]).join(", ");
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

export function loadPrerequisites(frontmatter: Frontmatter, settings: SingleCalendarConfig): string[] {
	if (!settings.prerequisiteProp) return [];
	return parseIntoList(frontmatter[settings.prerequisiteProp], { splitCommas: false }).filter((p) => p.trim());
}

export const SaveSimpleFieldsInputSchema = SimpleEditableFieldsSchema.partial().extend({
	initialMarkAsDone: z.boolean(),
	categories: z.array(z.string()),
	prerequisites: z.array(z.string()),
});

export type SaveSimpleFieldsInput = z.input<typeof SaveSimpleFieldsInputSchema>;

export function applySimpleFieldsToFrontmatter(
	fm: Frontmatter,
	original: Frontmatter,
	settings: SingleCalendarConfig,
	input: SaveSimpleFieldsInput
): void {
	setMappedListProp(fm, settings.categoryProp, input.categories);
	setMappedListProp(fm, settings.prerequisiteProp, input.prerequisites);

	if (settings.participantsProp && input.participants !== undefined) {
		const list = parseIntoList(input.participants).filter((p) => p.trim());
		setMappedListProp(fm, settings.participantsProp, list);
	}

	setMappedTextProp(fm, original, settings.locationProp, input.location);
	setMappedTextProp(fm, original, settings.iconProp, input.icon);
	setMappedNumberProp(fm, settings.breakProp, input.breakMinutes, { parser: "float", minValue: 0.01 });

	if (settings.statusProperty && input.markAsDone !== undefined) {
		const wasChecked = input.initialMarkAsDone;
		const isNowChecked = input.markAsDone;

		if (wasChecked !== isNowChecked) {
			const customDoneProp = parseCustomDoneProperty(settings.customDoneProperty);

			if (customDoneProp) {
				if (isNowChecked) {
					fm[customDoneProp.key] = customDoneProp.value;
				} else {
					const customUndoneProp = parseCustomDoneProperty(settings.customUndoneProperty);
					if (customUndoneProp) {
						fm[customUndoneProp.key] = customUndoneProp.value;
					} else {
						delete fm[customDoneProp.key];
					}
				}
			} else {
				fm[settings.statusProperty] = isNowChecked ? settings.doneValue : settings.notDoneValue;
			}
		}
	}

	if (settings.skipProp) {
		if (input.skip) {
			fm[settings.skipProp] = true;
		} else {
			delete fm[settings.skipProp];
		}
	}
}

export const RecurringFieldsInputSchema = z.object({
	enabled: z.boolean(),
	rruleType: z.string(),
	weekdays: z.array(z.string()),
	customIntervalDSL: z.string().optional(),
	futureInstancesCount: z.string().optional(),
	generatePastEvents: z.boolean(),
});

export type RecurringFieldsInput = z.infer<typeof RecurringFieldsInputSchema>;

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

		setMappedNumberProp(fm, settings.futureInstancesCountProp, input.futureInstancesCount, { minValue: 1 });

		if (input.generatePastEvents) {
			fm[settings.generatePastEventsProp] = true;
		} else {
			delete fm[settings.generatePastEventsProp];
		}
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

	const parsed = Number.parseInt(notifyValue, 10);
	if (!Number.isNaN(parsed) && parsed >= 0) {
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
