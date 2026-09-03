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
	resync(): void;
}
