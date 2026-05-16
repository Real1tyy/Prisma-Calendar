/**
 * Template-literal path types for typed dotted-path access into a settings shape.
 *
 * `Paths<T>` enumerates every legal dotted path through `T`. `PathValue<T, P>`
 * resolves the value type at a given path. Together they let a hook accept
 * `useSettingsField(store, "holidays.enabled")` with compile-time path
 * checking and value-type inference — no manual `<V>` annotation needed.
 *
 * Recursion is capped via a depth counter so deeply nested schemas don't blow
 * out TypeScript's instantiation budget. The default cap is 6 levels;
 * settings shapes in this monorepo nest 2–3 deep.
 */

type Decrement = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

type IsRecord<T> =
	T extends Array<unknown>
		? false
		: T extends ReadonlyArray<unknown>
			? false
			: T extends Date
				? false
				: T extends Map<unknown, unknown>
					? false
					: T extends Set<unknown>
						? false
						: T extends (...args: never[]) => unknown
							? false
							: T extends object
								? true
								: false;

/**
 * Every legal dotted path through `T`, including intermediate object paths.
 *
 * For `{ a: number; b: { c: string } }` produces:
 *   `"a" | "b" | "b.c"`
 */
export type Paths<T, Depth extends number = 6> = Depth extends 0
	? never
	: T extends object
		? {
				[K in keyof T & string]: IsRecord<T[K]> extends true
					? K | `${K}.${Paths<NonNullable<T[K]>, Decrement[Depth]> & string}`
					: K;
			}[keyof T & string]
		: never;

/**
 * Resolve the value type at a dotted path `P` within `T`.
 *
 * For `{ a: number; b: { c: string } }`:
 *   `PathValue<T, "a">`     → `number`
 *   `PathValue<T, "b">`     → `{ c: string }`
 *   `PathValue<T, "b.c">`   → `string`
 */
export type PathValue<T, P extends string> = P extends `${infer Head}.${infer Rest}`
	? Head extends keyof T
		? PathValue<NonNullable<T[Head]>, Rest>
		: never
	: P extends keyof T
		? T[P]
		: never;
