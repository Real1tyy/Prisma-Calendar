import { ensureISOSuffix } from "@real1ty-obsidian-plugins";

import {
	applyDateFieldsToFrontmatter,
	applyNotificationToFrontmatter,
	applyRecurringFieldsToFrontmatter,
} from "../../components/modals/event/event-frontmatter-mapper";
import type { Frontmatter } from "../../types";
import type { EventSaveData } from "../../types/event-boundaries";
import { FormToFieldsSchema } from "../../types/event-boundaries";
import type { SingleCalendarConfig } from "../../types/settings";
import { writeMetadataToFrontmatter } from "../../utils/frontmatter/writer";
import { isWeekdaySupported } from "../../utils/dates/recurring";
import type { EventFormValues } from "./event-form";

export function buildEventSaveData(
	formValues: EventFormValues,
	settings: SingleCalendarConfig,
	originalFrontmatter: Frontmatter,
	originalCustomPropertyKeys: Set<string>,
	isReadOnly: boolean
): EventSaveData {
	const { formState, customProperties } = formValues;
	const fm = { ...originalFrontmatter };

	if (formState.title && settings.titleProp) {
		fm[settings.titleProp] = formState.title;
	}

	let start = "";
	let end: string | null = null;
	let isUntracked = false;

	if (formState.allDay) {
		if (formState.date) {
			start = `${formState.date}T00:00:00`;
			end = `${formState.date}T23:59:59`;
		} else {
			isUntracked = true;
		}
	} else if (formState.start) {
		start = ensureISOSuffix(formState.start);
		end = formState.end ? ensureISOSuffix(formState.end) : null;
	} else {
		isUntracked = true;
	}

	const dateData = {
		title: formState.title,
		start,
		allDay: formState.allDay,
		isUntracked,
		...(end !== null ? { end } : {}),
	};

	applyDateFieldsToFrontmatter(fm, settings, dateData);

	const parsed = FormToFieldsSchema.parse({
		location: formState.location,
		icon: formState.icon,
		breakMinutes: formState.breakMinutes,
		markAsDone: formState.markAsDone,
		skip: formState.skip,
	});

	writeMetadataToFrontmatter(
		fm,
		settings,
		{
			...parsed,
			categories: formState.categories,
			participants: formState.participants,
		},
		{
			initialMarkAsDone: formValues.initialMarkAsDoneState,
			prerequisites: formState.prerequisites,
		}
	);

	applyNotificationToFrontmatter(
		fm,
		settings,
		formState.notifyBefore,
		formState.allDay,
		!isUntracked && settings.skipNewlyCreatedNotifications && !isReadOnly,
		start
	);

	const selectedWeekdays: string[] = [];
	if (formState.recurring.enabled && isWeekdaySupported(formState.recurring.rruleType)) {
		selectedWeekdays.push(...formState.recurring.weekdays);
	}

	applyRecurringFieldsToFrontmatter(
		fm,
		originalFrontmatter,
		settings,
		{
			enabled: formState.recurring.enabled,
			rruleType: formState.recurring.rruleType,
			weekdays: selectedWeekdays,
			untilDate: formState.recurring.untilDate,
			futureInstancesCount: formState.recurring.futureInstancesCount,
			generatePastEvents: formState.recurring.generatePastEvents,
		},
		isUntracked
	);

	const currentCustomKeys = new Set(Object.keys(customProperties));
	for (const [key, value] of Object.entries(customProperties)) {
		fm[key] = value;
	}
	for (const originalKey of originalCustomPropertyKeys) {
		if (!currentCustomKeys.has(originalKey)) {
			delete fm[originalKey];
		}
	}

	return {
		filePath: null,
		title: formState.title,
		start,
		end,
		allDay: isUntracked ? false : formState.allDay,
		virtual: formState.virtual,
		preservedFrontmatter: fm,
	};
}
