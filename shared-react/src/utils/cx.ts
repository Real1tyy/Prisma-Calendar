type ClassValue = string | false | 0 | null | undefined;

/**
 * Concatenate truthy class names with a single space. Returns `undefined` when
 * the result would be empty so callers can pass it directly to `className=`
 * without producing a stray empty-string attribute.
 */
export function cx(...classes: ClassValue[]): string | undefined {
	let out = "";
	for (const cls of classes) {
		if (!cls) continue;
		out = out === "" ? cls : `${out} ${cls}`;
	}
	return out === "" ? undefined : out;
}
