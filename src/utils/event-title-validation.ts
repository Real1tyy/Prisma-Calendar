// Obsidian / cross-OS filename-illegal characters. The event's title is
// the basis of its filename (plus an optional ZettelID suffix), so titles
// that would produce an invalid filename must be rejected at the modal
// save layer before the plugin tries to persist.
//
// Set matches the union used by `sanitizeFilenamePreserveSpaces` in shared:
//   < > : " / \ | ? *
// Any one of these in the title makes the filename unsafe on Windows and
// on every other OS treats `/` and `\` as path separators.
export const ILLEGAL_TITLE_CHARS = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"] as const;

export type EventTitleValidationResult = { ok: true } | { ok: false; illegalChars: string[]; message: string };

/**
 * Validate a user-typed event title for characters that would produce an
 * invalid filename. The modal save path calls this and surfaces a user
 * notice on failure; the backing file is never written.
 */
export function validateEventTitle(title: string): EventTitleValidationResult {
	const trimmed = title.trim();
	if (trimmed.length === 0) return { ok: true };

	const hits = new Set<string>();
	for (const ch of ILLEGAL_TITLE_CHARS) {
		if (trimmed.includes(ch)) hits.add(ch);
	}
	if (hits.size === 0) return { ok: true };

	const illegalChars = [...hits];
	const list = illegalChars.map((c) => `"${c}"`).join(", ");
	const pronoun = illegalChars.length === 1 ? "this character" : "these characters";
	return {
		ok: false,
		illegalChars,
		message: `Event title cannot contain ${list}. Please remove ${pronoun} and try again.`,
	};
}
