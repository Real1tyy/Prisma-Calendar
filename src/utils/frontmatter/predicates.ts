import { parseAsLocalDate, toSafeString } from "@real1ty-obsidian-plugins";

import type { Frontmatter, SingleCalendarConfig } from "../../types";

export const isAllDayFrontmatterValue = (allDayValue: unknown): boolean => {
	return allDayValue === true || (typeof allDayValue === "string" && allDayValue.toLowerCase() === "true");
};

/**
 * Decides whether a file-change observer should auto-mark an event as done.
 *
 * CRITICAL PROTECTION: Don't mark source recurring events as done.
 * Source recurring events (identified by the presence of rruleProp) are templates
 * that generate virtual and physical instances. Marking them as done would:
 * 1. Break the recurring event system
 * 2. Prevent generation of future instances
 * 3. Cause all instances to appear as "done" since they inherit from the source
 */
export const shouldEventBeMarkedAsDone = (frontmatter: Frontmatter, settings: SingleCalendarConfig): boolean => {
	if (!settings.markPastInstancesAsDone) return false;
	if (frontmatter[settings.rruleProp]) return false;
	if (frontmatter[settings.statusProperty] === settings.doneValue) return false;
	return isEventPastFromFrontmatter(frontmatter, settings);
};

const frontmatterValueAsLocalDate = (value: unknown): Date | null => {
	const raw = toSafeString(value);
	return raw ? parseAsLocalDate(raw) : null;
};

/**
 * Returns true when the event represented by the given frontmatter is entirely in the past.
 * All-day events use end-of-day on the Date property; timed events use the End property.
 */
export const isEventPastFromFrontmatter = (frontmatter: Frontmatter, settings: SingleCalendarConfig): boolean => {
	const isAllDay = isAllDayFrontmatterValue(frontmatter[settings.allDayProp]);
	const date = frontmatterValueAsLocalDate(frontmatter[isAllDay ? settings.dateProp : settings.endProp]);
	if (!date) return false;
	if (isAllDay) date.setHours(23, 59, 59, 999);
	return date < new Date();
};

/**
 * Checks if an event is a physical recurring event (has rruleId and instanceDate, but no rrule).
 */
export const isPhysicalRecurringEvent = (
	frontmatter: Frontmatter | undefined,
	rruleIdProp: string,
	rruleProp: string,
	instanceDateProp: string
): boolean => {
	if (!frontmatter) return false;
	return Boolean(frontmatter[rruleIdProp] && frontmatter[instanceDateProp] && !frontmatter[rruleProp]);
};
