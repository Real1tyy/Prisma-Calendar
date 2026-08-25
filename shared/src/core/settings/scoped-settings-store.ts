import { BehaviorSubject, type Subscription } from "rxjs";

import { deepEqualJsonLike } from "../../utils/deep-equal";

export interface ScopedParentStorelike<TParent> {
	settings$: BehaviorSubject<TParent>;
	updateSettings: (updater: (settings: TParent) => TParent) => Promise<void>;
}

export interface SettingsLens<TParent, TScoped> {
	get: (parent: TParent) => TScoped | undefined;
	set: (parent: TParent, scoped: TScoped) => TParent;
}

/**
 * Lens over one element of an `{ id }`-keyed array field on the parent settings
 * object — the canonical shape for settings-array top-level primitives
 * (Prisma's planning systems, Core-Finance's accounts).
 * See [[decision-shared-plugin-framework-prisma-is-the-pilot-core-finance-follows]].
 */
export function arrayElementLens<TParent, TItem extends { id: string }>(
	key: { [K in keyof TParent]: TParent[K] extends TItem[] ? K : never }[keyof TParent],
	id: string
): SettingsLens<TParent, TItem> {
	return {
		get: (parent) => (parent[key] as TItem[]).find((item) => item.id === id),
		set: (parent, scoped) => ({
			...parent,
			[key]: (parent[key] as TItem[]).map((item) => (item.id === id ? scoped : item)),
		}),
	};
}

/**
 * Projects a parent `SettingsStore` onto one scoped slice through a lens,
 * exposing the same `SettingsStorelike` contract (`settings$` +
 * `updateSettings`) — so schema-driven settings UI binds to a single array
 * element exactly as it would to a whole store. Writes go through the parent
 * (single source of truth); external parent emissions propagate down only when
 * the scoped slice actually changed.
 *
 * When the scoped element disappears from the parent (e.g. deleted), the store
 * keeps its last snapshot and stops emitting — consumers are expected to be
 * torn down by whatever removed the element.
 */
export class ScopedSettingsStore<TParent, TScoped> {
	public readonly settings$: BehaviorSubject<TScoped>;
	public currentSettings: TScoped;
	private subscription: Subscription | null;

	constructor(
		public readonly parentStore: ScopedParentStorelike<TParent>,
		private readonly lens: SettingsLens<TParent, TScoped>
	) {
		const initial = lens.get(parentStore.settings$.value);
		if (initial === undefined) {
			throw new Error("Scoped settings element not found in parent settings");
		}
		this.currentSettings = initial;
		this.settings$ = new BehaviorSubject<TScoped>(initial);

		this.subscription = parentStore.settings$.subscribe((parent) => {
			const scoped = this.lens.get(parent);
			if (scoped !== undefined && !deepEqualJsonLike(scoped, this.currentSettings)) {
				this.currentSettings = scoped;
				this.settings$.next(scoped);
			}
		});
	}

	async updateSettings(updater: (settings: TScoped) => TScoped): Promise<void> {
		const next = updater(this.currentSettings);
		await this.parentStore.updateSettings((parent) => this.lens.set(parent, next));
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.settings$.complete();
	}
}
