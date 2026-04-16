import type { TFile } from "obsidian";
import { Subject } from "rxjs";
import { vi } from "vitest";

import type { VaultRow, VaultTableEvent } from "../../src/core/vault-table/types";
import type { VaultTable } from "../../src/core/vault-table/vault-table";

/**
 * Creates a VaultRow with sensible defaults. Generic over any data type.
 */
export function makeRow<TData>(id: string, data: TData, directory = "test"): VaultRow<TData> {
	return {
		id,
		file: {
			path: `${directory}/${id}.md`,
			stat: { mtime: Date.now(), ctime: Date.now(), size: 0 },
		} as unknown as TFile,
		filePath: `${directory}/${id}.md`,
		data,
		content: "",
		mtime: Date.now(),
	};
}

/**
 * Creates a minimal mock VaultTable backed by a Subject for event emission.
 * Returns the mock table (typed as VaultTable) and the Subject for driving events.
 */
export function createMockTable<TData>(initialRows: VaultRow<TData>[] = []) {
	const eventsSubject = new Subject<VaultTableEvent<TData>>();

	const table = {
		toArray: vi.fn(() => initialRows as ReadonlyArray<VaultRow<TData>>),
		events$: eventsSubject.asObservable(),
	} as unknown as VaultTable<TData>;

	return { table, eventsSubject };
}
