import type { App } from "obsidian";
import { firstValueFrom, type BehaviorSubject, type Observable, type Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { z } from "zod";

import type { Frontmatter } from "../../types";
import type { CalendarEventSource, IndexerEvent } from "../../types/event-source";
import type { SingleCalendarConfig } from "../../types/settings";
import { trashDuplicateFile } from "../../utils/obsidian";

export interface TrackedSyncEvent<TMetadata> {
	filePath: string;
	metadata: TMetadata;
}

export abstract class BaseSyncStateManager<TMetadata extends { uid: string }> {
	private indexerSubscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private readonly indexingComplete$: Observable<boolean>;
	private indexHydrated = false;
	protected frontmatterProp: string;
	protected readonly byUid: Map<string, TrackedSyncEvent<TMetadata>> = new Map();

	constructor(
		protected app: App,
		eventSource: CalendarEventSource,
		settings$: BehaviorSubject<SingleCalendarConfig>,
		getPropFromSettings: (settings: SingleCalendarConfig) => string,
		private schema: z.ZodType<TMetadata>
	) {
		this.frontmatterProp = getPropFromSettings(settings$.value);

		this.settingsSubscription = settings$.subscribe((settings) => {
			this.frontmatterProp = getPropFromSettings(settings);
		});

		this.indexerSubscription = eventSource.events$
			.pipe(filter((event: IndexerEvent) => event.type === "file-changed" || event.type === "file-deleted"))
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});

		this.indexingComplete$ = eventSource.indexingComplete$;
		this.indexingCompleteSubscription = eventSource.indexingComplete$.subscribe((complete) => {
			this.indexHydrated = complete;
		});
	}

	destroy(): void {
		this.indexerSubscription?.unsubscribe();
		this.indexerSubscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		this.clearState();
	}

	/**
	 * Resolves once the indexer has finished its scan and fed every tracked file
	 * into `byUid`. Sync services MUST await this before computing a plan: the
	 * tracked-state map is hydrated reactively off `events$`, so a sync that runs
	 * before the scan drains sees an empty map and re-creates every
	 * already-synced event as a duplicate (then self-heals by trashing the
	 * collisions). Gating the sync itself — not just the startup caller — makes
	 * every entry point safe: cold start, the auto-sync interval (armed at
	 * construction), a manual trigger, and a sync that lands mid-`resync()`
	 * (where `indexingComplete$` has flipped back to `false`) all wait here.
	 *
	 * Already-hydrated is the hot path: `indexingComplete$` holds `true`, so this
	 * returns synchronously with no real wait.
	 */
	async whenHydrated(): Promise<void> {
		if (this.indexHydrated) return;
		try {
			await firstValueFrom(this.indexingComplete$.pipe(filter((complete) => complete)));
		} catch {
			// The source completed (manager destroyed) before hydration. The
			// caller's own destroyed-guard handles the rest — never hang the sync.
		}
	}

	findByUidGlobal(uid: string): TrackedSyncEvent<TMetadata> | null {
		return this.byUid.get(uid) ?? null;
	}

	/**
	 * Synchronous prime for the tracked-state map. Sync services call this
	 * immediately after writing a file so the next sync can see it without
	 * waiting for the reactive indexer pipeline. Without this, a second sync
	 * triggered before `eventSource.events$` has drained races with an empty
	 * state map and spuriously re-creates / fails to delete tracked events.
	 */
	registerTracked(filePath: string, metadata: TMetadata): void {
		this.trackEvent(filePath, metadata);
	}

	unregisterTracked(filePath: string): boolean {
		return this.untrackByPath(filePath);
	}

	/**
	 * Human-readable label used when trashing a duplicate-UID file (e.g.
	 * `"CalDAV"`, `"ICS"`). Subclass hook so the warning surfaces which
	 * integration raised the duplicate.
	 */
	protected abstract getIntegrationLabel(): string;

	protected trackEvent(filePath: string, metadata: TMetadata): void {
		const existing = this.byUid.get(metadata.uid);
		if (existing && existing.filePath !== filePath) {
			trashDuplicateFile(this.app, filePath, `${this.getIntegrationLabel()} event (UID: ${metadata.uid})`);
			return;
		}
		this.byUid.set(metadata.uid, { filePath, metadata });
	}

	protected untrackByPath(filePath: string): boolean {
		for (const [uid, tracked] of this.byUid.entries()) {
			if (tracked.filePath === filePath) {
				this.byUid.delete(uid);
				return true;
			}
		}
		return false;
	}

	protected clearState(): void {
		this.byUid.clear();
	}

	private handleIndexerEvent(event: IndexerEvent): void {
		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.processFileChange(event.filePath, event.source.frontmatter);
				}
				break;
			case "file-deleted":
				this.untrackByPath(event.filePath);
				break;
		}
	}

	private processFileChange(filePath: string, frontmatter: Frontmatter): void {
		const data = frontmatter[this.frontmatterProp] as Frontmatter | undefined;

		if (data && typeof data === "object") {
			const result = this.schema.safeParse(data);
			if (result.success) {
				this.trackEvent(filePath, result.data);
				return;
			}
		}

		this.untrackByPath(filePath);
	}
}
