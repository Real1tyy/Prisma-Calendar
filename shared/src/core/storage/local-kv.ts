import type { ZodType } from "zod";

/**
 * Tiny synchronous key-value interface — both `window.localStorage` and an
 * in-memory stand-in for tests satisfy it. Narrower than the DOM `Storage`
 * interface on purpose: we only need these three operations, so anything
 * matching the shape works without pulling in lib.dom for non-browser test
 * harnesses.
 */
export interface KVBackend {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface LocalKVOptions<T> {
	/**
	 * Prefix applied to every key. Pick something unique-per-purpose so
	 * entries from one feature can't collide with another and so the
	 * adapter's entries stand out when inspecting devtools. Convention:
	 * `"<plugin-id>:<feature>:<purpose>"`.
	 */
	namespace: string;
	/**
	 * Zod schema used to validate values on read. A corrupt or schema-
	 * incompatible entry is treated as "absent" — the caller sees `null`
	 * and is expected to fall back to a default. This tolerates entries
	 * written by older builds without wedging sync on unrecognised shapes.
	 */
	schema: ZodType<T>;
	/**
	 * Back-end override. Omit in production (falls through to
	 * `window.localStorage`); tests inject an in-memory stand-in.
	 */
	backend?: KVBackend;
}

function resolveBackend(override: KVBackend | undefined): KVBackend {
	if (override) return override;
	// In-browser usage. Plugin renderer always has `window.localStorage`;
	// headless test envs either pass `backend` explicitly or run in jsdom,
	// which provides a compatible stub.
	return window.localStorage;
}

/**
 * Device-local, schema-validated key-value store.
 *
 * Intended for small bits of per-device state the vault shouldn't replicate —
 * server cursors (e.g. CalDAV sync-tokens), UI-view preferences a user might
 * want to diverge per machine, one-off analytics toggles. Do NOT use for
 * anything that should roam with the vault (settings, user data) — that is
 * what `data.json` / the settings store is for.
 *
 * The Zod schema is the source of truth for the stored shape: on read, a
 * value that fails validation is returned as `null` so the caller can choose
 * how to recover (usually by re-initialising from scratch).
 */
export class LocalKV<T> {
	private readonly backend: KVBackend;

	constructor(private readonly options: LocalKVOptions<T>) {
		this.backend = resolveBackend(options.backend);
	}

	private keyFor(scope: string): string {
		return `${this.options.namespace}:${scope}`;
	}

	get(scope: string): T | null {
		const raw = this.backend.getItem(this.keyFor(scope));
		if (raw === null) return null;
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return null;
		}
		const result = this.options.schema.safeParse(parsed);
		return result.success ? result.data : null;
	}

	set(scope: string, value: T): void {
		this.backend.setItem(this.keyFor(scope), JSON.stringify(value));
	}

	delete(scope: string): void {
		this.backend.removeItem(this.keyFor(scope));
	}

	/**
	 * Shallow-merge a partial patch onto the current value, preserving any
	 * prior fields the patch doesn't mention. An explicit `undefined` in the
	 * patch deletes that field (JSON would otherwise drop `undefined` and
	 * leave the prior value intact, which is the opposite of call-site
	 * intent). If nothing is stored yet, the patch is applied on top of an
	 * empty object and written as the initial value.
	 */
	merge(scope: string, patch: Partial<T>): void {
		const current = this.get(scope) ?? ({} as T);
		const merged: T = { ...current, ...patch } as T;
		for (const key of Object.keys(patch) as Array<keyof T>) {
			if (patch[key] === undefined) {
				delete (merged as Record<string, unknown>)[key as string];
			}
		}
		this.set(scope, merged);
	}
}
