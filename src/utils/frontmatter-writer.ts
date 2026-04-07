import type { Frontmatter, SingleCalendarConfig } from "../types";
import type { EventEditableFields } from "../types/event-fields";
import { assignListToFrontmatter, parseCustomDoneProperty } from "./event-frontmatter";

export interface WriteMetadataOptions {
	initialMarkAsDone?: boolean;
	prerequisites?: string[];
}

export function setStringProp(fm: Frontmatter, prop: string, value: string | undefined): void {
	const trimmed = (value ?? "").trim();
	if (trimmed) {
		fm[prop] = trimmed;
	} else {
		delete fm[prop];
	}
}

export function setBooleanProp(fm: Frontmatter, prop: string, value: boolean): void {
	if (value) {
		fm[prop] = true;
	} else {
		delete fm[prop];
	}
}

export function setNumericProp(fm: Frontmatter, prop: string, value: number): void {
	if (value > 0) {
		fm[prop] = value;
	} else {
		delete fm[prop];
	}
}

function setListProp(fm: Frontmatter, prop: string, items: string[], filter?: (item: string) => boolean): void {
	const filtered = filter ? items.filter(filter) : items;
	assignListToFrontmatter(fm, prop, filtered);
}

function writeMarkAsDone(
	fm: Frontmatter,
	settings: SingleCalendarConfig,
	markAsDone: boolean,
	initialMarkAsDone?: boolean
): void {
	const shouldToggle = initialMarkAsDone === undefined || initialMarkAsDone !== markAsDone;
	if (!shouldToggle) return;

	const customDoneProp = parseCustomDoneProperty(settings.customDoneProperty);

	if (customDoneProp) {
		if (markAsDone) {
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
		fm[settings.statusProperty] = markAsDone ? settings.doneValue : settings.notDoneValue;
	}
}

export function writeMetadataToFrontmatter(
	fm: Frontmatter,
	settings: SingleCalendarConfig,
	fields: Partial<EventEditableFields>,
	options: WriteMetadataOptions = {}
): void {
	if (fields.categories !== undefined && settings.categoryProp) {
		setListProp(fm, settings.categoryProp, fields.categories);
	}

	if (options.prerequisites !== undefined && settings.prerequisiteProp) {
		setListProp(fm, settings.prerequisiteProp, options.prerequisites);
	}

	if (fields.participants !== undefined && settings.participantsProp) {
		setListProp(fm, settings.participantsProp, fields.participants, (p) => Boolean(p.trim()));
	}

	if ("location" in fields && settings.locationProp) {
		setStringProp(fm, settings.locationProp, fields.location);
	}

	if ("icon" in fields && settings.iconProp) {
		setStringProp(fm, settings.iconProp, fields.icon);
	}

	if ("breakMinutes" in fields && settings.breakProp) {
		setNumericProp(fm, settings.breakProp, fields.breakMinutes ?? 0);
	}

	if (fields.markAsDone !== undefined && settings.statusProperty) {
		writeMarkAsDone(fm, settings, fields.markAsDone, options.initialMarkAsDone);
	}

	if (fields.skip !== undefined && settings.skipProp) {
		setBooleanProp(fm, settings.skipProp, fields.skip);
	}
}
