import { extractDisplayName, generateZettelId, isFolderNote, withFrontmatter } from "@real1ty-obsidian-plugins";
import { nanoid } from "nanoid";
import type { TFile } from "obsidian";
import { type App } from "obsidian";

const ZETTEL_ID_PATTERN = /[-\s](\d{14})$/;
const PHYSICAL_INSTANCE_PATTERN = /^(.+)\s+(\d{4}-\d{2}-\d{2})-(\d{14})$/;

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
	return (
		text
			// Strip Zettel ID format with hyphen (14 digits)
			.replace(/-\d{14}$/, "")
			// Strip space-separated Zettel ID (14 digits)
			.replace(/\s+\d{14}$/, "")
			.trim()
	);
};

/**
 * Removes the instance date from recurring event titles.
 * Pattern: "Name YYYY-MM-DD" -> "Name"
 * This is used on mobile to save space.
 */
export const removeInstanceDate = (text: string): string => {
	return (
		text
			// Strip date format at the end (YYYY-MM-DD)
			.replace(/\s+\d{4}-\d{2}-\d{2}$/, "")
			.trim()
	);
};

/**
 * Cleans up event title by removing both ZettelID and recurring instance date.
 * Useful for displaying clean titles in tooltips and UI.
 */
export const cleanupTitle = (text: string): string => {
	return removeInstanceDate(removeZettelId(text));
};

/**
 * Extracts a display name from a file path or wiki link and cleans it up
 * by removing ZettelID and recurring instance date suffixes.
 */
export const extractCleanDisplayName = (pathOrLink: string): string => {
	return cleanupTitle(extractDisplayName(pathOrLink));
};

/**
 * Gets the event name from the title property, calendar title property, or the filename.
 * Priority: titleProp (user-controlled) > calendarTitleProp (auto-computed wiki link) > filename derived from filePath.
 *
 * `titleProp` wins because it reflects an explicit user choice ("use this
 * frontmatter key as the visible name"). `calendarTitleProp` is an
 * auto-regenerated back-link — useful as a default when titleProp is empty or
 * unpopulated, but it should never override what the user typed.
 */
export const getEventName = (
	titleProp: string | undefined,
	frontmatter: Record<string, unknown>,
	filePath: string | null | undefined,
	calendarTitleProp?: string
): string | undefined => {
	if (titleProp && frontmatter[titleProp]) {
		return frontmatter[titleProp] as string;
	}

	if (calendarTitleProp && frontmatter[calendarTitleProp]) {
		return extractDisplayName(String(frontmatter[calendarTitleProp]));
	}

	if (filePath) {
		const basename = filePath.split("/").pop()?.replace(/\.md$/, "") ?? "";
		return basename ? cleanupTitle(basename) : undefined;
	}

	return undefined;
};

/**
 * Extracts the core name from a note title by removing timestamps, dates, and day suffixes.
 * This groups related events together by their base name for aggregation and display.
 *
 * Handles multiple formats:
 * - Zettel ID format (14 digits): "Event-20250203140530" -> "Event"
 * - Space-separated timestamps: "Event 20250203140530" -> "Event"
 * - ISO date formats: "Event - 2025-02-03" -> "Event"
 * - ISO date suffix: "Go To The Gym 2025-10-29" -> "Go To The Gym"
 * - Kebab-case date suffix: "mid-sprint-sync-2025-10-28" -> "mid-sprint-sync"
 * - Day names: "Thai Box Tue" -> "Thai Box", "Meeting Monday" -> "Meeting"
 * - Trailing timestamps: "Event 123456789" -> "Event"
 */
export const extractNotesCoreName = (text: string): string => {
	return (
		text
			// Strip Zettel ID format with hyphen (14 digits)
			.replace(/-\d{14}$/, "")
			// Strip space-separated Zettel ID (14 digits)
			.replace(/\s+\d{14}$/, "")
			// Strip ISO date formats with dash separator " - YYYY-MM-DD"
			.replace(/\s+-\s+\d{4}-\d{2}-\d{2}.*$/, "")
			// Strip ISO date formats at the end " YYYY-MM-DD"
			.replace(/\s+\d{4}-\d{2}-\d{2}$/, "")
			// Strip kebab-case date suffix "-YYYY-MM-DD"
			.replace(/-\d{4}-\d{2}-\d{2}$/, "")
			// Strip day abbreviations (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
			.replace(/\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i, "")
			// Strip full day names (Monday, Tuesday, etc.)
			.replace(/\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i, "")
			// Strip trailing timestamps (8+ digits)
			.replace(/\s+\d{8,}$/, "")
			.trim()
	);
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
		hash = hash & hash; // Convert to 32-bit integer
	}

	// Ensure positive number and pad to 14 digits
	const positiveHash = Math.abs(hash);
	// Take modulo to ensure it fits in 14 digits, then pad
	const normalized = positiveHash % 100000000000000; // Max 14-digit number
	return normalized.toString().padStart(14, "0");
};

/**
 * Generates a unique ZettelID by checking if the resulting path already exists.
 * If it does, increments the ID until an unused one is found.
 */
export const generateUniqueZettelId = (app: App, basePath: string, baseNameWithoutZettel: string): string => {
	let zettelIdStr = String(generateZettelId());
	let attempts = 0;
	const maxAttempts = 1000;

	while (attempts < maxAttempts) {
		const testPath = `${basePath}${baseNameWithoutZettel}-${zettelIdStr}.md`;
		const existing = app.vault.getAbstractFileByPath(testPath);

		if (!existing) {
			return zettelIdStr;
		}

		// Increment the zettelId (it's a 14-digit number as a string)
		const numericId = Number.parseInt(zettelIdStr, 10);
		const incrementedId = numericId + 1;
		zettelIdStr = incrementedId.toString().padStart(14, "0");
		attempts++;
	}

	// Fallback: use timestamp with random suffix
	return `${String(generateZettelId())}${Math.floor(Math.random() * 1000)}`;
};

/**
 * Generates a unique file path with ZettelID for event files.
 * If the basename already contains a Prisma ZettelID, uses it as-is without adding a new one.
 * Returns both the filename and full path with a guaranteed unique ZettelID.
 */
export const generateUniqueEventPath = (
	app: App,
	directory: string,
	baseName: string
): { filename: string; fullPath: string; zettelId: string } => {
	const basePath = directory ? `${directory.replace(/\/+$/, "")}/` : "";

	if (hasTimestamp(baseName)) {
		const existingZettelId = extractZettelId(baseName);
		if (!existingZettelId) {
			throw new Error(
				"Prisma ZettelID not found in basename, but hasTimestamp returned true, this should never happen. Please create an issue."
			);
		}
		const fullPath = `${basePath}${baseName}.md`;
		// If no file exists at this path, use it as-is
		if (!app.vault.getAbstractFileByPath(fullPath)) {
			return { filename: baseName, fullPath, zettelId: existingZettelId };
		}
		// Collision: strip the existing timestamp and generate a new unique one
		const strippedName = removeZettelId(baseName);
		const zettelId = generateUniqueZettelId(app, basePath, strippedName);
		const filename = `${strippedName}-${zettelId}`;
		return { filename, fullPath: `${basePath}${filename}.md`, zettelId };
	}

	const zettelId = generateUniqueZettelId(app, basePath, baseName);
	const filename = `${baseName}-${zettelId}`;
	const fullPath = `${basePath}${filename}.md`;

	return { filename, fullPath, zettelId };
};

/**
 * Ensures a file has a ZettelID embedded in both its filename and frontmatter.
 * If the file already has a ZettelID, returns it. If not, generates one and embeds it.
 * Returns the ZettelID and the potentially updated file path.
 */
export const ensureFileHasZettelId = async (
	app: App,
	file: TFile,
	zettelIdProp?: string
): Promise<{ zettelId: string; file: TFile }> => {
	const existingZettelId = extractZettelId(file.basename);

	if (existingZettelId) {
		// File already has ZettelID, just ensure it's in frontmatter
		if (zettelIdProp) {
			await withFrontmatter(app, file, (fm) => {
				if (!fm[zettelIdProp]) {
					fm[zettelIdProp] = existingZettelId;
				}
			});
		}
		return { zettelId: existingZettelId, file };
	}

	// Folder notes must not be renamed — it would break the folder structure
	if (isFolderNote(file.path)) return { zettelId: "", file };

	// File doesn't have ZettelID, we need to add it
	const baseNameWithoutZettel = file.basename;
	const directory = file.parent?.path || "";
	const { fullPath, zettelId } = generateUniqueEventPath(app, directory, baseNameWithoutZettel);

	await app.fileManager.renameFile(file, fullPath);

	// Update frontmatter with ZettelID
	if (zettelIdProp) {
		await withFrontmatter(app, file, (fm) => {
			fm[zettelIdProp] = zettelId;
		});
	}

	return { zettelId, file };
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
