import { nanoid } from "nanoid";

// Optional trailing `.md` lets callers pass a full file path
// (`Events/Foo-20250101000000.md`) or a bare basename/title — the ID anchor is
// the 14 digits, not end-of-string.
export const ZETTEL_ID_PATTERN = /[-\s](\d{14})(?:\.md)?$/;
export const PHYSICAL_INSTANCE_PATTERN = /^(.+)\s+(\d{4}-\d{2}-\d{2})-(\d{14})$/;

/**
 * Extracts ZettelID from a filename or title.
 * Handles plugin-generated filename patterns:
 * - Regular:            "Title-ZETTELID"              (e.g., Meeting-20250203140530)
 * - Recurring instance: "Title YYYY-MM-DD-ZETTELID"   (e.g., Meeting 2025-02-03-00001125853328)
 * Also supports legacy formats for backwards compatibility:
 * - Space-dash-space:   "Title - ZETTELID"            (e.g., Updated Meeting - 20250203140530)
 * - Space-separated:    "Title ZETTELID"              (e.g., Workout 20250203140530)
 * Returns the ZettelID string if found, null otherwise.
 */
export const extractZettelId = (text: string): string | null => {
	const match = text.match(ZETTEL_ID_PATTERN);
	return match ? match[1] : null;
};

export const removeZettelId = (text: string): string => {
	return text
		.replace(/-\d{14}$/, "")
		.replace(/\s+\d{14}$/, "")
		.trim();
};

/**
 * Checks if a basename already has a Prisma ZettelID timestamp.
 * Handles plugin-generated patterns:
 * - Regular:            "Title-ZETTELID"              (e.g., Meeting-20250203140530)
 * - Recurring instance: "Title YYYY-MM-DD-ZETTELID"   (e.g., Meeting 2025-02-03-00001125853328)
 * Also supports legacy formats (CalDAV ` - ` separator, space-separated) for backwards compatibility.
 */
export const hasTimestamp = (baseName: string): boolean => {
	return ZETTEL_ID_PATTERN.test(baseName);
};

export const generateUniqueRruleId = (): string => {
	return `${Date.now()}-${nanoid(5)}`;
};

/**
 * Converts an rRuleId into a deterministic 14-digit number for use as a zettel ID suffix.
 * This ensures physical instances have stable, predictable filenames based on (rRuleId, date).
 */
export const hashRRuleIdToZettelFormat = (rRuleId: string): string => {
	let hash = 0;
	for (let i = 0; i < rRuleId.length; i++) {
		const char = rRuleId.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash;
	}

	const positiveHash = Math.abs(hash);
	const normalized = positiveHash % 100000000000000;
	return normalized.toString().padStart(14, "0");
};

/**
 * Extracts the instance date from a physical recurring instance filename.
 * Pattern: "Title YYYY-MM-DD-ZETTELID" -> "YYYY-MM-DD"
 * Returns null if the basename doesn't match the physical instance pattern.
 */
export const extractInstanceDate = (basename: string): string | null => {
	const match = basename.match(PHYSICAL_INSTANCE_PATTERN);
	return match ? match[2] : null;
};

/**
 * Rebuilds a physical recurring instance filename with a new date.
 * Format: "Title YYYY-MM-DD-ZETTELID" -> "Title NEW-DATE-ZETTELID"
 *
 * @param basename - Current filename without extension (e.g., "Meeting 2025-01-15-12345678901234")
 * @param newDate - New date string in YYYY-MM-DD format
 * @returns New basename or null if the format is not recognized
 */
export const rebuildPhysicalInstanceWithNewDate = (basename: string, newDate: string): string | null => {
	const match = basename.match(PHYSICAL_INSTANCE_PATTERN);
	if (!match) return null;

	const [, title, , zettelId] = match;
	return `${title} ${newDate}-${zettelId}`;
};
