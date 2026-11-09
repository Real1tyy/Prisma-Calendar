import type { App, TFile } from "obsidian";
import { Subject, type Observable } from "rxjs";

import {
	hasDuplicateFrontmatterKeys,
	repairDuplicateFrontmatterKeys,
	type DuplicateKeyReport,
} from "../frontmatter/frontmatter-integrity";

/**
 * The VaultTable's integrity boundary: one note is a row, its frontmatter
 * properties are the row's columns, and a column may appear only once. Every
 * table frontmatter write and every unreadable note the indexer meets passes
 * through here, so a duplicate key — left by an editor reload or a sync merge —
 * is repaired deterministically instead of bricking the note.
 * See [[decision-vaulttable-frontmatter-integrity]].
 */

/** Where the repair was triggered: a write that hit the corrupt block, or the indexer finding it. */
export type FrontmatterIntegrityTrigger = "write" | "index";

export type FrontmatterIntegrityEvent =
	| {
			type: "repaired";
			filePath: string;
			trigger: FrontmatterIntegrityTrigger;
			duplicates: DuplicateKeyReport[];
			/** Non-empty values discarded across every duplicate — data loss worth a warning. */
			droppedValueCount: number;
	  }
	| {
			type: "repair-failed";
			filePath: string;
			trigger: FrontmatterIntegrityTrigger;
			error: unknown;
	  };

/** Monotonic counters for the table's lifetime — the metrics a Doctor row and the logs read. */
export interface FrontmatterIntegrityStats {
	repairs: number;
	duplicateKeysCollapsed: number;
	conflictingValuesDropped: number;
	repairFailures: number;
}

export interface FrontmatterIntegrityGuardOptions {
	propertyOrder?: () => readonly string[] | undefined;
}

/**
 * Obsidian's `processFrontMatter` surfaces the `yaml` library's
 * `YAMLParseError`; its `code` is the stable signal, the message the fallback
 * for a wrapped error that lost it.
 */
export function isDuplicateFrontmatterKeyError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const code = (error as Error & { code?: unknown }).code;
	return code === "DUPLICATE_KEY" || error.message.includes("Map keys must be unique");
}

export class FrontmatterIntegrityGuard {
	private readonly eventsSubject = new Subject<FrontmatterIntegrityEvent>();
	private readonly counters: FrontmatterIntegrityStats = {
		repairs: 0,
		duplicateKeysCollapsed: 0,
		conflictingValuesDropped: 0,
		repairFailures: 0,
	};

	readonly events$: Observable<FrontmatterIntegrityEvent> = this.eventsSubject.asObservable();

	constructor(
		private readonly app: App,
		private readonly options: FrontmatterIntegrityGuardOptions = {}
	) {}

	get stats(): FrontmatterIntegrityStats {
		return { ...this.counters };
	}

	/**
	 * `processFrontMatter` that survives a duplicate-key block: on that one
	 * error it repairs the note and retries once. Any other error is rethrown.
	 */
	async processFrontMatter(file: TFile, update: (frontmatter: Record<string, unknown>) => void): Promise<void> {
		try {
			await this.app.fileManager.processFrontMatter(file, update);
			return;
		} catch (error) {
			if (!isDuplicateFrontmatterKeyError(error)) throw error;
		}
		const repaired = await this.repairFile(file, "write");
		if (!repaired) {
			throw new Error(`Frontmatter of ${file.path} has duplicate keys that could not be repaired`);
		}
		await this.app.fileManager.processFrontMatter(file, update);
	}

	/**
	 * Rewrites the note's frontmatter block without duplicates. Returns whether
	 * a repair was written. Reads first so a clean note is never touched — a
	 * no-op write would still bump its mtime and hand the sync tool a change.
	 */
	async repairFile(file: TFile, trigger: FrontmatterIntegrityTrigger): Promise<boolean> {
		try {
			const current = await this.app.vault.read(file);
			if (!hasDuplicateFrontmatterKeys(current)) return false;

			const propertyOrder = this.options.propertyOrder?.();
			let result: ReturnType<typeof repairDuplicateFrontmatterKeys> | null = null;
			await this.app.vault.process(file, (content) => {
				result = repairDuplicateFrontmatterKeys(content, propertyOrder ? { propertyOrder } : {});
				return result.content;
			});
			const outcome = result as ReturnType<typeof repairDuplicateFrontmatterKeys> | null;
			if (!outcome?.repaired) return false;

			this.record(file.path, trigger, outcome.duplicates);
			return true;
		} catch (error) {
			this.counters.repairFailures += 1;
			this.eventsSubject.next({ type: "repair-failed", filePath: file.path, trigger, error });
			return false;
		}
	}

	dispose(): void {
		this.eventsSubject.complete();
	}

	private record(filePath: string, trigger: FrontmatterIntegrityTrigger, duplicates: DuplicateKeyReport[]): void {
		const droppedValueCount = duplicates.reduce((sum, report) => sum + report.droppedValues.length, 0);
		this.counters.repairs += 1;
		this.counters.duplicateKeysCollapsed += duplicates.length;
		this.counters.conflictingValuesDropped += droppedValueCount;
		this.eventsSubject.next({ type: "repaired", filePath, trigger, duplicates, droppedValueCount });
	}
}
