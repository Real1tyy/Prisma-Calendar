import type { DataAdapter } from "obsidian";

/**
 * The slice of a filesystem the file sink needs, so rotation and pruning run
 * against an in-memory fake under test and against Obsidian's vault adapter in
 * production. Paths are vault-relative, exactly as the adapter takes them.
 */
export interface LogFileSystem {
	exists(path: string): Promise<boolean>;
	mkdir(path: string): Promise<void>;
	append(path: string, data: string): Promise<void>;
	/** `null` when the path does not exist. */
	stat(path: string): Promise<{ size: number; mtime: number } | null>;
	/** Vault-relative paths of the files directly inside `dir`. */
	listFiles(dir: string): Promise<string[]>;
	remove(path: string): Promise<void>;
	rename(from: string, to: string): Promise<void>;
}

export function createVaultLogFileSystem(adapter: DataAdapter): LogFileSystem {
	return {
		exists: (path) => adapter.exists(path),
		mkdir: (path) => adapter.mkdir(path),
		append: (path, data) => adapter.append(path, data),
		stat: async (path) => {
			const stat = await adapter.stat(path);
			return stat === null ? null : { size: stat.size, mtime: stat.mtime };
		},
		listFiles: async (dir) => (await adapter.list(dir)).files,
		remove: (path) => adapter.remove(path),
		rename: (from, to) => adapter.rename(from, to),
	};
}
