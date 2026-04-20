export const SETTINGS_TRANSFER_DEFAULT_FILENAME = "plugin-settings.json";

export interface SettingsTransferOptions {
	/** Top-level keys that must never leave the plugin instance. Filtered during both export and import. */
	nonTransferableKeys?: ReadonlySet<string> | ReadonlyArray<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

function toBlockSet(keys: SettingsTransferOptions["nonTransferableKeys"]): Set<string> {
	return new Set(keys ?? []);
}

/**
 * Recursively coerce `incoming` to match the structural shape of `template`.
 * Missing or wrong-typed fields fall back to the template.
 *
 * Arrays are treated as homogeneous; `template[0]` defines the item shape.
 */
function coerceToShape(template: unknown, incoming: unknown): unknown {
	if (Array.isArray(template)) {
		if (!Array.isArray(incoming)) return template;
		const itemTemplate = template[0];
		if (itemTemplate === undefined) return [...incoming];
		return incoming.map((item) => coerceToShape(itemTemplate, item));
	}

	if (isRecord(template)) {
		if (!isRecord(incoming)) return template;
		const out: Record<string, unknown> = {};
		const allKeys = new Set([...Object.keys(template), ...Object.keys(incoming)]);
		for (const key of allKeys) {
			if (key in incoming) {
				out[key] = key in template ? coerceToShape(template[key], incoming[key]) : incoming[key];
			} else {
				out[key] = template[key];
			}
		}
		return out;
	}

	if (template === undefined) {
		return incoming;
	}

	if (incoming !== undefined && typeof incoming === typeof template) {
		return incoming;
	}

	return template;
}

export function createTransferableSettingsSnapshot<T extends Record<string, unknown>>(
	settings: T,
	defaults: T,
	opts?: SettingsTransferOptions
): Record<string, unknown> {
	const block = toBlockSet(opts?.nonTransferableKeys);
	const out: Record<string, unknown> = {};
	const allKeys = new Set([...Object.keys(defaults), ...Object.keys(settings)]);
	for (const key of allKeys) {
		if (block.has(key)) continue;
		out[key] = coerceToShape(defaults[key], settings[key]);
	}
	return out;
}

export function applyTransferredSettings<T extends Record<string, unknown>>(
	current: T,
	transferData: unknown,
	defaults: T,
	opts?: SettingsTransferOptions
): T {
	if (!isRecord(transferData)) {
		throw new Error("Settings import must be a JSON object.");
	}
	const block = toBlockSet(opts?.nonTransferableKeys);
	const defaultsSnapshot = createTransferableSettingsSnapshot(defaults, defaults, opts);
	const merged = coerceToShape(defaultsSnapshot, transferData) as Record<string, unknown>;
	const next = { ...current } as Record<string, unknown>;
	for (const key of Object.keys(merged)) {
		if (block.has(key)) continue;
		next[key] = merged[key];
	}
	return next as T;
}
