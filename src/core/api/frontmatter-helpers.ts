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

	if (settings.categoryProp && input.categories) {
		assignListToFrontmatter(frontmatter, settings.categoryProp, input.categories);
	} else if (settings.categoryProp && input.title) {
		const availableCategories = bundle.categoryTracker.getCategories();
		const autoAssigned = autoAssignCategories(input.title, settings, availableCategories);
		if (autoAssigned.length > 0) {
			assignListToFrontmatter(frontmatter, settings.categoryProp, autoAssigned);
		}
	}

	if (settings.locationProp && input.location !== undefined) {
		if (input.location.trim()) {
			frontmatter[settings.locationProp] = input.location.trim();
		} else {
			delete frontmatter[settings.locationProp];
		}
	}

	if (settings.participantsProp && input.participants) {
		assignListToFrontmatter(frontmatter, settings.participantsProp, input.participants);
	}

	if (settings.skipProp && input.skip !== undefined) {
		if (input.skip) {
			frontmatter[settings.skipProp] = true;
		} else {
			delete frontmatter[settings.skipProp];
		}
	}

	if (settings.statusProperty && input.markAsDone !== undefined) {
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

	return frontmatter;
}

export function patchEditFrontmatter(
	frontmatter: Frontmatter,
	settings: CalendarBundle["settingsStore"]["currentSettings"],
	bundle: CalendarBundle,
	input: PrismaEditEventInput
): void {
	// Patch date fields only if provided
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

	// Patch metadata fields only if provided
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

	// Merge any extra frontmatter properties
	if (input.frontmatter) {
		Object.assign(frontmatter, input.frontmatter);
	}
}
