import type { App } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
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
	}

	destroy(): void {
		this.indexerSubscription?.unsubscribe();
		this.indexerSubscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.clearState();
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
