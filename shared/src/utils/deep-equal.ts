/**
 * Structural equality for **JSON-like** data: primitives (including `NaN`),
 * arrays, plain objects, and `Date` values. Designed for comparing settings,
 * frontmatter, and other state that round-trips through JSON or a Zod schema.
 *
 * Supported:
 * - Primitives, with `NaN === NaN` treated as equal.
 * - Nested arrays and plain objects, compared structurally (key-order agnostic).
 * - `Date`, compared by `getTime()`.
 *
 * NOT supported (do not use this for general-purpose deep equality):
 * - Cyclic references — will recurse until the stack blows. JSON-like data is
 *   acyclic by construction, so this is fine for the intended domain.
 * - `Set`, `Map`, `RegExp`, `TypedArray`, `ArrayBuffer`, `Error`, boxed
 *   primitives, class instances, symbol-keyed or non-enumerable properties.
 *   These values never appear in schemas we compare (Zod output + YAML
 *   frontmatter), so baking in half-correct support for them was a footgun.
 *
 * If you need general JavaScript deep equality, prefer:
 * - `node:util` → `isDeepStrictEqual` (built-in, handles the full zoo).
 * - `lodash.isEqual` (universal, broadest coverage).
 * - `fast-deep-equal` (tiny, has an `es6` entrypoint for `Map`/`Set`/typed arrays).
 */
export function deepEqualJsonLike(a: unknown, b: unknown): boolean {
	if (a === b) return true;

	if (typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b)) {
		return true;
	}

	if (a === null || b === null || a === undefined || b === undefined) {
		return a === b;
	}

	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;

	if (a instanceof Date && b instanceof Date) {
		return a.getTime() === b.getTime();
	}

	if (Array.isArray(a) !== Array.isArray(b)) return false;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((val, idx) => deepEqualJsonLike(val, b[idx]));
	}

	// Only plain objects are in domain. Sets/Maps/RegExps/TypedArrays expose no
	// own-enumerable properties, so falling through would falsely report them as
	// "equal empty objects". Reject anything whose prototype isn't Object.prototype
	// or null — callers that need those types should reach for node:util
	// `isDeepStrictEqual` or `lodash.isEqual`.
	if (!isPlainObject(a) || !isPlainObject(b)) return false;

	const objA = a as Record<string, unknown>;
	const objB = b as Record<string, unknown>;
	const keysA = Object.keys(objA);
	const keysB = Object.keys(objB);

	if (keysA.length !== keysB.length) return false;

	return keysA.every((key) => key in objB && deepEqualJsonLike(objA[key], objB[key]));
}

function isPlainObject(value: unknown): boolean {
	if (value === null || typeof value !== "object") return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}
