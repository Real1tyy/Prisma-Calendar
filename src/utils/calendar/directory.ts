/**
 * True when `filePath` lives inside a calendar's indexed `directory`.
 *
 * Compares on a trailing separator, so a calendar rooted at `Tasks` does not
 * claim `TasksArchive/Note.md` — a bare `startsWith(directory)` treats any
 * sibling folder sharing the prefix as its own. An empty directory means the
 * calendar indexes the whole vault.
 *
 * `directory` is stored slash-free (`normalizeDirectory` trims both ends), so
 * no normalisation is needed here.
 */
export function isPathInCalendarDirectory(filePath: string, directory: string): boolean {
	if (!directory) return true;
	return filePath.startsWith(`${directory}/`);
}
