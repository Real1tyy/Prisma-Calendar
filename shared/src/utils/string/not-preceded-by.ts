/**
 * A negative lookbehind without the syntax. iOS before 16.4 cannot parse `(?<!…)`:
 * a regex literal holding one is a syntax error for the whole bundle, and a
 * `new RegExp` throws where it is built (obsidianmd/regex-lookbehind).
 *
 * `refuse` sees the character before a match ("" at the start of the text) and the
 * match itself. A refused match is retried one character later — what the engine
 * does when a leading lookbehind fails — so the matches are exactly those of
 * `(?<!…)pattern`.
 */
export type RefusePrecedingChar = (preceding: string, match: RegExpExecArray) => boolean;

export function* matchesNotPrecededBy(
	text: string,
	pattern: RegExp,
	refuse: RefusePrecedingChar
): Generator<RegExpExecArray> {
	const scanner = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
	let match: RegExpExecArray | null;
	while ((match = scanner.exec(text)) !== null) {
		const preceding = match.index > 0 ? text[match.index - 1] : "";
		if (refuse(preceding, match)) {
			scanner.lastIndex = match.index + 1;
			continue;
		}
		if (match[0] === "") scanner.lastIndex++;
		yield match;
	}
}

export function replaceNotPrecededBy(
	text: string,
	pattern: RegExp,
	refuse: RefusePrecedingChar,
	replacer: (match: RegExpExecArray) => string
): string {
	let result = "";
	let copiedUpTo = 0;
	for (const match of matchesNotPrecededBy(text, pattern, refuse)) {
		result += text.slice(copiedUpTo, match.index) + replacer(match);
		copiedUpTo = match.index + match[0].length;
	}
	return result + text.slice(copiedUpTo);
}

/** A `refuse` for the common case: the preceding character is in `chars`. */
export function precededByAnyOf(chars: RegExp): RefusePrecedingChar {
	return (preceding) => preceding !== "" && chars.test(preceding);
}
