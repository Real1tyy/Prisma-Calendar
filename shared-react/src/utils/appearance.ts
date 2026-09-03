import type { CSSProperties } from "react";

import { setOrDelete } from "./string-record";

/**
 * The visual axes every customizable surface — tab pills, page-header actions,
 * context-menu items — lets a user override. Adding a new axis here (and to the
 * key maps below) is the whole change: persistence, resolution, the manager's
 * colour controls, and the reset buttons are all driven off these tables.
 */
export const APPEARANCE_AXES = ["icon", "color", "textColor", "backgroundColor"] as const;
export type AppearanceAxis = (typeof APPEARANCE_AXES)[number];

/** The colour axes — every axis but `icon`, which is picked rather than tinted. */
export const APPEARANCE_COLOR_AXES = ["color", "textColor", "backgroundColor"] as const;
export type AppearanceColorAxis = (typeof APPEARANCE_COLOR_AXES)[number];

/**
 * One item's visual attributes as the render boundary sees them — user override
 * where present, the definition's own default otherwise. A definition
 * (`TabDefinition`, `HeaderActionDefinition`, …) is structurally an `Appearance`,
 * so it can be passed anywhere defaults are wanted.
 */
export type Appearance = { [Axis in AppearanceAxis]?: string | undefined };

/** Per-axis override records — the runtime shape every store keeps in memory. */
export type AppearanceOverrides = Record<AppearanceAxis, Record<string, string>>;

/** The `Map`-backed equivalent, for stores whose snapshots are maps. */
export type AppearanceOverrideMaps = Record<AppearanceAxis, Map<string, string>>;

/** Maps each axis onto the settings key its overrides persist under. */
export type AppearanceKeyMap = Readonly<Record<AppearanceAxis, string>>;

/**
 * The persisted key per axis. Flat and unchanged since the first release — this
 * indirection is what lets every consumer stay axis-generic without asking users
 * to migrate their settings.
 */
export const APPEARANCE_KEYS = {
	icon: "iconOverrides",
	color: "colorOverrides",
	textColor: "textColorOverrides",
	backgroundColor: "backgroundColorOverrides",
} as const satisfies AppearanceKeyMap;

/** The same map for a tab group's per-child overrides, which nest under `groupState`. */
export const CHILD_APPEARANCE_KEYS = {
	icon: "childIconOverrides",
	color: "childColorOverrides",
	textColor: "childTextColorOverrides",
	backgroundColor: "childBackgroundColorOverrides",
} as const satisfies AppearanceKeyMap;

/**
 * The colour the picker persists when the user never actually chose one. Surfaces
 * that opt into {@link stripDefaultColors} treat it as "no colour" rather than
 * painting everything black.
 */
export const DEFAULT_COLOR_SENTINEL = "#000000";

type PersistedState = Readonly<Record<string, unknown>>;

/**
 * Build one value per axis. Spelling the axes out is deliberate: it makes the set
 * exhaustive, so adding an axis to {@link APPEARANCE_AXES} stops compiling here and
 * the compiler walks you to every table that needs the new entry — where
 * `Object.fromEntries` plus a cast would have silently produced a record with a
 * missing key.
 */
function byAxis<T>(valueFor: (axis: AppearanceAxis) => T): Record<AppearanceAxis, T> {
	return {
		icon: valueFor("icon"),
		color: valueFor("color"),
		textColor: valueFor("textColor"),
		backgroundColor: valueFor("backgroundColor"),
	};
}

/**
 * Persisted axis records have already been validated by the settings schema
 * (`CustomizableUIBaseStateSchema`), which is what guarantees string values. This
 * only re-checks the shape, so a hand-edited settings file handing us an array or
 * a scalar degrades to "no overrides" instead of throwing at render time.
 */
function isStringRecord(value: unknown): value is Record<string, string> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord(state: PersistedState | undefined, key: string): Record<string, string> {
	const value = state?.[key];
	return isStringRecord(value) ? { ...value } : {};
}

/** Every axis mapped to an empty override record. */
export function emptyAppearanceOverrides(): AppearanceOverrides {
	return byAxis((): Record<string, string> => ({}));
}

/** Read each axis's overrides out of persisted state, defaulting absent axes to empty. */
export function loadAppearanceOverrides(
	state: PersistedState | undefined,
	keys: AppearanceKeyMap = APPEARANCE_KEYS
): AppearanceOverrides {
	return byAxis((axis) => readRecord(state, keys[axis]));
}

/** The `Map`-backed counterpart of {@link loadAppearanceOverrides}. */
export function loadAppearanceOverrideMaps(
	state: PersistedState | undefined,
	keys: AppearanceKeyMap = APPEARANCE_KEYS
): AppearanceOverrideMaps {
	return byAxis((axis) => new Map(Object.entries(readRecord(state, keys[axis]))));
}

/**
 * Copy each non-empty axis onto a state object under its persisted key. Returns
 * whether anything was written, so callers can tell an all-default entry from one
 * worth serializing.
 */
export function writeAppearanceOverrides(
	target: object,
	overrides: AppearanceOverrides,
	keys: AppearanceKeyMap = APPEARANCE_KEYS
): boolean {
	let wrote = false;
	for (const axis of APPEARANCE_AXES) {
		const record = overrides[axis];
		if (Object.keys(record).length === 0) continue;
		Object.assign(target, { [keys[axis]]: { ...record } });
		wrote = true;
	}
	return wrote;
}

/** The `Map`-backed counterpart of {@link writeAppearanceOverrides}. */
export function writeAppearanceOverrideMaps(
	target: object,
	maps: Readonly<Record<AppearanceAxis, ReadonlyMap<string, string>>>,
	keys: AppearanceKeyMap = APPEARANCE_KEYS
): boolean {
	let wrote = false;
	for (const axis of APPEARANCE_AXES) {
		const map = maps[axis];
		if (map.size === 0) continue;
		Object.assign(target, { [keys[axis]]: Object.fromEntries(map) });
		wrote = true;
	}
	return wrote;
}

/**
 * Resolve one item's appearance: override where set, definition default otherwise.
 * An icon override of the empty string is a deliberate "no icon" and survives —
 * only an absent key falls back.
 */
export function resolveAppearance(defaults: Appearance, overrides: AppearanceOverrides, id: string): Appearance {
	return byAxis((axis) => overrides[axis][id] ?? defaults[axis]);
}

/** The `Map`-backed counterpart of {@link resolveAppearance}. */
export function resolveAppearanceFromMaps(
	defaults: Appearance,
	maps: Readonly<Record<AppearanceAxis, ReadonlyMap<string, string>>>,
	id: string
): Appearance {
	return byAxis((axis) => maps[axis].get(id) ?? defaults[axis]);
}

/** Which axes currently carry a user override for this item — drives the reset buttons. */
export type AppearanceOverridden = Record<AppearanceAxis, boolean>;

export function appearanceOverridden(overrides: AppearanceOverrides, id: string): AppearanceOverridden {
	return byAxis((axis) => id in overrides[axis]);
}

/** The `Map`-backed counterpart of {@link appearanceOverridden}. */
export function appearanceOverriddenFromMaps(
	maps: Readonly<Record<AppearanceAxis, ReadonlyMap<string, string>>>,
	id: string
): AppearanceOverridden {
	return byAxis((axis) => maps[axis].has(id));
}

/**
 * `undefined` clears the override; so does a value equal to the item's own
 * default, which would otherwise pin it against a future default change. Both
 * setters return `null` when nothing would change, letting stores skip a notify.
 * An empty-string icon only equals the default when the item genuinely has none,
 * so the deliberate "no icon" choice survives.
 */
export function setAppearanceOverride(
	overrides: AppearanceOverrides,
	axis: AppearanceAxis,
	id: string,
	value: string | undefined,
	defaults?: Appearance
): AppearanceOverrides | null {
	const record = overrides[axis];
	if (value === undefined || defaults?.[axis] === value) {
		if (!(id in record)) return null;
		return { ...overrides, [axis]: setOrDelete(record, id, undefined) };
	}
	if (record[id] === value) return null;
	return { ...overrides, [axis]: setOrDelete(record, id, value) };
}

/** The `Map`-backed counterpart of {@link setAppearanceOverride}. */
export function setAppearanceOverrideMap(
	maps: AppearanceOverrideMaps,
	axis: AppearanceAxis,
	id: string,
	value: string | undefined,
	defaults?: Appearance
): AppearanceOverrideMaps | null {
	const map = maps[axis];
	const next = new Map(map);
	if (value === undefined || defaults?.[axis] === value) {
		if (!map.has(id)) return null;
		next.delete(id);
	} else {
		if (map.get(id) === value) return null;
		next.set(id, value);
	}
	return { ...maps, [axis]: next };
}

/** A colour the user actually picked — `undefined` for the picker's untouched value. */
function pickedColor(color: string | undefined): string | undefined {
	return color === DEFAULT_COLOR_SENTINEL ? undefined : color;
}

/**
 * Blank out colour axes still holding the picker's untouched-black sentinel, so a
 * surface that opts in renders them unstyled instead of painting everything black.
 * The icon axis passes through — it holds an icon id, never a colour.
 */
export function stripDefaultColors(appearance: Appearance): Appearance {
	const stripped: Record<AppearanceAxis, string | undefined> = {
		icon: appearance.icon,
		color: pickedColor(appearance.color),
		textColor: pickedColor(appearance.textColor),
		backgroundColor: pickedColor(appearance.backgroundColor),
	};
	return stripped;
}

/**
 * Which CSS property each colour axis paints. `color` and `textColor` both land on
 * CSS `color` — the axis says which *element* the caller applies the style to (the
 * icon span vs. the label), not which property.
 */
const CSS_PROPERTY: Record<AppearanceColorAxis, "color" | "backgroundColor"> = {
	color: "color",
	textColor: "color",
	backgroundColor: "backgroundColor",
};

/**
 * Inline style for the given colour axes — `undefined` when none carries a value,
 * so the element stays unstyled rather than picking up an empty `style` attribute.
 */
export function appearanceStyle(
	appearance: Appearance,
	...axes: readonly AppearanceColorAxis[]
): CSSProperties | undefined {
	const style: CSSProperties = {};
	for (const axis of axes) {
		const value = appearance[axis];
		if (!value) continue;
		if (CSS_PROPERTY[axis] === "backgroundColor") style.backgroundColor = value;
		else style.color = value;
	}
	return Object.keys(style).length > 0 ? style : undefined;
}
