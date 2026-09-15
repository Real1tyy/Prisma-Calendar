import { VaultTableView, type VaultRow, type VaultTable, type VaultTableEvent } from "@real1ty/obsidian-plugins";
import { filter, merge, Subject, type BehaviorSubject, type Observable, type Subscription } from "rxjs";

import type { Frontmatter } from "../types";
import type { RawEventSource } from "../types/event-source";
import type { SingleCalendarConfig } from "../types/settings";
import { parseAffectingSettingsChanged } from "../utils/calendar/settings";
import { parseRRuleFromFrontmatter } from "../utils/dates/recurring";
import { parseEventMetadata } from "../utils/events/frontmatter";
import { deriveRRuleId } from "../utils/events/zettel-id";

/**
 * Which slice of the event table a view watches. Each scope is a pure predicate
 * over a row's frontmatter under the current property mapping, so membership is
 * recomputed — not remembered — whenever the mapping changes.
 */
export type EventSourceScope = "tracked" | "untracked" | "recurringSource" | "physicalInstance";

export type EventSourceEvent =
	| { type: "source-changed"; filePath: string; source: RawEventSource; oldPath?: string }
	| { type: "source-removed"; filePath: string; reason: "deleted" | "filtered"; isRename?: boolean };

/** The slice of a view a row consumer needs — what tests stub and services depend on. */
export type EventSourceRows = Pick<EventSourceView, "sources$" | "ready$">;

export interface EventSourceViewOptions {
	/**
	 * Whether this device writes a missing series id. The repository mints one for
	 * a recurring note that has none and queues the write; while it is queued the
	 * projection carries the same derived id. A read-only device writes nothing,
	 * so it projects nothing. Defaults to true.
	 */
	canMintSeriesId?: () => boolean;
}

/**
 * Every note in the table, as the union of the tracked and untracked scopes.
 * A note crossing between them leaves one scope as `filtered` and enters the
 * other as a change, so only real deletions are forwarded as removals — the
 * view for a consumer whose identity for a note is not its date.
 */
export function allEventSources(tracked: EventSourceRows, untracked: EventSourceRows): EventSourceRows {
	return {
		sources$: merge(tracked.sources$, untracked.sources$).pipe(
			filter((event) => event.type === "source-changed" || event.reason === "deleted")
		),
		ready$: tracked.ready$,
	};
}

function isTracked(data: Frontmatter, settings: SingleCalendarConfig): boolean {
	return Boolean(data[settings.startProp] || data[settings.dateProp]);
}

function matchesScope(data: Frontmatter, settings: SingleCalendarConfig, scope: EventSourceScope): boolean {
	switch (scope) {
		case "tracked":
			return isTracked(data, settings);
		case "untracked":
			return !isTracked(data, settings);
		case "recurringSource":
			return parseRRuleFromFrontmatter(data, settings) !== null;
		case "physicalInstance":
			// Tracked-ness is part of the predicate because instance bookkeeping has
			// always run off the tracked stream: a note that lost its date is not a
			// slot the generator may consider filled.
			return (
				isTracked(data, settings) && Boolean(data[settings.rruleIdProp]) && Boolean(data[settings.instanceDateProp])
			);
	}
}

/**
 * The frontmatter a recurring note will carry once the repository's queued
 * series-id write lands: the id is `deriveRRuleId` of the note's path, the same
 * pure function the repository uses, so the projection and the disk agree. The
 * row itself is never touched.
 */
function withPendingSeriesId(row: VaultRow<Frontmatter>, settings: SingleCalendarConfig, mint: boolean): Frontmatter {
	const data = row.data;
	if (!mint || data[settings.rruleIdProp] || !data[settings.rruleProp]) return data;
	if (parseRRuleFromFrontmatter(data, settings) === null) return data;
	return { ...data, [settings.rruleIdProp]: deriveRRuleId(row.filePath) };
}

/** Projects a row into the parsed shape every event consumer works in. */
function buildRawEventSource(
	row: VaultRow<Frontmatter>,
	settings: SingleCalendarConfig,
	mintSeriesId: boolean
): RawEventSource {
	const frontmatter = withPendingSeriesId(row, settings, mintSeriesId);
	const allDayProp = frontmatter[settings.allDayProp];
	return {
		filePath: row.filePath,
		mtime: row.mtime,
		frontmatter,
		folder: row.file.parent?.path || "",
		isAllDay: allDayProp === true || allDayProp === "true",
		isUntracked: !isTracked(frontmatter, settings),
		metadata: parseEventMetadata(frontmatter, settings),
	};
}

/**
 * The vault boundary for everything in Prisma that used to build its own cache
 * off a stream of indexer events: a `VaultTableView` over one scope of the event
 * table, projecting its rows into {@link RawEventSource}s and inheriting the
 * table's `ready$` so no consumer tracks indexing completion itself
 * ([[decision-vaulttable-write-gate]]).
 *
 * A parse-affecting settings change re-runs the scope predicate and replays
 * every surviving row, so "I remapped the Start Date property and nothing
 * happened" cannot come back.
 */
export class EventSourceView extends VaultTableView<Frontmatter> {
	private settings: SingleCalendarConfig;
	private settingsSub: Subscription | null = null;
	private viewSub: Subscription | null = null;
	private sourceTable: VaultTable<Frontmatter>;
	private readonly sourcesSubject = new Subject<EventSourceEvent>();
	private readonly canMintSeriesId: () => boolean;

	public readonly sources$: Observable<EventSourceEvent>;

	constructor(
		table: VaultTable<Frontmatter>,
		private readonly scope: EventSourceScope,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		options: EventSourceViewOptions = {}
	) {
		const settings = settingsStore.value;
		super(table, { filter: (row) => matchesScope(row.data, settings, scope) });

		this.settings = settings;
		this.sourceTable = table;
		this.canMintSeriesId = options.canMintSeriesId ?? (() => true);
		this.sources$ = this.sourcesSubject.asObservable();

		this.viewSub = this.events$.subscribe((event) => {
			this.sourcesSubject.next(this.toSourceEvent(event));
		});

		this.settingsSub = settingsStore.subscribe((newSettings) => {
			const previous = this.settings;
			this.settings = newSettings;
			if (parseAffectingSettingsChanged(previous, newSettings)) {
				this.reparse();
			}
		});
	}

	override rebind(table: VaultTable<Frontmatter>): void {
		// Before super, so the removal events it emits resolve against the
		// replacement table rather than the one being discarded.
		this.sourceTable = table;
		super.rebind(table);
	}

	override destroy(): void {
		this.settingsSub?.unsubscribe();
		this.settingsSub = null;
		this.viewSub?.unsubscribe();
		this.viewSub = null;
		this.sourcesSubject.complete();
		super.destroy();
	}

	private project(row: VaultRow<Frontmatter>): RawEventSource {
		return buildRawEventSource(row, this.settings, this.canMintSeriesId());
	}

	private reparse(): void {
		const known = new Set(this.toArray().map((row) => row.id));
		this.updateFilter((row) => matchesScope(row.data, this.settings, this.scope));

		for (const row of this.toArray()) {
			// Rows that just entered the scope were already announced by updateFilter.
			if (!known.has(row.id)) continue;
			this.sourcesSubject.next({
				type: "source-changed",
				filePath: row.filePath,
				source: this.project(row),
			});
		}
	}

	private toSourceEvent(event: VaultTableEvent<Frontmatter>): EventSourceEvent {
		switch (event.type) {
			case "row-created":
				return {
					type: "source-changed",
					filePath: event.filePath,
					source: this.project(event.row),
					...(event.oldPath !== undefined ? { oldPath: event.oldPath } : {}),
				};
			case "row-updated":
				return {
					type: "source-changed",
					filePath: event.filePath,
					source: this.project(event.newRow),
					...(event.oldPath !== undefined ? { oldPath: event.oldPath } : {}),
				};
			case "row-deleted":
				return {
					type: "source-removed",
					filePath: event.filePath,
					// A row leaves a view two ways and they mean opposite things to a
					// consumer: the note is gone, or it stopped matching this scope (its
					// Start Date was cleared, its RRule removed). Only the first is a
					// disappearance — the table still holds the row in the second.
					reason: this.sourceTable.get(event.id) === undefined ? "deleted" : "filtered",
					...(event.isRename !== undefined ? { isRename: event.isRename } : {}),
				};
		}
	}
}
