import type { Observable, Subscription } from "rxjs";

import type { VaultRow, VaultTableEvent } from "./types";

/**
 * Base class for reactive grouped indices over a VaultTableView.
 * Maintains a Map<K, Map<id, VaultRow>> that updates automatically as the source emits events.
 * Uses Map per group for O(1) add/remove instead of array-based O(n) filter on every removal.
 * Subclasses define how rows map to group keys (1:1 vs 1:many).
 */
abstract class BaseReactiveGroupBy<TData, K> {
	protected readonly groups = new Map<K, Map<string, VaultRow<TData>>>();
	private subscription: Subscription | null = null;

	constructor(sourceEvents$: Observable<VaultTableEvent<TData>>) {
		this.subscription = sourceEvents$.subscribe((event) => {
			switch (event.type) {
				case "row-created":
					this.addRow(event.row);
					break;
				case "row-updated":
					this.removeRow(event.id);
					this.addRow(event.newRow);
					break;
				case "row-deleted":
					this.removeRow(event.id);
					break;
			}
		});
	}

	/** Populates the groups from initial rows. Called by subclass constructors after keyFn is assigned. */
	protected populate(rows: ReadonlyArray<VaultRow<TData>>): void {
		for (const row of rows) {
			this.addRow(row);
		}
	}

	/** Returns the current grouped map */
	getGroups(): ReadonlyMap<K, ReadonlyArray<VaultRow<TData>>> {
		const result = new Map<K, ReadonlyArray<VaultRow<TData>>>();
		for (const [key, map] of this.groups) {
			result.set(key, Array.from(map.values()));
		}
		return result;
	}

	/** Returns rows for a specific group key */
	getGroup(key: K): ReadonlyArray<VaultRow<TData>> {
		const group = this.groups.get(key);
		return group ? Array.from(group.values()) : [];
	}

	/** Returns all unique group keys */
	getKeys(): K[] {
		return Array.from(this.groups.keys());
	}

	/** Returns groups with 2+ members */
	getMultiMemberGroups(): Map<K, VaultRow<TData>[]> {
		const result = new Map<K, VaultRow<TData>[]>();
		for (const [key, map] of this.groups) {
			if (map.size >= 2) result.set(key, Array.from(map.values()));
		}
		return result;
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.groups.clear();
		this.onDestroy();
	}

	protected addToGroup(key: K, row: VaultRow<TData>): void {
		let group = this.groups.get(key);
		if (!group) {
			group = new Map();
			this.groups.set(key, group);
		}
		group.set(row.id, row);
	}

	protected removeFromGroup(key: K, id: string): void {
		const group = this.groups.get(key);
		if (!group) return;
		group.delete(id);
		if (group.size === 0) {
			this.groups.delete(key);
		}
	}

	protected abstract addRow(row: VaultRow<TData>): void;
	protected abstract removeRow(id: string): void;
	protected abstract onDestroy(): void;
}

/**
 * Reactive grouped index where each row belongs to exactly one group.
 * The keyFn returns a single key (or null to exclude the row).
 */
export class ReactiveGroupBy<TData, K> extends BaseReactiveGroupBy<TData, K> {
	private readonly rowToKey = new Map<string, K>();

	constructor(
		sourceRows: ReadonlyArray<VaultRow<TData>>,
		sourceEvents$: Observable<VaultTableEvent<TData>>,
		private readonly keyFn: (row: VaultRow<TData>) => K | null
	) {
		super(sourceEvents$);
		this.populate(sourceRows);
	}

	protected addRow(row: VaultRow<TData>): void {
		const key = this.keyFn(row);
		if (key === null) return;
		this.rowToKey.set(row.id, key);
		this.addToGroup(key, row);
	}

	protected removeRow(id: string): void {
		const key = this.rowToKey.get(id);
		if (key === undefined) return;
		this.rowToKey.delete(id);
		this.removeFromGroup(key, id);
	}

	protected onDestroy(): void {
		this.rowToKey.clear();
	}
}

/**
 * Reactive grouped index where each row can belong to multiple groups.
 * The keysFn returns an array of keys for each row.
 */
export class ReactiveMultiGroupBy<TData, K> extends BaseReactiveGroupBy<TData, K> {
	private readonly rowToKeys = new Map<string, K[]>();

	constructor(
		sourceRows: ReadonlyArray<VaultRow<TData>>,
		sourceEvents$: Observable<VaultTableEvent<TData>>,
		private readonly keysFn: (row: VaultRow<TData>) => K[]
	) {
		super(sourceEvents$);
		this.populate(sourceRows);
	}

	protected addRow(row: VaultRow<TData>): void {
		const keys = this.keysFn(row);
		this.rowToKeys.set(row.id, keys);
		for (const key of keys) {
			this.addToGroup(key, row);
		}
	}

	protected removeRow(id: string): void {
		const keys = this.rowToKeys.get(id);
		if (!keys) return;
		this.rowToKeys.delete(id);
		for (const key of keys) {
			this.removeFromGroup(key, id);
		}
	}

	protected onDestroy(): void {
		this.rowToKeys.clear();
	}
}
