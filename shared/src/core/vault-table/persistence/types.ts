/**
 * Public types for the VaultTable persistent IndexedDB cache.
 */

export interface PersistenceConfig {
	/**
	 * Unique string identifying the owning plugin/feature. Becomes part of the
	 * IndexedDB database name (`obsidian-cache-${namespace}`). Author-supplied
	 * so callers can control isolation boundaries explicitly.
	 */
	namespace: string;

	/**
	 * Author-bumped integer. When a stored entry's schemaVersion does not match
	 * the current one, the entire namespace DB is deleted. Bump whenever
	 * `TData` shape changes in a backwards-incompatible way.
	 */
	schemaVersion: number;

	/**
	 * When false, all persistence operations become no-ops. Defaults to true.
	 */
	enabled?: boolean;
}

/**
 * Shape stored in IndexedDB. `data` must be structured-cloneable
 * (plain JSON objects — no class instances, functions, Maps, Sets, or cycles).
 * Zod-inferred types satisfy this naturally.
 *
 * `raw` is the original frontmatter object the entry was parsed from — stored
 * so hydration can verify cache freshness by comparing it to the current file
 * frontmatter. Mtime alone is unsafe as a freshness key because same-second
 * writes (bulk rename, processFrontMatter on 1s-granularity filesystems) can
 * change file content without ticking mtime. Entries written before this
 * field existed may be missing it — treat as a cache miss and re-parse.
 *
 * Schema version is tracked once at the DB level (meta store); on mismatch
 * the entire namespace DB is dropped, so there is no per-entry version field.
 */
export interface PersistentEntry<TData> {
	data: TData;
	mtime: number;
	raw?: Record<string, unknown>;
}

/**
 * Injectable IDB factory — lets tests swap in fake-indexeddb without touching globals.
 */
export interface IdbFactory {
	open(name: string, version?: number): IDBOpenDBRequest;
	deleteDatabase(name: string): IDBOpenDBRequest;
}

export const DEFAULT_IDB_FACTORY: IdbFactory = {
	open: (name, version) => indexedDB.open(name, version),
	deleteDatabase: (name) => indexedDB.deleteDatabase(name),
};

export const IDB_VERSION = 1;
export const STORE_NAME = "rows";
export const META_STORE = "_meta";
export const META_SCHEMA_VERSION_KEY = "schemaVersion";
