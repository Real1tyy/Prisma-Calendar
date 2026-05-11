import type { Frontmatter, SingleCalendarConfig } from "../../types";
import { PROP_CLASSIFICATIONS } from "../../types/event-metadata";

const CONFIGURABLE_PROP_KEYS = PROP_CLASSIFICATIONS.map((entry) => entry.settingsProp);

/**
 * Rewrite frontmatter keys so they match the destination calendar's schema.
 *
 * For each configurable settings prop (start/end/date/title/category/etc.) the
 * source calendar advertises a frontmatter key — say `Start Date` — and the
 * destination might use a different key — say `Begin`. When the names differ
 * and the source key is present, we move the value to the destination key and
 * delete the old key. Keys that aren't tracked by the schema (custom user
 * props, body-only metadata) are left alone.
 *
 * Returns a fresh object — the input is never mutated.
 */
export function translateFrontmatterToCalendar(
	fm: Frontmatter,
	from: SingleCalendarConfig,
	to: SingleCalendarConfig
): Frontmatter {
	const result: Frontmatter = { ...fm };

	for (const settingsKey of CONFIGURABLE_PROP_KEYS) {
		const fromName = from[settingsKey];
		const toName = to[settingsKey];

		if (typeof fromName !== "string" || fromName === "") continue;
		if (typeof toName !== "string" || toName === "") continue;
		if (fromName === toName) continue;
		if (!(fromName in result)) continue;

		result[toName] = result[fromName];
		delete result[fromName];
	}

	return result;
}
