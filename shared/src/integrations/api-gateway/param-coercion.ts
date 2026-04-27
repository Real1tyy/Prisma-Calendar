/**
 * Lightweight helpers for coercing URL query string values (always strings)
 * into typed values. Each method returns `undefined` when the key is missing.
 * Use the `required` namespace for variants that throw on missing keys.
 */
export const ParamCoercion = {
	/** Returns the string value, or `undefined` if the key is absent. */
	string(raw: Record<string, string>, key: string): string | undefined {
		return raw[key];
	},

	/** Parses a boolean from `"true"` / `"false"` / `"1"` / `"0"`. */
	boolean(raw: Record<string, string>, key: string): boolean | undefined {
		const val = raw[key];
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- val can be undefined at runtime (noUncheckedIndexedAccess disabled)
		if (val === undefined) return undefined;
		return val === "true" || val === "1";
	},

	/** Parses a number. Returns `undefined` if absent or `NaN`. */
	number(raw: Record<string, string>, key: string): number | undefined {
		const val = raw[key];
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- val can be undefined at runtime (noUncheckedIndexedAccess disabled)
		if (val === undefined) return undefined;
		const num = Number(val);
		return Number.isNaN(num) ? undefined : num;
	},

	/** Splits a comma-separated string into a string array. */
	stringArray(raw: Record<string, string>, key: string): string[] | undefined {
		const val = raw[key];
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- val can be undefined at runtime (noUncheckedIndexedAccess disabled)
		if (val === undefined) return undefined;
		return val
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	},

	/** Variants that throw when the key is missing. */
	required: {
		string(raw: Record<string, string>, key: string): string {
			const val = raw[key];
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- val can be undefined at runtime (noUncheckedIndexedAccess disabled)
			if (val === undefined) throw new Error(`Missing required URL parameter: ${key}`);
			return val;
		},

		boolean(raw: Record<string, string>, key: string): boolean {
			const val = raw[key];
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- val can be undefined at runtime (noUncheckedIndexedAccess disabled)
			if (val === undefined) throw new Error(`Missing required URL parameter: ${key}`);
			return val === "true" || val === "1";
		},

		number(raw: Record<string, string>, key: string): number {
			const val = raw[key];
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- val can be undefined at runtime (noUncheckedIndexedAccess disabled)
			if (val === undefined) throw new Error(`Missing required URL parameter: ${key}`);
			const num = Number(val);
			if (Number.isNaN(num)) throw new Error(`URL parameter "${key}" is not a valid number: ${val}`);
			return num;
		},

		stringArray(raw: Record<string, string>, key: string): string[] {
			const val = raw[key];
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- val can be undefined at runtime (noUncheckedIndexedAccess disabled)
			if (val === undefined) throw new Error(`Missing required URL parameter: ${key}`);
			return val
				.split(",")
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
		},
	},
} as const;
