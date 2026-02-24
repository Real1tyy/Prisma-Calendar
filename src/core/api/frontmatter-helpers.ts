import type { Frontmatter } from "../../types";
import {
	assignListToFrontmatter,
	parseCustomDoneProperty,
	setEventBasics,
	setUntrackedEventBasics,
} from "../../utils/event-frontmatter";
import { autoAssignCategories } from "../../utils/event-matching";
import { ensureISOSuffix } from "../../utils/format";
import type { CalendarBundle } from "../calendar-bundle";
import type { PrismaEditEventInput, PrismaEventInput } from "./types";

function applyMetadataFields(
	frontmatter: Frontmatter,
	settings: CalendarBundle["settingsStore"]["currentSettings"],
	bundle: CalendarBundle,
	input: PrismaEventInput
): void {
	if (input.categories !== undefined && settings.categoryProp) {
		assignListToFrontmatter(frontmatter, settings.categoryProp, input.categories);
	} else if (input.title !== undefined && settings.categoryProp && !input.categories) {
		const availableCategories = bundle.categoryTracker.getCategories();
		const autoAssigned = autoAssignCategories(input.title, settings, availableCategories);
		if (autoAssigned.length > 0) {
			assignListToFrontmatter(frontmatter, settings.categoryProp, autoAssigned);
		}
	}

	if (input.location !== undefined && settings.locationProp) {
		if (input.location.trim()) {
			frontmatter[settings.locationProp] = input.location.trim();
		} else {
			delete frontmatter[settings.locationProp];
		}
	}

	if (input.participants !== undefined && settings.participantsProp) {
		assignListToFrontmatter(frontmatter, settings.participantsProp, input.participants);
	}

	if (input.skip !== undefined && settings.skipProp) {
		if (input.skip) {
			frontmatter[settings.skipProp] = true;
		} else {
			delete frontmatter[settings.skipProp];
		}
	}

	if (input.markAsDone !== undefined && settings.statusProperty) {
		const customDoneProp = parseCustomDoneProperty(settings.customDoneProperty);
		const customUndoneProp = parseCustomDoneProperty(settings.customUndoneProperty);
		if (customDoneProp) {
			if (input.markAsDone) {
				frontmatter[customDoneProp.key] = customDoneProp.value;
			} else if (customUndoneProp) {
				frontmatter[customUndoneProp.key] = customUndoneProp.value;
			} else {
				delete frontmatter[customDoneProp.key];
			}
		} else {
			frontmatter[settings.statusProperty] = input.markAsDone ? settings.doneValue : settings.notDoneValue;
		}
	}
}

export function buildFrontmatterFromInput(bundle: CalendarBundle, input: PrismaEventInput): Frontmatter {
	const settings = bundle.settingsStore.currentSettings;
	const frontmatter: Frontmatter = {
		...(input.frontmatter ?? {}),
	};

	const hasTrackedDateData = Boolean(input.start);

	if (hasTrackedDateData) {
		const allDay = input.allDay === true;
		const normalizedStart = ensureISOSuffix(input.start!);
		const end = allDay ? undefined : input.end ? ensureISOSuffix(input.end) : undefined;
		setEventBasics(frontmatter, settings, {
			title: input.title,
			start: normalizedStart,
			end,
			allDay,
		});
	} else {
		setUntrackedEventBasics(frontmatter, settings);
	}

	applyMetadataFields(frontmatter, settings, bundle, input);

	return frontmatter;
}

export function patchEditFrontmatter(
	frontmatter: Frontmatter,
	settings: CalendarBundle["settingsStore"]["currentSettings"],
	bundle: CalendarBundle,
	input: PrismaEditEventInput
): void {
	if (input.start !== undefined) {
		const allDay = input.allDay ?? frontmatter[settings.allDayProp] === true;
		if (allDay) {
			frontmatter[settings.dateProp] = input.start.split("T")[0];
			delete frontmatter[settings.startProp];
		} else {
			frontmatter[settings.startProp] = ensureISOSuffix(input.start);
			delete frontmatter[settings.dateProp];
		}
	}
	if (input.end !== undefined) {
		frontmatter[settings.endProp] = ensureISOSuffix(input.end);
	}
	if (input.allDay !== undefined) {
		frontmatter[settings.allDayProp] = input.allDay;
	}

	applyMetadataFields(frontmatter, settings, bundle, input);

	if (input.frontmatter) {
		Object.assign(frontmatter, input.frontmatter);
	}
}
