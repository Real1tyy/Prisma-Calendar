import type { FrontmatterDiff, SyncStore, VaultRow, VaultTableEvent } from "@real1ty-obsidian-plugins";
import { isFolderNote, removeMarkdownExtension, toSafeString, VaultTable } from "@real1ty-obsidian-plugins";
import { type App, TFile } from "obsidian";
import { BehaviorSubject, type Observable, Subject, type Subscription } from "rxjs";

import type { Frontmatter, PrismaSyncDataSchema, SingleCalendarConfig } from "../types";
import type { CalendarEventSource, IndexerEvent, RawEventSource } from "../types/event-source";
import type { NodeRecurringEvent } from "../types/recurring";
import { parseEventMetadata, shouldEventBeMarkedAsDone } from "../utils/event-frontmatter";
import { ensureFileHasZettelId } from "../utils/event-naming";
import { cleanupTitle } from "../utils/events/naming";
import { generateUniqueRruleId, hasTimestamp } from "../utils/events/zettel-id";
import { parseRRuleFromFrontmatter } from "../utils/recurring-utils";
import { createEventSchema } from "./event-schema";

/**
 * Namespace for the IndexedDB cache. One DB per plugin — isolated from other
 * plugins on the same origin. Bump {@link PRISMA_CACHE_SCHEMA_VERSION} when
 * the parsed event shape changes in a backwards-incompatible way.
 */
const PRISMA_CACHE_NAMESPACE = "prisma-calendar";
const PRISMA_CACHE_SCHEMA_VERSION = 2;

export type FrontmatterSnapshot = {
	key: string;
	data: Frontmatter;
	content: string;
	filePath: string;
	/** Obsidian keeps TFile.path current through renames, so this reference
	 *  never goes stale — even if ZettelID assignment renames the file after
	 *  the snapshot was captured. */
	file: TFile;
};

type EventTable = VaultTable<Frontmatter>;

export class EventFileRepository implements CalendarEventSource {
	private table: EventTable;
	private settingsSub: Subscription | null = null;
	private tableSub: Subscription | null = null;

	private settings: SingleCalendarConfig;
	private readonly eventsSubject = new Subject<IndexerEvent>();
	private readonly indexingCompleteSubject = new BehaviorSubject<boolean>(false);

	/** Per-file queue to serialize processFrontMatter calls */
	private fmLocks = new Map<string, Promise<void>>();
	/** Tracks files currently being renamed for ZettelID to prevent re-entrant triggers */
	private zettelIdRenamesInFlight = new Set<string>();
	/**
	 * Background frontmatter writes (auto ZettelID, title sync, etc.) are deferred until after
	 * the initial scan completes. Writing during the cold-start scan triggers a cascade of
	 * file-modify events that block the calendar from rendering. Files touched before ready
	 * are queued here and drained once the table emits ready.
	 */
	private tableReady = false;
	private deferredBackgroundFiles = new Set<string>();

	public readonly events$: Observable<IndexerEvent>;
	public readonly indexingComplete$: Observable<boolean>;

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private syncStore: SyncStore<typeof PrismaSyncDataSchema> | null
	) {
		this.settings = settingsStore.value;
		this.table = this.createTable(this.settings);
		this.events$ = this.eventsSubject.asObservable();
		this.indexingComplete$ = this.indexingCompleteSubject.asObservable();

		this.settingsSub = settingsStore.subscribe((newSettings) => {
			const prevSettings = this.settings;
			this.settings = newSettings;
			if (
				newSettings.directory !== this.table.directory ||
				newSettings.indexSubdirectories !== prevSettings.indexSubdirectories
			) {
				this.indexingCompleteSubject.next(false);
				this.table.destroy();
				this.table = this.createTable(newSettings);
				this.wireTableEvents();
				this.table.start().catch((error) => {
					console.error("[EventFileRepository] table.start() failed after settings change:", error);
				});
			}
		});
	}

	// ─── CalendarEventSource ─────────────────────────────────────

	async markFileAsDone(filePath: string): Promise<void> {
		if (this.syncStore?.data.readOnly) return;

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		try {
			await this.enqueueFrontmatterWrite(file, (fm: Frontmatter) => {
				fm[this.settings.statusProperty] = this.settings.doneValue;
			});
		} catch (error) {
			console.error(`[EventFileRepository] Error marking event as done: ${filePath}`, error);
		}
	}

	resync(): void {
		this.indexingCompleteSubject.next(false);
		this.table.resync();
	}

	/** The underlying VaultTable — use for creating VaultTableViews or direct access */
	getTable(): EventTable {
		return this.table;
	}

	// ─── Row-level access ────────────────────────────────────────

	getRow(key: string): VaultRow<Frontmatter> | undefined {
		return this.table.get(key);
	}

	getRowByPath(filePath: string): VaultRow<Frontmatter> | undefined {
		return this.getRow(this.toKey(filePath));
	}

	getAllRows(): ReadonlyArray<VaultRow<Frontmatter>> {
		return this.table.toArray();
	}

	has(key: string): boolean {
		return this.table.has(key);
	}

	// ─── Path resolution ─────────────────────────────────────────

	toKey(filePath: string): string {
		return this.table.toRowKey(filePath);
	}

	getByPath(filePath: string): Frontmatter | undefined {
		return this.table.get(this.toKey(filePath))?.data;
	}

	// ─── CRUD ────────────────────────────────────────────────────

	async create(fileName: string, data: Frontmatter, content?: string): Promise<VaultRow<Frontmatter>> {
		return this.table.create({ fileName, data, ...(content !== undefined ? { content } : {}) });
	}

	async update(key: string, patch: Partial<Frontmatter>): Promise<VaultRow<Frontmatter>> {
		return this.table.update(key, patch);
	}

	async updateByPath(filePath: string, patch: Partial<Frontmatter>): Promise<VaultRow<Frontmatter>> {
		return this.update(this.toKey(filePath), patch);
	}

	async delete(key: string): Promise<void> {
		await this.table.delete(key);
	}

	async deleteByPath(filePath: string): Promise<void> {
		return this.delete(this.toKey(filePath));
	}

	// ─── Frontmatter operations ──────────────────────────────────

	/**
	 * Applies an updater function to the file's frontmatter.
	 * Uses table.replace() (not table.update()) so property deletions in the
	 * updater are properly reflected — update() merges partials and would
	 * resurrect deleted keys from existing data.
	 */
	async updateFrontmatterByPath(filePath: string, updater: (fm: Frontmatter) => void): Promise<Frontmatter> {
		const key = this.toKey(filePath);
		const existing = this.table.get(key);
		if (!existing) throw new Error(`Event file not found: ${key}`);
		const updated = { ...existing.data };
		updater(updated);
		const row = await this.table.replace(key, updated);
		return row.data;
	}

	async snapshotByPath(filePath: string): Promise<FrontmatterSnapshot> {
		const key = this.toKey(filePath);
		const row = this.table.get(key);
		if (!row) throw new Error(`Event file not found: ${key}`);
		const rawContent = await this.app.vault.read(row.file);
		return {
			key,
			data: { ...row.data },
			content: rawContent,
			filePath: row.filePath,
			file: row.file,
		};
	}

	async restoreSnapshot(snapshot: FrontmatterSnapshot): Promise<void> {
		// snapshot.file.path stays current through renames; snapshot.filePath
		// is the path at capture time (used as fallback for deleted files).
		const currentPath = snapshot.file.path;
		const file = this.app.vault.getAbstractFileByPath(currentPath);
		if (file) {
			await this.app.vault.modify(file as TFile, snapshot.content);
		} else {
			await this.app.vault.create(snapshot.filePath, snapshot.content);
		}
	}

	// ─── Lifecycle ───────────────────────────────────────────────

	async start(): Promise<void> {
		this.wireTableEvents();
		await this.table.start();
	}

	async waitUntilReady(): Promise<void> {
		await this.table.waitUntilReady();
	}

	detachSettingsSubscription(): void {
		this.settingsSub?.unsubscribe();
		this.settingsSub = null;
	}

	destroy(): void {
		this.detachSettingsSubscription();
		this.tableSub?.unsubscribe();
		this.tableSub = null;
		this.table.destroy();
		this.eventsSubject.complete();
		this.indexingCompleteSubject.complete();
	}

	// ─── VaultTable Event Bridge ─────────────────────────────────

	private wireTableEvents(): void {
		this.tableSub?.unsubscribe();
		this.tableReady = false;
		this.deferredBackgroundFiles.clear();

		this.tableSub = this.table.events$.subscribe((event) => {
			void this.handleTableEvent(event).catch((error) => {
				console.error("[EventFileRepository] Error handling table event:", error);
			});
		});

		this.table.ready$.subscribe((ready) => {
			if (ready) {
				if (!this.tableReady) {
					this.tableReady = true;
					this.drainDeferredBackgroundUpdates();
				}
				this.indexingCompleteSubject.next(true);
			}
		});
	}

	private async handleTableEvent(event: VaultTableEvent<Frontmatter>): Promise<void> {
		switch (event.type) {
			case "row-created": {
				await this.emitFileEvents(event.row, undefined, undefined);
				break;
			}
			case "row-updated": {
				await this.emitFileEvents(event.newRow, event.oldRow.data, event.diff);
				break;
			}
			case "row-deleted": {
				this.eventsSubject.next({
					type: "file-deleted",
					filePath: event.filePath,
					oldFrontmatter: event.oldRow.data,
				});
				break;
			}
		}
	}

	private async emitFileEvents(
		row: VaultRow<Frontmatter>,
		oldFrontmatter: Frontmatter | undefined,
		frontmatterDiff: FrontmatterDiff | undefined
	): Promise<void> {
		let frontmatter = row.data;
		const settings = this.settings;

		// Always add recurring events even if skipped - this allows navigation
		// to source from physical instances and viewing recurring event lists.
		// The RecurringEventManager will check skip property and not generate new instances.
		const recurring = await this.tryParseRecurring(row, oldFrontmatter);
		if (recurring) {
			this.eventsSubject.next({
				type: "recurring-event-found",
				filePath: row.filePath,
				recurringEvent: recurring,
				...(oldFrontmatter ? { oldFrontmatter } : {}),
				...(frontmatterDiff ? { frontmatterDiff } : {}),
			});

			// CRITICAL: Update frontmatter object with rRuleId from the recurring event
			// tryParseRecurring returns a NodeRecurringEvent with the rRuleId (either existing or newly generated)
			// We update the frontmatter object directly to ensure file-changed events have the correct data
			if (!frontmatter[settings.rruleIdProp]) {
				frontmatter = {
					...frontmatter,
					[settings.rruleIdProp]: recurring.rRuleId,
				};
			}
		}

		// Always emit file-changed events for files with start property OR date property OR neither (untracked)
		// Let EventStore/Parser handle filtering - this ensures cached events
		// get invalidated when properties change and no longer pass filters
		// This allows recurring source files to ALSO appear as regular events on the calendar
		const hasTimedEvent = frontmatter[settings.startProp];
		const hasAllDayEvent = frontmatter[settings.dateProp];
		const hasDateOrTime = hasTimedEvent || hasAllDayEvent;
		const isUntracked = !hasDateOrTime;

		if (hasDateOrTime || isUntracked) {
			if (this.tableReady) {
				this.runBackgroundUpdates(row.file, frontmatter, isUntracked);
			} else {
				this.deferredBackgroundFiles.add(row.filePath);
			}

			const allDayProp = frontmatter[settings.allDayProp];
			const isAllDay = allDayProp === true || allDayProp === "true";
			const metadata = parseEventMetadata(frontmatter, settings);

			const source: RawEventSource = {
				filePath: row.filePath,
				mtime: row.mtime,
				frontmatter,
				folder: row.file.parent?.path || "",
				isAllDay,
				isUntracked,
				metadata,
			};

			this.eventsSubject.next({
				type: isUntracked ? "untracked-file-changed" : "file-changed",
				filePath: row.filePath,
				source,
				...(oldFrontmatter ? { oldFrontmatter } : {}),
				...(frontmatterDiff ? { frontmatterDiff } : {}),
			});
		}
	}

	// ─── Recurring Event Detection ───────────────────────────────

	private async tryParseRecurring(
		row: VaultRow<Frontmatter>,
		oldFrontmatter?: Frontmatter
	): Promise<NodeRecurringEvent | null> {
		const frontmatter = row.data;
		const rrules = parseRRuleFromFrontmatter(frontmatter, this.settings);
		if (!rrules) return null;

		let rRuleId = toSafeString(frontmatter[this.settings.rruleIdProp]);
		const frontmatterCopy = { ...frontmatter };
		const previousRRuleId = toSafeString(oldFrontmatter?.[this.settings.rruleIdProp]);

		// Guard against accidental ID churn: recurring source rRuleId is immutable once set.
		// If a file suddenly reports a different id, keep the previous one and revert the file.
		if (rRuleId && previousRRuleId && rRuleId !== previousRRuleId) {
			rRuleId = previousRRuleId;
			if (!this.syncStore?.data.readOnly) {
				await this.enqueueFrontmatterWrite(row.file, (fm: Frontmatter) => {
					fm[this.settings.rruleIdProp] = rRuleId;
				});
			}
		}

		if (!rRuleId) {
			// vault.on("modify") fires BEFORE the metadata cache updates, so the rRuleId
			// might already exist on disk but not be in the cache yet. Wait for the
			// cache to catch up before deciding to generate a new ID — prevents duplicates.
			await new Promise((resolve) => setTimeout(resolve, 200));
			const freshCache = this.app.metadataCache.getFileCache(row.file);
			const cachedId = toSafeString(freshCache?.frontmatter?.[this.settings.rruleIdProp]);

			if (cachedId) {
				rRuleId = cachedId;
			} else if (this.syncStore?.data.readOnly) {
				// In readOnly mode we can't write an rRuleId — skip this recurring event entirely.
				// Without a stable ID, instances can't be deduplicated across reloads.
				return null;
			} else {
				rRuleId = generateUniqueRruleId();
				await this.enqueueFrontmatterWrite(row.file, (fm: Frontmatter) => {
					fm[this.settings.rruleIdProp] = rRuleId;
				});
			}
		}

		frontmatterCopy[this.settings.rruleIdProp] = rRuleId;
		const metadata = parseEventMetadata(frontmatterCopy, this.settings);

		// Defer content reading - we'll read it lazily when needed
		// This avoids blocking I/O during the initial scan
		return {
			sourceFilePath: row.filePath,
			title: row.file.basename,
			rRuleId,
			rrules,
			frontmatter: frontmatterCopy,
			metadata,
			content: undefined, // Empty initially - will be loaded on-demand by RecurringEventManager
		};
	}

	// ─── Background File Updates ─────────────────────────────────

	private runBackgroundUpdates(file: TFile, frontmatter: Frontmatter, isUntracked: boolean): void {
		// Auto-assign ZettelID: fire-and-forget. The rename triggers a new
		// event cycle with the updated path, so we don't need to await or update state here.
		void this.autoAssignZettelId(file, isUntracked).catch((error) => {
			console.error(`[EventFileRepository] Error auto-assigning ZettelID for ${file.path}:`, error);
		});
		void this.applyBackgroundFrontmatterUpdates(file, frontmatter, isUntracked).catch((error) => {
			console.error(`[EventFileRepository] Error applying background updates for ${file.path}:`, error);
		});
	}

	private drainDeferredBackgroundUpdates(): void {
		const paths = Array.from(this.deferredBackgroundFiles);
		this.deferredBackgroundFiles.clear();
		const settings = this.settings;
		for (const path of paths) {
			const row = this.table.get(this.toKey(path));
			if (!row) continue;
			const isUntracked = !row.data[settings.startProp] && !row.data[settings.dateProp];
			this.runBackgroundUpdates(row.file, row.data, isUntracked);
		}
	}

	private async applyBackgroundFrontmatterUpdates(
		file: TFile,
		frontmatter: Frontmatter,
		isUntracked: boolean
	): Promise<void> {
		if (this.syncStore?.data.readOnly) return;

		const settings = this.settings;
		const { calendarTitleProp, sortDateProp, statusProperty, doneValue } = settings;

		const pathWithoutExt = removeMarkdownExtension(file.path);
		const displayName = cleanupTitle(file.basename);
		const titleLink = `[[${pathWithoutExt}|${displayName}]]`;
		const needsTitleUpdate = !!calendarTitleProp && frontmatter[calendarTitleProp] !== titleLink;
		const needsSortDateCleanup = isUntracked && !!sortDateProp && sortDateProp in frontmatter;
		const needsMarkAsDone = !isUntracked && shouldEventBeMarkedAsDone(frontmatter, settings);

		if (!needsTitleUpdate && !needsSortDateCleanup && !needsMarkAsDone) return;

		await this.enqueueFrontmatterWrite(file, (fm: Frontmatter) => {
			if (needsTitleUpdate) fm[calendarTitleProp] = titleLink;
			if (needsSortDateCleanup) delete fm[sortDateProp];
			if (needsMarkAsDone) fm[statusProperty] = doneValue;
		});
	}

	/**
	 * Auto-assigns a ZettelID to a file if the setting is enabled and the file doesn't have one.
	 * Uses a Set to track in-flight renames and prevent re-entrant triggers from the rename event.
	 * @param isUntracked - true if the file has no date/time properties (untracked event)
	 */
	private async autoAssignZettelId(file: TFile, isUntracked: boolean): Promise<void> {
		const mode = this.settings.autoAssignZettelId;
		if (mode === "disabled") return;
		if (mode === "calendarEvents" && isUntracked) return;
		if (this.syncStore?.data.readOnly) return;
		if (hasTimestamp(file.basename)) return;
		if (isFolderNote(file.path)) return;
		// Prevent re-entrant renames: if we're already renaming this file (by original path),
		// skip. Also check the current path in case the event arrives after rename started.
		if (this.zettelIdRenamesInFlight.has(file.path)) return;

		this.zettelIdRenamesInFlight.add(file.path);
		try {
			await ensureFileHasZettelId(this.app, file, this.settings.zettelIdProp);
		} catch (error) {
			console.error(`[EventFileRepository] Error auto-assigning ZettelID to ${file.path}:`, error);
		} finally {
			this.zettelIdRenamesInFlight.delete(file.path);
		}
	}

	// ─── Utilities ───────────────────────────────────────────────

	/**
	 * Serialize processFrontMatter calls per file to prevent interleaving writes
	 * and suppress the resulting file-changed events from our own writebacks.
	 *
	 * Queued writes can outlive the file: background updates on a freshly-created
	 * event race with the user undoing the create (or any other delete). When the
	 * queued write finally dequeues, the TFile is stale and processFrontMatter
	 * throws ENOENT. Re-resolve the path at dequeue time and no-op if the file is
	 * gone — the deletion already rendered the write moot.
	 */
	private enqueueFrontmatterWrite(file: TFile, fn: (fm: Frontmatter) => void): Promise<void> {
		const path = file.path;
		const prev = this.fmLocks.get(path) ?? Promise.resolve();
		// A rejected `prev` would skip `.then` for every downstream write, silently
		// no-opping the rest of the queue. The lock map holds a rejection-proof
		// `chain`; callers still observe rejections via `result`.
		const result = prev
			.catch(() => {})
			.then(async () => {
				const current = this.app.vault.getAbstractFileByPath(path);
				if (!(current instanceof TFile)) return;
				try {
					await this.app.fileManager.processFrontMatter(current, fn);
				} catch (err: unknown) {
					if (err instanceof Error && err.message.includes("ENOENT")) return;
					throw err;
				}
			});
		const chain: Promise<void> = result
			.catch(() => {})
			.finally(() => {
				if (this.fmLocks.get(path) === chain) this.fmLocks.delete(path);
			});
		this.fmLocks.set(path, chain);
		return result;
	}

	protected createTable(settings: SingleCalendarConfig): EventTable {
		return new VaultTable({
			app: this.app,
			directory: settings.directory,
			schema: createEventSchema(),
			invalidStrategy: "skip",
			debounceMs: 100,
			emitCrudEvents: true,
			recursive: settings.indexSubdirectories,
			persistence: {
				namespace: PRISMA_CACHE_NAMESPACE,
				schemaVersion: PRISMA_CACHE_SCHEMA_VERSION,
			},
		});
	}
}
