import { ensureISOSuffix, toSafeString } from "@real1ty/obsidian-plugins";

import type { Frontmatter } from "../../types";
import { buildEventSchemaInput, resolveTemporalKind } from "../../types/event-schemas";
import { autoAssignCategories } from "../../utils/events/matching";
import { setEventBasics, setUntrackedEventBasics } from "../../utils/frontmatter/basics";
import { assignListToFrontmatter, parseCustomDoneProperty } from "../../utils/frontmatter/props";
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
		const autoAssigned = autoAssignCategories(input.title, settings, availableCategories, bundle.plugin.isProEnabled);
		if (autoAssigned.length > 0) {
			assignListToFrontmatter(frontmatter, settings.categoryProp, autoAssigned);
		}
	}

	if (input.location !== undefined && settings.locationProp) {
		if (input.location.trim()) {
			frontmatter[settings.locationProp] = input.location.trim();
		} else {
			Reflect.deleteProperty(frontmatter, settings.locationProp);
		}
	}

	if (input.participants !== undefined && settings.participantsProp) {
		assignListToFrontmatter(frontmatter, settings.participantsProp, input.participants);
	}

	if (input.skip !== undefined && settings.skipProp) {
		if (input.skip) {
			frontmatter[settings.skipProp] = true;
		} else {
			Reflect.deleteProperty(frontmatter, settings.skipProp);
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
				Reflect.deleteProperty(frontmatter, customDoneProp.key);
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

	if (input.start) {
		const allDay = input.allDay === true;
		const normalizedStart = ensureISOSuffix(input.start);
		const end = input.end ? ensureISOSuffix(input.end) : undefined;
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
	const allDay =
		input.allDay ??
		resolveTemporalKind(buildEventSchemaInput({ filePath: "", folder: "", frontmatter }, settings)) === "allDay";
	if (allDay && (input.start !== undefined || input.end !== undefined || input.allDay !== undefined)) {
		setEventBasics(frontmatter, settings, {
			start: input.start ?? toSafeString(frontmatter[settings.dateProp] || frontmatter[settings.startProp]) ?? "",
			end: input.end ?? toSafeString(frontmatter[settings.endDayProp]) ?? undefined,
			allDay: true,
		});
	} else if (!allDay) {
		if (input.start !== undefined) {
			frontmatter[settings.startProp] = ensureISOSuffix(input.start);
			Reflect.deleteProperty(frontmatter, settings.dateProp);
		}
		if (input.end !== undefined) frontmatter[settings.endProp] = ensureISOSuffix(input.end);
		if (input.allDay === false) Reflect.deleteProperty(frontmatter, settings.endDayProp);
	}
	if (input.allDay !== undefined) {
		frontmatter[settings.allDayProp] = input.allDay;
	}

	applyMetadataFields(frontmatter, settings, bundle, input);

	if (input.frontmatter) {
		Object.assign(frontmatter, input.frontmatter);
	}
}
