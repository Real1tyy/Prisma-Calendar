import type { FrontmatterDiff } from "@real1ty/obsidian-plugins";
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

type IndexerEventType = "file-changed" | "file-deleted" | "recurring-event-found" | "untracked-file-changed";

export interface IndexerEvent {
	type: IndexerEventType;
	filePath: string;
	oldPath?: string;
	source?: RawEventSource;
	recurringEvent?: NodeRecurringEvent;
	oldFrontmatter?: Frontmatter;
	frontmatterDiff?: FrontmatterDiff;
	isRename?: boolean;
}

/**
 * Common interface for event-producing data sources.
 * Implemented by EventFileRepository (VaultTable-backed).
 */
export interface CalendarEventSource {
	readonly events$: Observable<IndexerEvent>;
	readonly indexingComplete$: Observable<boolean>;
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
}

/** The slice of {@link CalendarEventSource} an automatic writer needs. */
export type AutomaticFrontmatterWriter = Pick<CalendarEventSource, "automaticWriteFrontmatter">;
