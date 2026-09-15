import type { FrontmatterDiff } from "@real1ty/obsidian-plugins";
import type { TFile } from "obsidian";
import type { Observable } from "rxjs";

import type { EventMetadata } from "./event-metadata";
import type { Frontmatter } from "./index";
import type { NodeRecurringEvent } from "./recurring";

export interface RawEventSource {
	filePath: string;
	mtime: number;
	frontmatter: Frontmatter;
	folder: string;
	isAllDay: boolean;
	isUntracked: boolean;
	metadata: EventMetadata;
}

/**
 * A note whose frontmatter parses as a recurrence rule, with its series id
 * resolved. The one input that is still a stream rather than a view: resolving
 * the id can mint one and queue its write, which no pure row predicate can do.
 * Everything else reads rows from an `EventSourceView`.
 */
export interface RecurringEventFound {
	filePath: string;
	recurringEvent: NodeRecurringEvent;
	oldFrontmatter?: Frontmatter;
	frontmatterDiff?: FrontmatterDiff;
}

/**
 * Common interface for event-producing data sources.
 * Implemented by EventFileRepository (VaultTable-backed).
 */
export interface CalendarEventSource {
	readonly recurringEvents$: Observable<RecurringEventFound>;
	markFileAsDone(filePath: string): Promise<void>;
	/**
	 * The only sanctioned way for an automatic writer to trash or rename a
	 * note. Both refuse (throw) while the underlying table is not ready, so a
	 * decision taken on a partial index can never reach disk — see
	 * [[decision-vaulttable-write-gate]].
	 */
	trashByPath(filePath: string): Promise<boolean>;
	renameByPath(filePath: string, newPath: string): Promise<void>;
	/**
	 * The only sanctioned way to edit a note's frontmatter: queued per note,
	 * held until the table is ready, written in the deterministic property
	 * order, dropped when it would not change the file. Automatic writers use
	 * the `automatic` variant, which is also a no-op on a read-only device.
	 * See [[decision-deterministic-automatic-writes-across-synced-devices]].
	 */
	writeFrontmatter(filePath: string, mutate: (fm: Frontmatter) => void): Promise<void>;
	automaticWriteFrontmatter(filePath: string, mutate: (fm: Frontmatter) => void): Promise<void>;
	/** True on a device the user set to read-only: automatic writers perform nothing. */
	readonly isReadOnly: boolean;
	resync(): void;
	/**
	 * Indexes a note the caller just wrote around the table from its bytes on
	 * disk, so it is on the calendar before Obsidian's metadata cache — one
	 * parse queue shared by every plugin — gets to it. Never throws: the note
	 * is on disk either way, and the cache still indexes it, only later.
	 */
	ingestFile(file: TFile): Promise<void>;
}

/** The slice of {@link CalendarEventSource} an automatic writer needs. */
export type AutomaticFrontmatterWriter = Pick<CalendarEventSource, "automaticWriteFrontmatter">;
