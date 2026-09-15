import { VaultTableView, type VaultRow, type VaultTable, type VaultTableEvent } from "@real1ty/obsidian-plugins";
import { Subject, type BehaviorSubject, type Observable, type Subscription } from "rxjs";

import type { Frontmatter } from "../types";
import type { RawEventSource } from "../types/event-source";
import type { SingleCalendarConfig } from "../types/settings";
import { parseAffectingSettingsChanged } from "../utils/calendar/settings";
import { parseRRuleFromFrontmatter } from "../utils/dates/recurring";
import { parseEventMetadata } from "../utils/events/frontmatter";

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

/** Projects a row into the parsed shape every event consumer works in. */
export function buildRawEventSource(row: VaultRow<Frontmatter>, settings: SingleCalendarConfig): RawEventSource {
	const allDayProp = row.data[settings.allDayProp];
	return {
		filePath: row.filePath,
		mtime: row.mtime,
		frontmatter: row.data,
		folder: row.file.parent?.path || "",
		isAllDay: allDayProp === true || allDayProp === "true",
		isUntracked: !isTracked(row.data, settings),
		metadata: parseEventMetadata(row.data, settings),
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

	public readonly sources$: Observable<EventSourceEvent>;

	constructor(
		table: VaultTable<Frontmatter>,
		private readonly scope: EventSourceScope,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		const settings = settingsStore.value;
		super(table, { filter: (row) => matchesScope(row.data, settings, scope) });

		this.settings = settings;
		this.sourceTable = table;
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

	private reparse(): void {
		const known = new Set(this.toArray().map((row) => row.id));
		this.updateFilter((row) => matchesScope(row.data, this.settings, this.scope));

		for (const row of this.toArray()) {
			// Rows that just entered the scope were already announced by updateFilter.
			if (!known.has(row.id)) continue;
			this.sourcesSubject.next({
				type: "source-changed",
				filePath: row.filePath,
				source: buildRawEventSource(row, this.settings),
			});
		}
	}

	private toSourceEvent(event: VaultTableEvent<Frontmatter>): EventSourceEvent {
		switch (event.type) {
			case "row-created":
				return {
					type: "source-changed",
					filePath: event.filePath,
					source: buildRawEventSource(event.row, this.settings),
					...(event.oldPath !== undefined ? { oldPath: event.oldPath } : {}),
				};
			case "row-updated":
				return {
					type: "source-changed",
					filePath: event.filePath,
					source: buildRawEventSource(event.newRow, this.settings),
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
